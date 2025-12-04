import express from 'express';
import bodyParser from 'body-parser';
import crypto from 'crypto';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Minimal clean ESM Express app for Lipana / M-Pesa webhook handling
process.env.PGSSLMODE = process.env.PGSSLMODE || 'require';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = process.env.NODE_TLS_REJECT_UNAUTHORIZED || '0';

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// capture raw body for HMAC verification
app.use(bodyParser.json({ limit: '5mb', verify: (req, _res, buf) => { req.rawBody = buf; } }));

function safeLog(...args) { try { console.log(...args); } catch (e) {} }

app.get('/health', (_req, res) => res.status(200).json({ ok: true }));
app.get('/admin/queue', (_req, res) => res.json({ ok: true, commit: process.env.RENDER_GIT_COMMIT || process.env.COMMIT_SHA || null }));

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
        result[item.label] = lines.slice(-n).map(l => { try { return JSON.parse(l); } catch { return l; } });
      } catch (e) {
        result[item.label] = { error: e?.message || String(e) };
      }
    }

    return res.json({ ok: true, files: result });
  } catch (err) { return res.status(500).json({ ok: false, error: String(err) }); }
});

app.post('/webhook/mpesa', async (req, res) => {
  const secret = process.env.LIPANA_WEBHOOK_SECRET || process.env.MPESA_WEBHOOK_SECRET || process.env.LIPANA_SECRET;
  const incoming = req.headers['x-lipana-signature'] || req.headers['x-signature'] || req.headers['signature'] || '';
  try {
    const raw = req.rawBody || Buffer.from(JSON.stringify(req.body || {}), 'utf8');
    let computedHex = null, computedB64 = null;
    if (secret) {
      const h = crypto.createHmac('sha256', String(secret)).update(raw).digest();
      computedHex = h.toString('hex'); computedB64 = h.toString('base64');
    }

    safeLog('[webhook/mpesa] incoming=', incoming, 'computedHexPrefix=', computedHex ? computedHex.slice(0,16) : null);

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
      } catch (fsErr) { safeLog('DB insert failed and fallback file write failed:', fsErr?.message || String(fsErr)); }
      safeLog('DB insert failed (webhook):', e?.message || String(e));
    }

    return res.status(200).send('OK');
  } catch (err) { safeLog('Webhook handler error:', String(err)); return res.status(200).send('OK'); }
});

export function registerDataExposureAPI() { safeLog('registerDataExposureAPI called'); return { ok: true }; }
export default app;

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => safeLog(`Server listening on ${PORT}`));
}
