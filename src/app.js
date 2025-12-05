// Minimal, clean canonical `src/app.js`
import express from 'express';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Pool } from 'pg';
import { createClient } from 'redis';

import createAdminRouter from './routes/admin.js';
import createWebhooksRouter from './routes/webhooks.js';

const app = express();
const PORT = Number(process.env.PORT || 5000);

// Top-level request logger to ensure every incoming request is recorded for debugging
app.use((req, res, next) => {
  try { safeLog('[TOP-REQ]', req.method, req.originalUrl); } catch (e) { /* ignore */ }
  return next();
});
// Also append a small persistent record for each request to help debugging where stdout may not show
app.use((req, res, next) => {
  try {
    const rec = `${new Date().toISOString()} ${req.method} ${req.originalUrl}\n`;
    try { fs.appendFileSync(path.join(process.cwd(), 'debug_requests.log'), rec, { encoding: 'utf8' }); } catch (e) { safeLog('debug log write failed:', e?.message || String(e)); }
  } catch (e) { /* ignore */ }
  return next();
});

function safeLog(...args) { try { console.log(...args); } catch (e) { /* ignore */ } }
 
// Global safety handlers to avoid process exit on uncaught errors during runtime
process.on('uncaughtException', (err) => {
  try { safeLog('UncaughtException:', err && err.stack ? err.stack : String(err)); } catch (_) { /* ignore */ }
});
process.on('unhandledRejection', (reason) => {
  try { safeLog('UnhandledRejection:', reason && reason.stack ? reason.stack : String(reason)); } catch (_) { /* ignore */ }
});
app.use(bodyParser.json({ limit: '5mb', verify: (req, _res, buf) => { req.rawBody = buf; } }));

// Explicit admin endpoints registered early to guarantee availability
app.get('/admin/health', (_req, res) => res.json({ ok: true, commit: process.env.RENDER_GIT_COMMIT || process.env.COMMIT_SHA || null }));
app.get('/admin/routes', (_req, res) => {
  try {
    const routes = [];
    const stack = (app._router && app._router.stack) || [];
    stack.forEach((layer) => {
      try {
        if (layer.route) routes.push({ path: layer.route.path, methods: Object.keys(layer.route.methods) });
      } catch (e) { /* ignore */ }
    });
    return res.json({ ok: true, routes });
  } catch (e) { return res.status(500).json({ ok: false, error: e?.message || String(e) }); }
});
app.get('/admin/redis-ping', async (_req, res) => {
  try {
    const client = app.locals && app.locals.redis;
    if (!client) return res.status(500).json({ status: 'no redis client' });
    const pong = await client.ping();
    return res.json({ status: 'ok', pong });
  } catch (err) { return res.status(500).json({ status: 'error', message: err?.message || String(err) }); }
});

function buildPgPoolConfig() {
  const cfg = { connectionString: process.env.DATABASE_URL };
  const mode = String(process.env.PGSSLMODE || '').toLowerCase();
  if (process.env.DATABASE_URL && mode && mode !== 'disable') {
    if (mode === 'verify-ca' || mode === 'verify-full') {
      cfg.ssl = { rejectUnauthorized: true };
      if (process.env.PGSSLROOTCERT) {
        try { cfg.ssl.ca = fs.readFileSync(process.env.PGSSLROOTCERT, 'utf8'); } catch (e) { safeLog('Could not read PGSSLROOTCERT:', e?.message || String(e)); }
      }
    } else {
      cfg.ssl = { rejectUnauthorized: false };
    }
  }
  return cfg;
}

let pool = null;
try {
  pool = new Pool(buildPgPoolConfig());
  // Prevent pool errors from crashing the process
  pool.on && pool.on('error', (err) => safeLog('Postgres pool error:', err?.message || String(err)));
  // do NOT assume the pool is healthy until we test it in initServices()
  app.locals.pool = pool;
} catch (e) {
  safeLog('Failed to create Postgres pool:', e?.message || String(e));
  pool = null;
  app.locals.pool = null;
}

// Optional Redis client (supports ACL username + password and TLS 'rediss://')
let redisClient = null;
const redisUrl = process.env.REDIS_URL || process.env.REDIS_URI || '';
const redisUsername = process.env.REDIS_USERNAME || process.env.REDIS_USER || undefined;
const redisPassword = process.env.REDIS_PASSWORD || process.env.REDIS_PWD || undefined;
if (redisUrl) {
  try {
    // Create client; actual connect attempts are performed in initServices()
    redisClient = createClient({ url: redisUrl, username: redisUsername || undefined, password: redisPassword || undefined, socket: { tls: String(redisUrl).startsWith('rediss://') } });
    redisClient.on('error', (err) => safeLog('Redis error:', err?.message || String(err)));
  } catch (e) { safeLog('Failed to create Redis client:', e?.message || String(e)); redisClient = null; }
} else { safeLog('REDIS_URL not set; skipping Redis client initialization'); }
app.locals.redis = redisClient;

// Helper to attempt async operation with retries
async function withRetries(fn, { attempts = 3, delayMs = 500 } = {}) {
  let lastErr = null;
  for (let i = 1; i <= attempts; i++) {
    try { return await fn(i); } catch (e) { lastErr = e; safeLog(`attempt ${i} failed:`, e?.message || String(e)); if (i < attempts) await new Promise(r => setTimeout(r, delayMs * i)); }
  }
  throw lastErr;
}

// Init services (DB + Redis) with retries. This will not throw to top-level; callers can await it.
async function initServices({ pgAttempts = 4, redisAttempts = 3, timeoutMs = 20000 } = {}) {
  safeLog('initServices: starting');
  const start = Date.now();
  // Test Postgres connectivity
  if (app.locals.pool) {
    try {
      await withRetries(async () => {
        const client = await app.locals.pool.connect();
        try { await client.query('SELECT 1'); } finally { client.release(); }
      }, { attempts: pgAttempts, delayMs: 600 });
      safeLog('Postgres connected and verified');
    } catch (e) {
      safeLog('Postgres verification failed:', e?.message || String(e));
      // leave pool in app.locals to allow runtime queries to fallback and not crash
    }
  }

  // Test Redis connectivity if a client was created
  if (app.locals.redis) {
    try {
      await withRetries(async () => {
        if (!app.locals.redis.isOpen) await app.locals.redis.connect();
        const p = await app.locals.redis.ping();
        safeLog('Redis ping OK:', p);
      }, { attempts: redisAttempts, delayMs: 800 });
    } catch (e) {
      safeLog('Redis verification failed:', e?.message || String(e));
      try { if (app.locals.redis && app.locals.redis.disconnect) await app.locals.redis.disconnect(); } catch (_) { /* ignore */ }
      app.locals.redis = null;
    }
  }

  safeLog('initServices: finished after', Date.now() - start, 'ms');
}

// Mount routers
app.use('/admin', createAdminRouter());
app.use('/webhook', createWebhooksRouter());

// Request-time debug middleware: logs incoming requests and route matching summary
app.use((req, res, next) => {
  try {
    safeLog('[REQ]', req.method, req.originalUrl);
    const stack = (app._router && app._router.stack) || [];
    const summary = [];
    stack.forEach((layer) => {
      try {
        if (layer.route) {
          summary.push({ type: 'route', path: layer.route.path, methods: Object.keys(layer.route.methods) });
        } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
          // attempt to show mount regexp and child routes
          const mount = layer.regexp && layer.regexp.source ? layer.regexp.source : '<mount>'; 
          const children = [];
          layer.handle.stack.forEach((l) => { if (l.route) children.push({ path: l.route.path, methods: Object.keys(l.route.methods) }); });
          summary.push({ type: 'router', mount, children });
        }
      } catch (e) { /* ignore per-layer */ }
    });
    safeLog('[ROUTES-SUMMARY]', JSON.stringify(summary));
  } catch (e) { safeLog('Request-time debug middleware error:', String(e)); }
  return next();
});

// Explicit redis-ping endpoint
app.get('/admin/redis-ping', async (_req, res) => {
  try {
    const client = app.locals && app.locals.redis;
    if (!client) return res.status(500).json({ status: 'no redis client' });
    const pong = await client.ping();
    return res.json({ status: 'ok', pong });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err?.message || String(err) });
  }
});

// App-level diagnostic: list registered routes (reliable regardless of router mounting variations)
app.get('/admin/routes', (_req, res) => {
  try {
    const routes = [];
    const stack = (app._router && app._router.stack) || [];
    stack.forEach((layer) => {
      try {
        if (layer.route) {
          routes.push({ path: layer.route.path, methods: Object.keys(layer.route.methods) });
        } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
          // Try to extract mount path from the regexp
          const mountPath = layer.regexp && layer.regexp.source ? layer.regexp.source : '';
          layer.handle.stack.forEach((l) => {
            if (l.route) routes.push({ path: (mountPath || '') + l.route.path, methods: Object.keys(l.route.methods) });
          });
        }
      } catch (e) { /* ignore per-layer */ }
    });
    return res.json({ ok: true, routes });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

export function registerDataExposureAPI(_sportsAggregator) { try { safeLog('DATA_EXPOSURE: registerDataExposureAPI called (no-op in migration)'); } catch (e) { safeLog('DATA_EXPOSURE registration failed:', String(e)); } }

// Final 404 logger: capture and persist any unmatched requests for debugging
app.use((req, res) => {
  try {
    const rec = `${new Date().toISOString()} 404 ${req.method} ${req.originalUrl} headers=${JSON.stringify(req.headers || {})}\n`;
    try { fs.appendFileSync(path.join(process.cwd(), 'debug_404.log'), rec, { encoding: 'utf8' }); } catch (e) { safeLog('debug_404 write failed:', e?.message || String(e)); }
  } catch (e) { /* ignore */ }
  return res.status(404).send('Not Found');
});

export default app;

// Start server when invoked directly. Place listen at the end after all middleware/routes registered
if (process.argv[1] && String(process.argv[1]).endsWith('src/app.js')) {
  (async () => {
    try {
      // wait for initServices but don't block forever
      const initPromise = initServices();
      const timeoutMs = Number(process.env.SERVICE_INIT_TIMEOUT_MS || 10000);
      await Promise.race([
        initPromise,
        new Promise((_, rej) => setTimeout(() => rej(new Error('init timeout')), timeoutMs))
      ]).catch((e) => {
        safeLog('Service init did not complete before timeout or failed:', e?.message || String(e));
      });

      const server = app.listen(PORT, () => {
        safeLog(`Server running on port ${PORT}`);
        try {
          // Log registered routes at startup to help debug missing-route issues in deployments
          const routes = [];
          const stack = (app._router && app._router.stack) || [];
          stack.forEach((layer) => {
            try {
              if (layer.route) routes.push({ path: layer.route.path, methods: Object.keys(layer.route.methods) });
              else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
                const mount = layer.regexp && layer.regexp.source ? layer.regexp.source : '<mount>';
                const children = [];
                layer.handle.stack.forEach((l) => { if (l.route) children.push({ path: l.route.path, methods: Object.keys(l.route.methods) }); });
                routes.push({ type: 'router', mount, children });
              }
            } catch (e) { /* ignore per-layer errors */ }
          });
          safeLog('REGISTERED_ROUTES', JSON.stringify(routes));
        } catch (e) { safeLog('Failed to enumerate routes:', String(e)); }
      });
      server.on('error', (err) => safeLog('Server error:', err?.message || String(err)));
    } catch (e) {
      safeLog('Failed to start server (init path):', e?.message || String(e));
      try {
        // fallback: attempt to start server anyway
        const server = app.listen(PORT, () => {
          safeLog(`Server running on port ${PORT} (fallback start)`);
          try {
            const routes = [];
            const stack = (app._router && app._router.stack) || [];
            stack.forEach((layer) => {
              try {
                if (layer.route) routes.push({ path: layer.route.path, methods: Object.keys(layer.route.methods) });
                else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
                  const mount = layer.regexp && layer.regexp.source ? layer.regexp.source : '<mount>';
                  const children = [];
                  layer.handle.stack.forEach((l) => { if (l.route) children.push({ path: l.route.path, methods: Object.keys(l.route.methods) }); });
                  routes.push({ type: 'router', mount, children });
                }
              } catch (e) { /* ignore per-layer errors */ }
            });
            safeLog('REGISTERED_ROUTES', JSON.stringify(routes));
          } catch (e) { safeLog('Failed to enumerate routes:', String(e)); }
        });
        server.on('error', (err) => safeLog('Server error:', err?.message || String(err)));
      } catch (err) { safeLog('Fallback start failed:', err?.message || String(err)); }
    }
  })();
}


