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

process.env.PGSSLMODE = process.env.PGSSLMODE || 'require';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = process.env.NODE_TLS_REJECT_UNAUTHORIZED || '0';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

app.use(bodyParser.json({ limit: '5mb', verify: (req, _res, buf) => { req.rawBody = buf; } }));

function safeLog(...args) { try { console.log(...args); } catch (e) {} }

// Minimal endpoints (worker only needs registerDataExposureAPI export)
app.get('/health', (_req, res) => res.status(200).json({ ok: true }));

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
    await webhookRedis.lpush('telegram:updates', JSON.stringify(req.body));
    console.log('[WEBHOOK] Enqueued Telegram update');
    return res.sendStatus(200);
  } catch (err) {
    console.error('Telegram webhook error', err?.message || String(err));
    return res.sendStatus(500);
  }
});

app.post('/webhook/telegram', async (req, res) => {
  // same behaviour as /webhook
  return app.handle(req, res);
});

export function registerDataExposureAPI(sportsAggregator) {
  try { new DataExposureHandler(app, sportsAggregator); safeLog('DATA_EXPOSURE: registered'); }
  catch (err) { safeLog('DATA_EXPOSURE registration failed:', String(err)); }
}

export default app;
