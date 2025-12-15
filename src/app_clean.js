// Minimal clean Express app used by worker during deploy recovery
import express from 'express';
import bodyParser from 'body-parser';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import DataExposureHandler from './handlers/data-exposure-handler.js';
import { getRedis, MockRedis } from './lib/redis-factory.js';
import { register } from './utils/metrics.js';

process.env.PGSSLMODE = process.env.PGSSLMODE || 'require';
// Do NOT disable TLS globally. Allow an explicit opt-in for local development only.
if (String(process.env.ALLOW_INSECURE_TLS || '').toLowerCase() === '1') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = process.env.NODE_TLS_REJECT_UNAUTHORIZED || '0';
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

app.use(bodyParser.json({ limit: '5mb', verify: (req, _res, buf) => { req.rawBody = buf; } }));

function safeLog(...args) { try { console.log(...args); } catch (e) {} }

// Minimal endpoints (worker only needs registerDataExposureAPI export)
app.get('/health', (_req, res) => res.status(200).json({ ok: true }));

// Prometheus metrics endpoint (exposes prom-client registry)
app.get('/metrics', async (req, res) => {
  try {
    const contentType = (register && register.contentType) ? register.contentType : 'text/plain; version=0.0.4';
    res.set('Content-Type', contentType);
    const body = await register.metrics();
    return res.status(200).send(body);
  } catch (err) {
    console.error('Failed to render /metrics', err && err.message ? err.message : err);
    return res.status(500).send('failed to render metrics');
  }
});

app.post('/webhook/mpesa', (_req, res) => {
  // worker doesn't handle web traffic; keep a stub to avoid undefined routes
  return res.status(200).send('OK');
});

// Telegram webhook endpoints: accept updates and enqueue them for the worker
// to consume from Redis (list: telegram:updates).
const TELEGRAM_WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || null;

let webhookRedis;
try {
  webhookRedis = getRedis();
} catch (e) {
  try { webhookRedis = new MockRedis(); } catch(_){ webhookRedis = null; }
}

app.post('/webhook', async (req, res) => {
  try {
    const secret = req.headers['x-telegram-bot-api-secret-token'];
    if (TELEGRAM_WEBHOOK_SECRET && secret && secret !== TELEGRAM_WEBHOOK_SECRET) {
      console.warn('Telegram webhook: invalid secret token');
      return res.sendStatus(403);
    }
    if (!webhookRedis) {
      console.warn('Telegram webhook: no Redis available to enqueue update');
      return res.sendStatus(503);
    }
    // Chat-id capture removed — was gated by ENABLE_CHAT_ID_LOG

    await webhookRedis.lpush('telegram:updates', JSON.stringify(req.body));
    console.log('[WEBHOOK] Enqueued Telegram update');
    return res.sendStatus(200);
  } catch (err) {
    console.error('Telegram webhook error', err?.message || String(err));
    return res.sendStatus(500);
  }
});

app.post('/webhook/telegram', async (req, res) => {
  // same behaviour as /webhook — explicitly enqueue to avoid recursive app.handle calls
  try {
    const secret = req.headers['x-telegram-bot-api-secret-token'];
    if (TELEGRAM_WEBHOOK_SECRET && secret && secret !== TELEGRAM_WEBHOOK_SECRET) {
      console.warn('Telegram webhook: invalid secret token (telegram endpoint)');
      return res.sendStatus(403);
    }
    if (!webhookRedis) {
      console.warn('Telegram webhook: no Redis available to enqueue update (telegram endpoint)');
      return res.sendStatus(503);
    }
    // Chat-id capture removed — was gated by ENABLE_CHAT_ID_LOG

    await webhookRedis.lpush('telegram:updates', JSON.stringify(req.body));
    console.log('[WEBHOOK] Enqueued Telegram update (telegram endpoint)');
    return res.sendStatus(200);
  } catch (err) {
    console.error('Telegram webhook error (telegram endpoint)', err?.message || String(err));
    return res.sendStatus(500);
  }
});

export function registerDataExposureAPI(sportsAggregator) {
  try { new DataExposureHandler(app, sportsAggregator); safeLog('DATA_EXPOSURE: registered'); }
  catch (err) { safeLog('DATA_EXPOSURE registration failed:', String(err)); }
}

export default app;
