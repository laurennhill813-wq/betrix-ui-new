import express from 'express';
import bodyParser from 'body-parser';
import crypto from 'crypto';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import os from 'os';
import healthAzureAIHandler from './routes/health-azure-ai.js';
import healthAzureAIEnvHandler from './routes/health-azure-ai-env.js';

// Keep PGSSLMODE defaulted to 'require' on platforms like Render
process.env.PGSSLMODE = process.env.PGSSLMODE || 'require';

const app = express();
app.use(express.json({ limit: '1mb' }));

// DB pool: best-effort TLS settings for managed Postgres (fine-tune in prod)
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Capture raw body bytes for HMAC verification
app.use(bodyParser.json({ limit: '5mb', verify: (req, _res, buf) => { req.rawBody = buf; } }));

function safeLog(...args) { try { console.log(...args); } catch (e) { console.warn('safeLog error', String(e)); } }

app.get('/health', (_req, res) => res.status(200).json({ ok: true }));

app.get('/admin/queue', (_req, res) => {
  return res.json({ ok: true, commit: process.env.RENDER_GIT_COMMIT || process.env.COMMIT_SHA || null });
});

// Admin: return last N fallback webhook entries from fallback files
app.get('/admin/webhook-fallback', (req, res) => {
  try {
    const n = Math.min(100, Number(req.query.n || 50));
    const repoPath = path.join(process.cwd(), 'webhooks.log');
    const tmpPath = path.join(os.tmpdir(), 'webhooks.log');
    const result = {};

    for (const item of [{ p: repoPath, label: 'repo' }, { p: tmpPath, label: 'tmp' }]) {
      try {
        if (!fs.existsSync(item.p)) { result[item.label] = null; continue; }
        const txt = fs.readFileSync(item.p, 'utf8');
        const lines = txt.split(/\r?\n/).filter(Boolean);
        const tail = lines.slice(-n).map(l => {
          try { return JSON.parse(l); } catch { return l; }
        });
        result[item.label] = tail;
      } catch (e) {
        result[item.label] = { error: e?.message || String(e) };
      }
    }

    return res.json({ ok: true, files: result });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
});

// Admin: return last N outgoing Telegram events (written by the app to ./logs/outgoing-events.log)
app.get('/admin/outgoing-events', (req, res) => {
  try {
    const n = Math.min(500, Number(req.query.n || 200));
    const p = path.join(process.cwd(), 'logs', 'outgoing-events.log');
    if (!fs.existsSync(p)) return res.json({ ok: true, lines: [] });
    const txt = fs.readFileSync(p, 'utf8').split(/\r?\n/).filter(Boolean);
    const tail = txt.slice(-n).map(l => {
      try { return JSON.parse(l); } catch { return l; }
    });
    return res.json({ ok: true, lines: tail });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
});

// Azure AI health probe: safe, optional header protection using `HEALTH_SECRET`.
// Wire the lightweight probe handler so it's available in production deployments.
app.get('/health/azure-ai', (req, res) => {
  if (process.env.HEALTH_SECRET && req.headers['x-health-secret'] !== process.env.HEALTH_SECRET) {
    return res.status(403).json({ ok: false, reason: 'Forbidden' });
  }
  return healthAzureAIHandler(req, res);
});

// Diagnostic: report presence of Azure/OpenAI env vars (non-sensitive)
app.get('/health/azure-ai/env', (req, res) => {
  // Guard the diagnostic route: requires `HEALTH_DEBUG_SECRET` to be set on the host
  // and the client must provide the same value in the `X-Debug-Secret` header.
  const secret = process.env.HEALTH_DEBUG_SECRET;
  if (!secret) {
    return res.status(403).json({ ok: false, reason: 'Diagnostic endpoint disabled' });
  }
  if (req.headers['x-debug-secret'] !== secret) {
    return res.status(403).json({ ok: false, reason: 'Forbidden' });
  }
  return healthAzureAIEnvHandler(req, res);
});

// Webhook endpoint for Lipana / M-Pesa
app.post('/webhook/mpesa', async (req, res) => {
  const secret = process.env.LIPANA_WEBHOOK_SECRET || process.env.MPESA_WEBHOOK_SECRET || process.env.LIPANA_SECRET;
  const incoming = req.headers['x-lipana-signature'] || req.headers['x-signature'] || req.headers['signature'] || '';
  try {
    const raw = req.rawBody || Buffer.from(JSON.stringify(req.body || {}), 'utf8');
    let computedHex = null;
    let computedB64 = null;
    if (secret) {
      const h = crypto.createHmac('sha256', String(secret)).update(raw).digest();
      computedHex = h.toString('hex');
      computedB64 = h.toString('base64');
    }

    safeLog('[webhook/mpesa] incoming=', incoming, 'computedHexPrefix=', computedHex ? computedHex.slice(0,16) : null);

    // Best-effort persistence: try DB, else write fallback files
    try {
      await pool.query(`CREATE TABLE IF NOT EXISTS webhooks (id SERIAL PRIMARY KEY, created_at timestamptz DEFAULT now(), raw_payload jsonb, headers jsonb, incoming_signature text, computed_hex text, computed_b64 text)`);
      await pool.query('INSERT INTO webhooks(raw_payload, headers, incoming_signature, computed_hex, computed_b64) VALUES($1,$2,$3,$4,$5)', [req.body || {}, req.headers || {}, incoming, computedHex, computedB64]);
    } catch (e) {
      try {
        const rec = { ts: new Date().toISOString(), headers: req.headers || {}, body: req.body || {}, incoming_signature: incoming, computedHex, computedB64 };
        const logPath = path.join(process.cwd(), 'webhooks.log');
        const tmpPath = path.join(os.tmpdir(), 'webhooks.log');
        fs.appendFileSync(logPath, JSON.stringify(rec) + '\n', { encoding: 'utf8' });
        fs.appendFileSync(tmpPath, JSON.stringify(rec) + '\n', { encoding: 'utf8' });
        safeLog('DB insert failed; appended webhook to', logPath, 'and', tmpPath);
      } catch (fsErr) {
        safeLog('DB insert failed and fallback file write failed:', fsErr?.message || String(fsErr));
      }
      safeLog('DB insert failed (webhook):', e?.message || String(e));
    }

    // Return 200 so upstream won't retry while we debug
    return res.status(200).send('OK');
  } catch (err) {
    safeLog('Webhook handler error:', err?.message || String(err));
    return res.status(200).send('OK');
  }
});

// Mount the richer server-side Telegram command router if present.
// Allow both `TELEGRAM_BOT_TOKEN` and `TELEGRAM_TOKEN` env var names for compatibility.
process.env.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_TOKEN || process.env.TELEGRAM_TOKEN;
(async () => {
  try {
    const mod = await import('./server/commands/index.js').catch(() => null);
    const commandRouter = (mod && (mod.default || mod)) || null;
    if (typeof commandRouter === 'function') {
      try {
        commandRouter(app);
        safeLog('MOUNTED: server/commands/index.js -> /webhook/telegram');
      } catch (e) { safeLog('MOUNT_CMD_ROUTER_ERR', String(e)); }
    } else {
      safeLog('COMMAND_ROUTER_NOT_FOUND; leaving webhook unmounted');
    }
  } catch (e) { safeLog('COMMAND_ROUTER_IMPORT_ERR', String(e)); }
})();

// Allow workers to register data-exposure endpoints without failing
// The worker imports `registerDataExposureAPI` from this module; provide
// a safe implementation that dynamically loads the handler if available.
export function registerDataExposureAPI(sportsAggregator) {
  (async () => {
    try {
      const mod = await import('./handlers/data-exposure-handler.js').catch(() => null);
      const DataExposureHandler = mod && (mod.default || mod.DataExposureHandler);
      if (DataExposureHandler) {
        try {
          new DataExposureHandler(app, sportsAggregator);
          safeLog('DATA_EXPOSURE: registered');
        } catch (err) {
          safeLog('DATA_EXPOSURE registration failed:', String(err));
        }
      } else {
        safeLog('DATA_EXPOSURE: handler module not found; skipping registration');
      }
    } catch (e) {
      safeLog('DATA_EXPOSURE registration failed:', String(e));
    }
  })();
}

// Single PORT binding and listen
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // start auxiliary realtime WS server (runs on PORT+1 by default)
  try {
    import('./services/realtime.js').then(mod => mod.startRealtimeServer()).catch(err => console.warn('Realtime import failed', err?.message || err));
  } catch (e) {
    console.warn('Could not start realtime server:', e?.message || e);
  }
});

export default app;
