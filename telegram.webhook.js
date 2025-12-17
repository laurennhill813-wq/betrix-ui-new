/*
  Minimal Telegram webhook server
  - POST /telegram/:token  -> immediately 200 and enqueue job to Redis list "betrix-jobs"
  - GET  /health          -> 200 {"status":"ok"}
  Compatible with REDIS_URL (redis://user:pass@host:port or redis://:pass@host:port)
*/
const express = require('express');
const bodyParser = require('body-parser');
// Use centralized Redis adapter via dynamic ESM import for compatibility with CommonJS
let redisClient = null;
async function initRedisClient() {
  try {
    const mod = await import('./src/lib/redis-factory.js');
    if (mod && typeof mod.getRedisAdapter === 'function') {
      redisClient = mod.getRedisAdapter();
      if (redisClient && typeof redisClient.connect === 'function') {
        await redisClient.connect();
      }
      console.log('[telegram.webhook] Redis adapter initialized');
      return;
    }
  } catch (e) {
    console.warn('[telegram.webhook] Failed to load redis adapter, falling back to native client:', e && e.message);
  }

  // Last-resort: fall back to node-redis createClient
  try {
    const { createClient } = require('redis');
    redisClient = createClient(parseRedisOptsFromEnv());
    await redisClient.connect();
  } catch (e) {
    console.error('[telegram.webhook] Redis fallback failed', e && e.message);
    redisClient = null;
  }
}

// Minimal structured logger for CommonJS webhook file
function wlog(level, msg, meta) {
  const out = { ts: new Date().toISOString(), level, msg: typeof msg === 'string' ? msg : JSON.stringify(msg), meta };
  const line = JSON.stringify(out);
  if (level === 'ERROR' || level === 'WARN') process.stderr.write(line + '\n'); else process.stdout.write(line + '\n');
}

const logger = { info: (m, meta) => wlog('INFO', m, meta), warn: (m, meta) => wlog('WARN', m, meta), error: (m, meta) => wlog('ERROR', m, meta) };

function parseRedisOptsFromEnv() {
  if (process.env.REDIS_URL) {
    try {
      const url = new URL(process.env.REDIS_URL);
      const opts = { socket: { host: url.hostname, port: Number(url.port) || 6379, tls: url.protocol === 'rediss:' } };
      if (url.username) opts.username = decodeURIComponent(url.username);
      if (url.password) opts.password = decodeURIComponent(url.password.replace(/^:/, ''));
      return opts;
    } catch (err) {
      console.warn('WARN_BAD_REDIS_URL', err && err.message);
    }
  }
  const opts = { socket: { host: process.env.REDIS_HOST || '127.0.0.1', port: Number(process.env.REDIS_PORT) || 6379, tls: (process.env.REDIS_TLS === 'true') } };
  if (process.env.REDIS_USERNAME) opts.username = process.env.REDIS_USERNAME;
  if (process.env.REDIS_PASSWORD) opts.password = process.env.REDIS_PASSWORD;
  return opts;
}

const redisOpts = parseRedisOptsFromEnv();
logger.info('WEBHOOK_REDIS_OPTS', { host: redisOpts.socket.host, port: redisOpts.socket.port, tls: !!redisOpts.socket.tls, username: !!redisOpts.username, hasPassword: !!redisOpts.password });

(async () => {
  try {
    await initRedisClient();
    if (!redisClient) {
      logger.error('WEBHOOK_REDIS_CONNECT_FAILED', 'No redis client available');
      // Crash so platform surfaces the failure
      process.exit(1);
    }
    logger.info('WEBHOOK_REDIS_CONNECTED');
  } catch (err) {
    logger.error('WEBHOOK_REDIS_CONNECT_FAILED', err && err.message);
    // Crash so platform surfaces the failure
    process.exit(1);
  }

  const app = express();
  app.use(bodyParser.json({ limit: '128kb' }));

  // Health endpoint
  app.get('/health', (req, res) => res.status(200).json({ status: 'ok', ts: new Date().toISOString() }));

  // POST /telegram/:token -> immediate ack and enqueue
  app.post('/telegram/:token', async (req, res) => {
    try {
      const incomingToken = req.params.token;
      const expected = process.env.TELEGRAM_TOKEN;
      if (!expected) {
        logger.warn('WEBHOOK_NO_TELEGRAM_TOKEN');
        // Accept but log; enqueue for inspection
      } else if (incomingToken !== expected) {
        logger.warn('WEBHOOK_TOKEN_MISMATCH', { received: !!incomingToken, expectedPresent: !!expected });
        // Return 403 if token mismatches to avoid processing bad requests
        res.status(403).json({ ok: false, error: 'invalid token' });
        return;
      }

      // Respond immediately so Telegram considers delivery successful
      res.status(200).json({ ok: true });

      // Compose job and enqueue (non-blocking)
      const job = {
        jobId: 'webhook-' + Date.now(),
        type: 'telegram_update',
        tokenMasked: incomingToken ? ('***len:' + incomingToken.length) : false,
        payload: req.body,
        receivedAt: new Date().toISOString()
      };

      // Non-blocking enqueue with safe logging
      try {
        if (!redisClient) throw new Error('no redis client');
        // Adapter may expose either `lPush` or `lpush`/`rpush` methods
        if (typeof redisClient.lPush === 'function') {
          await redisClient.lPush('betrix-jobs', JSON.stringify(job));
        } else if (typeof redisClient.rpush === 'function') {
          await redisClient.rpush('betrix-jobs', JSON.stringify(job));
        } else if (typeof redisClient.rPush === 'function') {
          await redisClient.rPush('betrix-jobs', JSON.stringify(job));
        } else if (typeof redisClient.lpush === 'function') {
          await redisClient.lpush('betrix-jobs', JSON.stringify(job));
        } else {
          throw new Error('redis client has no push method');
        }
        logger.info('WEBHOOK_ENQUEUED', { jobId: job.jobId, pendingHint: 'push' });
      } catch (err) {
        logger.error('WEBHOOK_ENQUEUE_FAILED', err && err.message, { jobId: job.jobId });
      }
    } catch (err) {
      logger.error('WEBHOOK_HANDLER_EXCEPTION', err && err.message);
      try { res.status(500).json({ ok: false }); } catch (_) { /* noop */ }
    }
  });

  const bindPort = Number(process.env.PORT) || 10000;
  app.listen(bindPort, () => {
    logger.info('WEBHOOK_LISTENING', { port: bindPort });
  });

})();
