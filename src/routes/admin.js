import express from 'express';
import fs from 'fs';
import path from 'path';
import { cacheGet } from '../lib/redis-cache.js';
import { getMetrics } from '../lib/liveliness.js';
import { adminAuth } from '../middleware/admin-auth.js';

export default function createAdminRouter() {
  const router = express.Router();

  // Protect admin routes with ADMIN_API_KEY when configured
  router.use('/admin', adminAuth);

  // Return last seen chat id stored in Redis (best-effort)
  router.get('/admin/last-chat', async (req, res) => {
    try {
      const id = await cacheGet('betrix:last_chat_id');
      return res.json({ ok: true, last_chat_id: id || null });
    } catch (e) {
      return res.status(500).json({ ok: false, error: String(e) });
    }
  });

  // Health endpoint that aggregates liveliness metrics
  router.get('/admin/health', async (req, res) => {
    try {
      const metrics = await getMetrics();
      return res.json({ ok: true, liveliness: metrics });
    } catch (e) {
      return res.status(500).json({ ok: false, error: String(e) });
    }
  });

  // Additional diagnostics (mounted under /admin when router is used)
  router.get('/health', (_req, res) => res.json({ ok: true, commit: process.env.RENDER_GIT_COMMIT || process.env.COMMIT_SHA || null }));

  router.get('/queue', (_req, res) => res.json({ ok: true, commit: process.env.RENDER_GIT_COMMIT || process.env.COMMIT_SHA || null }));

  router.get('/redis-ping', async (req, res) => {
    try {
      const client = req.app && req.app.locals && req.app.locals.redis;
      if (!client) return res.status(500).json({ status: 'no redis client' });
      const pong = await client.ping();
      return res.json({ status: 'ok', pong });
    } catch (err) {
      return res.status(500).json({ status: 'error', message: err?.message || String(err) });
    }
  });

  router.get('/webhook-fallback', (_req, res) => {
    try {
      const logPath = path.join(process.cwd(), 'webhooks.log');
      if (!fs.existsSync(logPath)) return res.json({ ok: true, entries: [] });
      const txt = fs.readFileSync(logPath, 'utf8');
      const lines = txt.split(/\r?\n/).filter(Boolean).slice(-200);
      const parsed = lines.map(l => { try { return JSON.parse(l); } catch { return { raw: l }; } });
      return res.json({ ok: true, entries: parsed });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
  });

  // Diagnostic: list registered routes on the app
  router.get('/routes', (_req, res) => {
    try {
      const app = _req.app || _req.router && _req.router.app;
      const routes = [];
      const stack = (app && app._router && app._router.stack) || [];
      stack.forEach((layer) => {
        try {
          if (layer.route) {
            routes.push({ path: layer.route.path, methods: Object.keys(layer.route.methods) });
          } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
            // find mount path if present
            const mountPath = layer.regexp && layer.regexp.fast_slash ? '' : (layer.regexp && layer.regexp.source) || '';
            layer.handle.stack.forEach((l) => {
              if (l.route) routes.push({ path: (mountPath || '') + l.route.path, methods: Object.keys(l.route.methods) });
            });
          }
        } catch (e) { /* ignore per-layer errors */ }
      });
      return res.json({ ok: true, routes });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
  });

  return router;
}
