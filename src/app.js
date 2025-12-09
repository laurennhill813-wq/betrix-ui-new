import express from 'express';
import bodyParser from 'body-parser';
import crypto from 'crypto';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import os from 'os';
import healthAzureAIHandler from './routes/health-azure-ai.js';
import healthAzureAIEnvHandler from './routes/health-azure-ai-env.js';
import lipana from './lib/lipana-client.js';
import { getRedis } from './lib/redis-factory.js';
import { verifyAndActivatePayment } from './handlers/payment-router.js';
import * as newsService from './services/news-service.js';
import * as sportsgameodds from './services/sportsgameodds.js';

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

// Lightweight DB and Redis health probes
app.get('/health/db', async (_req, res) => {
  try {
    const r = await pool.query('SELECT 1 AS ok');
    if (r && r.rows && r.rows[0] && r.rows[0].ok === 1) return res.json({ ok: true });
    return res.status(500).json({ ok: false, error: 'unexpected db response' });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

app.get('/health/redis', async (_req, res) => {
  try {
    const redis = getRedis();
    if (!redis) return res.status(500).json({ ok: false, error: 'redis client missing' });
    const pong = await redis.ping();
    return res.json({ ok: true, pong });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

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

// Admin: report presence of critical env vars (non-sensitive names only)
app.get('/admin/envs', (req, res) => {
  if (!_adminAuth(req)) return res.status(403).json({ ok: false, reason: 'Forbidden' });
  try {
    const keys = ['PAYPAL_CLIENT_ID','PAYPAL_CLIENT_SECRET','BINANCE_API_KEY','BINANCE_API_SECRET','REDIS_URL','TELEGRAM_TOKEN','SPORTSGAMEODDS_API_KEY'];
    const result = {};
    for (const k of keys) result[k] = !!process.env[k];
    return res.json({ ok: true, envs: result });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Admin: verify worker connectivity basics (Redis ping and presence of outgoing queue)
app.get('/admin/verify-worker', async (req, res) => {
  if (!_adminAuth(req)) return res.status(403).json({ ok: false, reason: 'Forbidden' });
  try {
    const redis = getRedis();
    if (!redis) return res.status(500).json({ ok: false, error: 'redis client missing' });
    const pong = await redis.ping();
    // Check outgoing telegram queue length (best-effort)
    let qlen = null;
    try { qlen = await redis.llen('outgoing:telegram'); } catch (e) { qlen = 'unknown'; }
    return res.json({ ok: true, redis: { pong, outgoingTelegramQueueLength: qlen }, telegramTokenPresent: !!process.env.TELEGRAM_TOKEN });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Admin: quick SportsGameOdds diagnostic (fetch sample odds)
app.get('/admin/sportsgameodds', async (req, res) => {
  if (!_adminAuth(req)) return res.status(403).json({ ok: false, reason: 'Forbidden' });
  try {
    const league = String(req.query.league || 'nba');
    const eventId = req.query.eventId || null;
    const redis = getRedis();
    const data = await sportsgameodds.fetchOdds({ league, eventId, redis, forceFetch: !!req.query.force });
    return res.json({ ok: true, league, eventId, sample: data });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Admin: Lipana connectivity probe and test STK push (protected)
function _adminAuth(req) {
  const secret = process.env.HEALTH_SECRET || process.env.ADMIN_SECRET || process.env.LIPANA_ADMIN_SECRET || null;
  if (!secret) return false; // disabled unless secret set
  const h = req.headers['x-health-secret'] || req.headers['x-admin-secret'] || req.headers['x-lipana-admin'] || '';
  return String(h) === String(secret);
}

app.get('/admin/lipana/ping', async (req, res) => {
  if (!_adminAuth(req)) return res.status(403).json({ ok: false, reason: 'Forbidden' });
  try {
    const result = await lipana.ping();
    return res.json({ ok: true, lipana: result });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Admin: return last N persisted Lipana STK request/response entries (masked)
app.get('/admin/lipana-stk-logs', (req, res) => {
  if (!_adminAuth(req)) return res.status(403).json({ ok: false, reason: 'Forbidden' });
  try {
    const n = Math.min(500, Number(req.query.n || 100));
    const p = path.join(process.cwd(), 'logs', 'lipana-stk.log');
    if (!fs.existsSync(p)) return res.json({ ok: true, lines: [] });
    const txt = fs.readFileSync(p, 'utf8').split(/\r?\n/).filter(Boolean);
    const tail = txt.slice(-n).map(l => { try { return JSON.parse(l); } catch { return l; } });
    return res.json({ ok: true, lines: tail });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
});

app.post('/admin/lipana/test-stk', async (req, res) => {
  if (!_adminAuth(req)) return res.status(403).json({ ok: false, reason: 'Forbidden' });
  const { phone, amount } = req.body || {};
  if (!phone) return res.status(400).json({ ok: false, error: 'phone required' });
  const amt = Number(amount || process.env.LIPANA_TEST_AMOUNT || 100);
  try {
    const callback = process.env.LIPANA_CALLBACK_URL || process.env.MPESA_CALLBACK_URL || null;
    const resp = await lipana.stkPush({ amount: amt, phone, tx_ref: `test_${Date.now()}`, reference: `test_${Date.now()}`, callback_url: callback });
    return res.json({ ok: true, result: resp });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Admin: helper to create providerRef -> order mapping and immediately activate the order
// This is a temporary endpoint for debugging and should be removed after manual verification.
app.post('/admin/simulate/lipana-reconcile', async (req, res) => {
  if (!_adminAuth(req)) return res.status(403).json({ ok: false, reason: 'Forbidden' });
  const { providerRef, provider = 'MPESA', orderId: providedOrderId, amount = 150, userId = 'admin' } = req.body || {};
  if (!providerRef) return res.status(400).json({ ok: false, error: 'providerRef required' });

  try {
    const redis = getRedis();

    // Ensure we have an orderId; if none provided, create a lightweight test order in Redis
    const orderId = providedOrderId || `SIMORD-${Date.now()}`;
    try {
      const existing = await redis.get(`payment:order:${orderId}`);
      if (!existing) {
        const orderData = {
          orderId,
          userId,
          tier: 'SIGNUP',
          paymentMethod: 'MPESA',
          baseAmount: Number(amount),
          fee: 0,
          totalAmount: Number(amount),
          currency: 'KES',
          status: 'pending',
          createdAt: new Date().toISOString(),
          metadata: { simulated: true }
        };
        await redis.setex(`payment:order:${orderId}`, 900, JSON.stringify(orderData));
      }
    } catch (e) { /* best-effort */ }

    // Create mapping so webhook/reconcile logic can find the order
    try {
      await redis.setex(`payment:by_provider_ref:${provider}:${providerRef}`, 900, orderId);
    } catch (e) { /* best-effort */ }

    // Call verifyAndActivatePayment to simulate activation
    try {
      const result = await verifyAndActivatePayment(getRedis(), orderId, providerRef);
      return res.json({ ok: true, activated: true, orderId, result });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
});

// Admin: manual payment confirm (provider, providerRef or orderId) - useful for Binance manual flows
app.post('/admin/payments/confirm', async (req, res) => {
  if (!_adminAuth(req)) return res.status(403).json({ ok: false, reason: 'Forbidden' });
  const { provider, providerRef, orderId, transactionId } = req.body || {};
  if (!provider && !orderId) return res.status(400).json({ ok: false, error: 'provider or orderId required' });

  try {
    const redis = getRedis();
    let oid = orderId || null;
    if (!oid && provider && providerRef) {
      oid = await redis.get(`payment:by_provider_ref:${provider.toUpperCase()}:${providerRef}`);
    }
    if (!oid) return res.status(404).json({ ok: false, error: 'Order not found for given provider/providerRef' });

    const tx = transactionId || providerRef || `MANUAL-${Date.now()}`;
    try {
      const result = await verifyAndActivatePayment(redis, oid, tx);
      return res.json({ ok: true, activated: true, orderId: oid, result });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
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
async function webhookMpesaHandler(req, res) {
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

    // If secret is configured, enforce signature match
    if (secret) {
      const incomingClean = String(incoming || '').trim();
      const match = incomingClean === computedHex || incomingClean === computedB64;
      if (!match) {
        safeLog('[webhook/mpesa] Signature mismatch - rejecting webhook');
        return res.status(403).json({ ok: false, reason: 'Invalid signature' });
      }
    }

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

    // Attempt immediate reconciliation using Redis mapping so webhooks activate without worker
    try {
      const payload = req.body || {};
      // possible fields from Lipana: transactionId, reference, providerRef, id, data.id
      const providerRef = payload.transaction_id || payload.transactionId || payload.reference || payload.providerRef || (payload.data && payload.data.id) || null;
      const phone = payload.phone || payload.msisdn || (payload.data && payload.data.phone) || null;
      const tx = providerRef || (`MPESA_${Date.now()}`);

      try {
        const redis = getRedis();
        let orderId = null;
        if (providerRef) {
          // try common keys
          orderId = await redis.get(`payment:by_provider_ref:MPESA:${providerRef}`) || await redis.get(`payment:by_provider_ref:MPESA:${providerRef}`);
        }
        if (!orderId && phone) {
          const p = String(phone).replace(/\s|\+|-/g, '');
          orderId = await redis.get(`payment:by_phone:${p}`);
        }

        if (orderId) {
          try {
            // Call verifyAndActivatePayment to mark order completed
            const result = await verifyAndActivatePayment(redis, orderId, tx);
            safeLog('[webhook/mpesa] Activated order via webhook', { providerRef, orderId, tx, result });
          } catch (actErr) {
            safeLog('[webhook/mpesa] Activation attempt failed', actErr?.message || String(actErr));
          }
        } else {
          safeLog('[webhook/mpesa] No mapping found in Redis for webhook - mapping miss', { providerRef, phone });
        }
      } catch (redisErr) {
        safeLog('[webhook/mpesa] Redis lookup failed', redisErr?.message || String(redisErr));
      }
    } catch (reconErr) {
      safeLog('[webhook/mpesa] Reconciliation attempt error', reconErr?.message || String(reconErr));
    }

    // Return 200 so upstream won't retry while we debug
    return res.status(200).send('OK');
  } catch (err) {
    safeLog('Webhook handler error:', err?.message || String(err));
    return res.status(200).send('OK');
  }
}

// Register both singular and plural routes to match Lipana's callbacks
app.post('/webhook/mpesa', webhookMpesaHandler);
app.post('/webhooks/mpesa', webhookMpesaHandler);

// Webhook endpoint for Binance (Binance Pay or other notifications)
async function webhookBinanceHandler(req, res) {
  try {
    const payload = req.body || {};
    safeLog('[webhook/binance] payload:', payload);

    // Persist to DB / fallback files
    try {
      await pool.query(`CREATE TABLE IF NOT EXISTS webhooks (id SERIAL PRIMARY KEY, created_at timestamptz DEFAULT now(), raw_payload jsonb, headers jsonb)`);
      await pool.query('INSERT INTO webhooks(raw_payload, headers) VALUES($1,$2)', [payload, req.headers || {}]);
    } catch (e) {
      try {
        const rec = { ts: new Date().toISOString(), headers: req.headers || {}, body: payload };
        const logPath = path.join(process.cwd(), 'webhooks.log');
        fs.appendFileSync(logPath, JSON.stringify(rec) + '\n');
      } catch (fsErr) {
        safeLog('[webhook/binance] fallback write failed', fsErr?.message || String(fsErr));
      }
    }

    // Attempt reconciliation: look for provider-specific order id fields
    try {
      const redis = getRedis();
      const possibleRef = payload.merchantTradeNo || payload.merchantOrderId || payload.orderId || payload.transactionId || payload.data?.merchantOrderId || payload.data?.orderId || null;
      const phone = payload.payerPhone || payload.payer || payload.data?.payerPhone || null;
      const providerRef = possibleRef;
      let orderId = null;
      if (providerRef) {
        orderId = await redis.get(`payment:by_provider_ref:BINANCE:${providerRef}`);
      }
      if (!orderId && phone) {
        const p = String(phone).replace(/\+|\s|-/g, '');
        orderId = await redis.get(`payment:by_phone:${p}`);
      }

      if (orderId) {
        const tx = providerRef || (`BINANCE_${Date.now()}`);
        try {
          const result = await verifyAndActivatePayment(redis, orderId, tx);
          safeLog('[webhook/binance] Activated order', { orderId, tx, result });
        } catch (e) {
          safeLog('[webhook/binance] Activation failed', e?.message || e);
        }
      } else {
        safeLog('[webhook/binance] No mapping found for webhook', { providerRef, phone });
      }
    } catch (e) {
      safeLog('[webhook/binance] Redis reconciliation error', e?.message || e);
    }

    return res.status(200).send('OK');
  } catch (err) {
    safeLog('[webhook/binance] handler error', err?.message || String(err));
    return res.status(200).send('OK');
  }
}

app.post('/webhook/binance', webhookBinanceHandler);
app.post('/webhooks/binance', webhookBinanceHandler);

// Mount the richer server-side Telegram command router if present.
// Allow both `TELEGRAM_BOT_TOKEN` and `TELEGRAM_TOKEN` env var names for compatibility.
process.env.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_TOKEN || process.env.TELEGRAM_TOKEN;
(async () => {
  // We intentionally avoid silently swallowing import errors here so that
  // runtime import failures surface in Render logs and can be debugged.
  try {
    let mod;
    try {
      mod = await import('./server/commands/index.js');
    } catch (impErr) {
      // Log full stack/message so Render's logs include the root cause
      try { safeLog('COMMAND_ROUTER_IMPORT_ERR', impErr && (impErr.stack || impErr.message || String(impErr))); } catch (e) { console.error('Failed logging import error', e); }
      mod = null;
    }

    const commandRouter = (mod && (mod.default || mod)) || null;
    if (typeof commandRouter === 'function') {
      try {
        commandRouter(app);
        safeLog('MOUNTED: server/commands/index.js -> /webhook/telegram');
      } catch (e) {
        try { safeLog('MOUNT_CMD_ROUTER_ERR', e && (e.stack || e.message || String(e))); } catch (le) { console.error('Failed logging mount error', le); }
      }
    } else {
      // If import returned null or module doesn't export a function, provide
      // a clearer log message to aid debugging rather than silently leaving
      // the webhook unmounted.
      safeLog('COMMAND_ROUTER_NOT_FOUND; leaving webhook unmounted - import returned null or exported value is not a function');
    }
  } catch (e) {
    // Defensive catch: should not normally happen because inner import errors
    // are handled explicitly, but we log here just in case.
    try { safeLog('COMMAND_ROUTER_TOPLEVEL_ERR', e && (e.stack || e.message || String(e))); } catch (le) { console.error('Failed logging to safeLog', le); }
  }
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
const SHOULD_LISTEN = !(process.env.WORKER_ONLY === 'true' || process.env.BACKGROUND_WORKER === 'true' || process.env.NODE_ENV === 'test');

// News API endpoints
app.get('/api/news', async (req, res) => {
  try {
    const max = Math.min(50, Number(req.query.max || 10));
    const headlines = await newsService.getCachedHeadlines({ max });
    return res.json({ ok: true, headlines });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Backwards-compatible `/news` route used by internal callbacks/services
app.get('/news', async (req, res) => {
  try {
    const max = Math.min(50, Number(req.query.max || 10));
    const headlines = await newsService.getCachedHeadlines({ max });
    return res.json(headlines);
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Return Betrix-branded HTML for an article. Accept either `link` query or news id path.
app.get('/api/news/:id/html', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).send('id required');
    let link = null;
    try {
      const r = await pool.query('SELECT link FROM news WHERE id = $1 LIMIT 1', [id]);
      if (r && r.rows && r.rows[0]) link = r.rows[0].link;
    } catch (e) { /* ignore */ }
    if (!link) return res.status(404).send('Article not found');
    const html = await newsService.fetchArticleHtmlByLink(link);
    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (e) {
    return res.status(500).send('Failed to fetch article');
  }
});

app.get('/api/news/html', async (req, res) => {
  try {
    const link = req.query.link;
    if (!link) return res.status(400).send('link required');
    const html = await newsService.fetchArticleHtmlByLink(link);
    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (e) {
    return res.status(500).send('Failed to fetch article');
  }
});

if (SHOULD_LISTEN) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    // start auxiliary realtime WS server (runs on PORT+1 by default)
    try {
      import('./services/realtime.js').then(mod => mod.startRealtimeServer()).catch(err => console.warn('Realtime import failed', err?.message || err));
    } catch (e) {
      console.warn('Could not start realtime server:', e?.message || e);
    }
  });
} else {
  console.log('Skipping HTTP listen (worker/background mode)');
}

export default app;
