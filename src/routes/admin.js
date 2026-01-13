import express from "express";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { cacheGet, getRaw } from "../lib/redis-cache.js";
import { getMetrics } from "../lib/liveliness.js";
import { adminAuth } from "../middleware/admin-auth.js";
import mediaRouter from "../media/mediaRouter.js";
import { broadcastPhoto, broadcastText } from "../telegram/broadcast.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { runMediaAiTick } = require("../tickers/mediaAiTicker.cjs");
import { probeSportradarCapabilities } from "../services/providers/sportradar.js";
import tls from "tls";
import { URL } from "url";

export default function createAdminRouter() {
  const router = express.Router();

  // Protect admin routes with ADMIN_API_KEY when configured
  router.use("/admin", adminAuth);

  // Return last seen chat id stored in Redis (best-effort)
  router.get("/admin/last-chat", async (req, res) => {
    try {
      const id = await cacheGet("betrix:last_chat_id");
      return res.json({ ok: true, last_chat_id: id || null });
    } catch (e) {
      return res.status(500).json({ ok: false, error: String(e) });
    }
  });

  // Health endpoint that aggregates liveliness metrics
  router.get("/admin/health", async (req, res) => {
    try {
      const metrics = await getMetrics();
      return res.json({ ok: true, liveliness: metrics });
    } catch (e) {
      return res.status(500).json({ ok: false, error: String(e) });
    }
  });

  // Additional diagnostics (mounted under /admin when router is used)
  router.get("/health", (_req, res) =>
    res.json({
      ok: true,
      commit: process.env.RENDER_GIT_COMMIT || process.env.COMMIT_SHA || null,
    }),
  );

  router.get("/queue", (_req, res) =>
    res.json({
      ok: true,
      commit: process.env.RENDER_GIT_COMMIT || process.env.COMMIT_SHA || null,
    }),
  );

  router.get("/redis-ping", async (req, res) => {
    try {
      const client = req.app && req.app.locals && req.app.locals.redis;
      if (!client) return res.status(500).json({ status: "no redis client" });
      const pong = await client.ping();
      return res.json({ status: "ok", pong });
    } catch (err) {
      return res
        .status(500)
        .json({ status: "error", message: err?.message || String(err) });
    }
  });

  router.get("/webhook-fallback", (_req, res) => {
    try {
      const logPath = path.join(process.cwd(), "webhooks.log");
      if (!fs.existsSync(logPath)) return res.json({ ok: true, entries: [] });
      const txt = fs.readFileSync(logPath, "utf8");
      const lines = txt.split(/\r?\n/).filter(Boolean).slice(-200);
      const parsed = lines.map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return { raw: l };
        }
      });
      return res.json({ ok: true, entries: parsed });
    } catch (e) {
      return res
        .status(500)
        .json({ ok: false, error: e?.message || String(e) });
    }
  });

  // Admin: test media lookup and optional broadcast (protected by adminAuth)
  // POST /admin/test-media
  // Body: { match?: object, event?: object, caption?: string, autoBroadcast?: boolean }
  router.post("/admin/test-media", async (req, res) => {
    try {
      const {
        match = {},
        event = {},
        caption = "",
        autoBroadcast = false,
      } = req.body || {};
      const best = await mediaRouter.getBestImageForEvent({ event, match });
      const out = { ok: true, best };

      if (autoBroadcast) {
        if (!process.env.BOT_BROADCAST_CHAT_ID) {
          return res
            .status(400)
            .json({ ok: false, error: "BOT_BROADCAST_CHAT_ID not configured" });
        }
        // attempt to broadcast the photo (best-effort)
        try {
          const resp = await broadcastPhoto(best.imageUrl, caption || "", {});
          out.broadcast = { ok: true, resp };
        } catch (bErr) {
          out.broadcast = { ok: false, error: String(bErr) };
        }
      }

      return res.json(out);
    } catch (e) {
      return res
        .status(500)
        .json({ ok: false, error: e?.message || String(e) });
    }
  });

  // Diagnostic: list registered routes on the app
  router.get("/routes", (_req, res) => {
    try {
      const app = _req.app || (_req.router && _req.router.app);
      const routes = [];
      const stack = (app && app._router && app._router.stack) || [];
      stack.forEach((layer) => {
        try {
          if (layer.route) {
            routes.push({
              path: layer.route.path,
              methods: Object.keys(layer.route.methods),
            });
          } else if (
            layer.name === "router" &&
            layer.handle &&
            layer.handle.stack
          ) {
            // find mount path if present
            const mountPath =
              layer.regexp && layer.regexp.fast_slash
                ? ""
                : (layer.regexp && layer.regexp.source) || "";
            layer.handle.stack.forEach((l) => {
              if (l.route)
                routes.push({
                  path: (mountPath || "") + l.route.path,
                  methods: Object.keys(l.route.methods),
                });
            });
          }
        } catch (e) {
          /* ignore per-layer errors */
        }
      });
      return res.json({ ok: true, routes });
    } catch (e) {
      return res
        .status(500)
        .json({ ok: false, error: e?.message || String(e) });
    }
  });

  // Admin: inspect SportMonks TLS certificate via existing script
  // POST /admin/inspect-sportmonks
  router.post("/admin/inspect-sportmonks", async (req, res) => {
    try {
      const scriptPath = path.join(
        process.cwd(),
        "scripts",
        "inspect-sportmonks-cert.js",
      );
      if (!fs.existsSync(scriptPath))
        return res
          .status(404)
          .json({ ok: false, error: "inspect script not found" });

      // Run the script with a safe timeout and capture stdout/stderr
      const childArgs = [scriptPath];
      const opts = { timeout: 20000, env: Object.assign({}, process.env) };

      execFile("node", childArgs, opts, (err, stdout, stderr) => {
        if (err) {
          // include stdout/stderr for diagnostics even on error
          return res.status(500).json({
            ok: false,
            error: err.message,
            stdout: String(stdout || "").slice(0, 20000),
            stderr: String(stderr || "").slice(0, 20000),
          });
        }
        return res.json({
          ok: true,
          stdout: String(stdout || "").slice(0, 20000),
          stderr: String(stderr || "").slice(0, 20000),
        });
      });
    } catch (e) {
      return res
        .status(500)
        .json({ ok: false, error: e?.message || String(e) });
    }
  });

  // Admin: inspect Sportradar endpoints + TLS peer certificate
  // POST /admin/inspect-sportradar
  router.post("/admin/inspect-sportradar", async (req, res) => {
    try {
      const base = process.env.SPORTRADAR_BASE || "https://api.sportradar.com";
      const date = (req.body && req.body.date) || null;

      // Run the probe which will attempt candidate endpoints
      const probe = await probeSportradarCapabilities("soccer", date, { base });

      // Attempt a TLS peer certificate inspection against the base host
      let certInfo = null;
      try {
        const u = new URL(base);
        const host = u.hostname || "api.sportradar.com";
        const port = Number(u.port) || 443;
        const socket = tls.connect({
          host,
          port,
          servername: host,
          rejectUnauthorized: false,
          timeout: 8000,
        });

        certInfo = await new Promise((resolve, reject) => {
          socket.once("error", (err) => {
            try {
              socket.destroy();
            } catch {}
            reject(err);
          });
          socket.once("timeout", () => {
            try {
              socket.destroy();
            } catch {}
            reject(new Error("TLS connect timeout"));
          });
          socket.once("secureConnect", () => {
            try {
              const peer = socket.getPeerCertificate(true) || null;
              const details = peer
                ? {
                    subject: peer.subject,
                    issuer: peer.issuer,
                    valid_from: peer.valid_from,
                    valid_to: peer.valid_to,
                    fingerprint: peer.fingerprint,
                    pem: peer.raw ? peer.raw.toString("base64") : undefined,
                  }
                : null;
              socket.end();
              resolve(details);
            } catch (e) {
              try {
                socket.destroy();
              } catch {}
              reject(e);
            }
          });
        });
      } catch (e) {
        certInfo = { error: String(e) };
      }

      return res.json({ ok: true, probe, cert: certInfo });
    } catch (e) {
      return res
        .status(500)
        .json({ ok: false, error: e?.message || String(e) });
    }
  });

  // Admin: trigger Media AI ticker immediately (protected)
  // POST /admin/trigger-media-ai
  router.post("/admin/trigger-media-ai", async (req, res) => {
    try {
      // The ticker itself performs its own checks; we run it and return status
      await runMediaAiTick();
      return res.json({
        ok: true,
        message: "Media AI ticker executed (check worker logs for details)",
      });
    } catch (e) {
      return res
        .status(500)
        .json({ ok: false, error: e?.message || String(e) });
    }
  });

  // Admin: test-send endpoint to trigger a single Telegram send for testing
  // POST /admin/test-send
  // Body: { type: 'photo'|'text', chat_id?: string, photoUrl?: string, caption?: string, text?: string }
  router.post("/admin/test-send", async (req, res) => {
    try {
      const body = req.body || {};
      const type = String(body.type || "").toLowerCase();
      const chatId = body.chat_id || process.env.BOT_BROADCAST_CHAT_ID || null;
      if (!chatId)
        return res.status(400).json({
          ok: false,
          error:
            "chat_id not provided and BOT_BROADCAST_CHAT_ID not configured",
        });

      if (type === "photo") {
        const photoUrl = body.photoUrl;
        if (!photoUrl)
          return res
            .status(400)
            .json({ ok: false, error: "photoUrl required for photo send" });
        try {
          const resp = await broadcastPhoto(
            photoUrl,
            String(body.caption || ""),
            { chatId },
          );
          return res.json({ ok: true, type: "photo", resp });
        } catch (sendErr) {
          return res.status(500).json({ ok: false, error: String(sendErr) });
        }
      } else if (type === "text") {
        const text = String(body.text || "Test message from admin");
        try {
          const resp = await broadcastText(text, { chatId });
          return res.json({ ok: true, type: "text", resp });
        } catch (sendErr) {
          return res.status(500).json({ ok: false, error: String(sendErr) });
        }
      } else {
        return res.status(400).json({
          ok: false,
          error: 'invalid type - must be "photo" or "text"',
        });
      }
    } catch (e) {
      return res
        .status(500)
        .json({ ok: false, error: e?.message || String(e) });
    }
  });

  // Admin: expose provider bootstrap & runtime provider status
  // GET /admin/providers
  router.get("/admin/providers", async (req, res) => {
    try {
      // Try to read the last bootstrap status stored by APIBootstrap
      const bootstrap = await cacheGet("betrix:api:bootstrap:status");
      // Strategy and prefetch keys are stored as raw strings in Redis
      const sportsmonksStrategy = await getRaw(
        "betrix:provider:strategy:sportsmonks",
      );
      const prefetchNext = await getRaw("prefetch:next:sportsmonks");
      const sportradarHealth = await cacheGet(
        "betrix:provider:health:sportradar",
      );

      return res.json({
        ok: true,
        bootstrap: bootstrap || null,
        sportsmonksStrategy: sportsmonksStrategy || null,
        prefetchNext: prefetchNext ? Number(prefetchNext) : null,
        sportradarHealth: sportradarHealth || null,
      });
    } catch (e) {
      return res
        .status(500)
        .json({ ok: false, error: e?.message || String(e) });
    }
  });

  // Admin: prefetch/provider health summary
  router.get('/admin/prefetch-health', async (req, res) => {
    try {
      const redis = req.app && req.app.locals && req.app.locals.redis;
      if (!redis) return res.status(500).json({ ok: false, error: 'no redis client' });

      // provider health keys
      const healthKeys = await redis.keys('betrix:provider:health:*').catch(() => []);
      const providers = {};
      for (const k of healthKeys.slice(0, 200)) {
        try {
          const raw = await redis.get(k).catch(() => null);
          providers[k.replace('betrix:provider:health:', '')] = raw ? JSON.parse(raw) : null;
        } catch (e) {
          providers[k.replace('betrix:provider:health:', '')] = null;
        }
      }

      // prefetch failures
      const failKeys = await redis.keys('prefetch:failures:*').catch(() => []);
      const failures = {};
      for (const fk of failKeys.slice(0, 200)) {
        try {
          const val = await redis.get(fk).catch(() => null);
          failures[fk.replace('prefetch:failures:', '')] = val ? Number(val) : 0;
        } catch (e) {
          failures[fk.replace('prefetch:failures:', '')] = null;
        }
      }

      // rapidapi health snapshot (if present)
      let rapidapiHealth = null;
      try {
        const raw = await redis.get('rapidapi:health').catch(() => null);
        rapidapiHealth = raw ? JSON.parse(raw) : null;
      } catch (e) {
        rapidapiHealth = null;
      }

      return res.json({ ok: true, providers, failures, rapidapiHealth });
    } catch (e) {
      return res.status(500).json({ ok: false, error: String(e) });
    }
  });

  return router;
}
