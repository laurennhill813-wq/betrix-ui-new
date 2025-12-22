/**
 * BETRIX Express Server
 * HTTP API + Telegram Webhook + Admin Dashboard
 */

import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { Logger } from "./utils/logger.js";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { betrixIngest } from "./lib/betrix-ingest.js";
import { MpesaCallbackHandler } from "./middleware/mpesa-callback.js";
import { updateStatusByProviderEventId } from "./lib/local-payments.js";
import { verifyAndActivatePayment } from "./handlers/payment-router.js";
import jobsRouter from "./routes/jobs.js";
import { cacheSet, getRedisClient } from "./lib/redis-cache.js";
import createAdminRouter from "./routes/admin.js";
import footballRouter from "./routes/football.js";
import { getMetrics as getLivelinessMetrics } from "./lib/liveliness.js";
import { aggregateFixtures } from "./lib/fixtures-aggregator.js";

const logger = new Logger("Server");
const app = express();

// Middleware
app.use(helmet());
app.use(cors());
// capture raw body for signature verification while still parsing JSON
app.use(
  express.json({
    limit: "10mb",
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  }),
);

// Rate limiting (registered after health/readiness endpoints so probes aren't rate-limited)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date(), service: "BETRIX" });
});

// Readiness / liveliness endpoint (used by platform health checks)
app.get("/ready", async (req, res) => {
  try {
    const metrics = await getLivelinessMetrics();
    return res.json({ status: "ok", timestamp: new Date(), metrics });
  } catch (e) {
    logger.warn("Readiness check failed", e && e.message ? e.message : e);
    return res
      .status(500)
      .json({ status: "error", error: "readiness check failed" });
  }
});

// RapidAPI health endpoint: expose unified per-sport fixture totals
app.get("/health/rapidapi", async (_req, res) => {
  try {
    const client = getRedisClient();
    if (!client) return res.status(503).json({ ok: false, reason: "no_redis" });
    try {
      const agg = await aggregateFixtures(client).catch(() => null);
      if (agg) {
        const sportsMap = {};
        for (const [s, counts] of Object.entries(agg.bySport || {})) {
          sportsMap[s] = { live: Number(counts.live || 0), upcoming: Number(counts.upcoming || 0) };
        }
        return res.json({ ok: true, unified: { liveMatches: agg.totalLiveMatches, upcomingFixtures: agg.totalUpcomingFixtures, providers: agg.providers, sports: sportsMap } });
      }
    } catch (e) {
      // fall through to 500 below
    }
    return res.status(200).json({ ok: true, cached: false, message: "no rapidapi health data" });
    } catch (err) {
    logger.error("/health/rapidapi error", err && err.message ? err.message : err);
    return res.status(500).json({ ok: false, error: err && err.message ? err.message : String(err) });
  }
});

// Startup visibility: confirm this route is registered when the server starts
try {
  console.log("/health/rapidapi registered");
} catch (e) {}

// Write a Redis startup marker so boot can be verified programmatically.
// Uses deploy id from environment when available, otherwise falls back to
// a generic "registered" marker. Uses `cacheSet` so it works with the
// in-memory fallback when no REDIS_URL is configured (useful in tests).
  (async () => {
    try {
      // Prefer a deploy-id when provided by the platform; otherwise fall back
      // to commit SHA, then the Render service id as a stable identifier.
      const deployId =
        process.env.RENDER_DEPLOY_ID ||
        process.env.COMMIT_SHA ||
        process.env.RENDER_SERVICE_ID ||
        null;

      // Always set the global registered marker with a 24-hour TTL
      const ttlSeconds = 60 * 60 * 24;
      const globalKey = `rapidapi:startup:registered`;
      await cacheSet(globalKey, 'registered', ttlSeconds);
      console.log(`[startup] Redis marker ${globalKey}=registered`);

      // Also set a deploy-specific key when we have a deploy identifier
      if (deployId) {
        try {
          const key = `rapidapi:startup:${deployId}`;
          await cacheSet(key, 'registered', ttlSeconds);
          console.log(`[startup] Redis marker ${key}=registered`);
        } catch (innerErr) {
          console.warn(
            '[startup] failed to write deploy-specific redis startup marker',
            innerErr && innerErr.message ? innerErr.message : innerErr,
          );
        }
      }
    } catch (e) {
      console.warn('[startup] failed to write redis startup marker', e && e.message ? e.message : e);
    }
  })();

// Apply rate limiter after health/readiness endpoints so platform probes are not blocked
app.use(limiter);

// Jobs route (auto media trigger)
app.use("/api", jobsRouter);
// Admin routes
app.use("/api", createAdminRouter());

// Football / NFL proxy routes (server-side proxy to RapidAPI)
app.use("/api/football", footballRouter);

// Telegram webhook
app.post("/webhook/telegram", async (req, res) => {
  try {
    // Lightweight logging: don't print full webhook payloads in production.
    // Log only the resolved chat id (if present). Keep the DEBUG flag for
    // temporarily enabling full payload dumps when needed.
    try {
      const _chatLogId =
        req?.body?.message?.chat?.id ||
        req?.body?.edited_message?.chat?.id ||
        req?.body?.channel_post?.chat?.id ||
        null;
      console.log("[WEBHOOK] Received Telegram update", { chatId: _chatLogId });
    } catch (e) {
      /* ignore logging errors */
    }

    // Debug logging gated by env flag (kept for backward compatibility)
    if (
      String(process.env.DEBUG_TELEGRAM_UPDATES || "").toLowerCase() === "true"
    ) {
      try {
        console.log(
          "[TELEGRAM UPDATE RAW - DEBUG_FLAG]",
          JSON.stringify(req.body, null, 2),
        );
      } catch (e) {
        console.log("[TELEGRAM UPDATE RAW] <unserializable>");
      }
    }

    // Persist last seen chat id to Redis for quick extraction (best-effort)
    try {
      const chatId =
        req?.body?.message?.chat?.id ||
        req?.body?.edited_message?.chat?.id ||
        req?.body?.channel_post?.chat?.id ||
        null;
      if (chatId) {
        // store as string under betrix:last_chat_id with 7-day TTL
        await cacheSet("betrix:last_chat_id", String(chatId), 60 * 60 * 24 * 7);
      }
    } catch (e) {
      console.warn(
        "failed to persist last chat id",
        e && e.message ? e.message : e,
      );
    }

    // Enqueue the full Telegram update into the worker queue so the background
    // worker can process and respond. This uses a Redis LIST `telegram:updates`.
    try {
      const client = getRedisClient();
      if (client) {
        try {
          await client.rPush("telegram:updates", JSON.stringify(req.body));
          console.log("[WEBHOOK] Enqueued Telegram update");
        } catch (e) {
          console.warn(
            "[WEBHOOK] failed to enqueue telegram update",
            e && e.message ? e.message : e,
          );
        }
      } else {
        console.warn("[WEBHOOK] No Redis client available; skipping enqueue");
      }
    } catch (e) {
      console.warn(
        "[WEBHOOK] enqueue step failed",
        e && e.message ? e.message : e,
      );
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    logger.error("Webhook error", err);
    res.status(500).json({ ok: false });
  }
});

// M-Pesa callback
app.post("/webhook/mpesa", async (req, res) => {
  try {
    // Prefer Lipana signature header (case-insensitive)
    const signatureHeader =
      req.headers["x-lipana-signature"] ||
      req.headers["x-signature"] ||
      req.headers["x-lipana-hmac"] ||
      "";
    const secret = process.env.LIPANA_SECRET;

    if (!secret) {
      logger.error("LIPANA_SECRET not configured");
      return res.status(500).json({ ok: false, error: "server misconfigured" });
    }

    const raw = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
    const computed = crypto
      .createHmac("sha256", secret)
      .update(raw)
      .digest("hex");

    // Use timingSafeEqual to avoid timing attacks
    const valid =
      signatureHeader &&
      (() => {
        try {
          return crypto.timingSafeEqual(
            Buffer.from(computed),
            Buffer.from(signatureHeader),
          );
        } catch (e) {
          return false;
        }
      })();

    if (!valid) {
      const logDir = path.join(process.cwd(), "logs");
      const logPath = path.join(logDir, "webhook.log");
      const logEntry = `${new Date().toISOString()} INVALID signature=${signatureHeader} computed=${computed}\n`;
      try {
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
        fs.appendFileSync(logPath, logEntry);
      } catch (e) {
        logger.error("log write failed", e);
      }
      logger.warn("Invalid Lipana signature");
      return res.status(401).send("Invalid signature");
    }

    // Verified
    const payloadText = raw.toString("utf8");
    let payload = {};
    try {
      payload = JSON.parse(payloadText);
    } catch (e) {
      payload = req.body || {};
    }

    const logDir = path.join(process.cwd(), "logs");
    const logPath = path.join(logDir, "webhook.log");
    const logEntry = `${new Date().toISOString()} VERIFIED event=${payload.event || "unknown"} payload=${payloadText}\n`;
    try {
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      fs.appendFileSync(logPath, logEntry);
    } catch (e) {
      logger.error("log write failed", e);
    }

    // Hand off to ingestion adapter (persist or queue)
    try {
      await betrixIngest(payload);
    } catch (err) {
      logger.error("Ingest failed", err);
      // continue; we still return 200 to the provider to avoid retries
    }

    // If this webhook refers to a local pending payment, update it (simulation-friendly)
    try {
      const providerEventId =
        payload &&
        payload.data &&
        (payload.data.id || payload.data.transaction_id);
      if (providerEventId) {
        const updated = updateStatusByProviderEventId(
          providerEventId,
          "success",
          { provider: "lipana" },
        );
        if (updated)
          logger.info(
            "Local payment updated from webhook",
            updated.id || updated.tx_ref,
          );
      }
    } catch (e) {
      logger.error("Local payment update failed", e);
    }

    // Also call the existing Mpesa handler if this looks like a Daraja/Daraja STK body
    try {
      if (req.body && req.body.Body && req.body.Body.stkCallback) {
        const handler = new MpesaCallbackHandler();
        await handler.handleCallback(req, res);
        return; // handler will have responded
      }
    } catch (err) {
      // If the Mpesa handler throws, we've already ingested; log and respond OK
      logger.info(
        "MpesaCallbackHandler did not complete, but webhook verified and ingested",
        err,
      );
      return res.status(200).json({ ok: true });
    }

    // Default OK response for non-Daraja webhooks
    return res.status(200).json({ ResultCode: 0, ResultDesc: "Received" });

    // NowPayments webhook
    app.post("/webhook/nowpayments", async (req, res) => {
      try {
        const raw = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
        const headerSig =
          req.headers["x-nowpayments-signature"] ||
          req.headers["x-signature"] ||
          req.headers["x-api-signature"] ||
          "";
        // Lazy import of service to verify signature
        try {
          const nowSvc = await import("./payments/nowpayments_v2.js");
          const verified = nowSvc.default.verifySignature(raw, headerSig);
          if (!verified) {
            logger.warn("Invalid NowPayments signature");
            return res.status(401).send("Invalid signature");
          }
        } catch (e) {
          logger.error(
            "NowPayments signature verification failed",
            e?.message || e,
          );
          return res.status(500).send("server misconfigured");
        }

        let payload = {};
        try {
          payload = JSON.parse(raw.toString("utf8"));
        } catch (e) {
          payload = req.body || {};
        }

        // Log webhook event
        try {
          const logDir = path.join(process.cwd(), "logs");
          if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
          fs.appendFileSync(
            path.join(logDir, "nowpayments-webhook.log"),
            `${new Date().toISOString()} ${JSON.stringify(payload)}\n`,
          );
        } catch (e) {
          logger.warn(
            "Failed to persist nowpayments webhook log",
            e?.message || e,
          );
        }

        // Determine status and attempt to credit user
        const data = payload && (payload.data || payload);
        const providerRef =
          data && (data.id || data.invoice_id || data.payment_id || payload.id);
        const status =
          (data && (data.status || data.payment_status || data.state)) ||
          payload.status ||
          payload.event;
        const meta =
          data && data.metadata ? data.metadata : payload.metadata || {};
        const orderId =
          meta && (meta.orderId || meta.order_id)
            ? meta.orderId || meta.order_id
            : data && (data.order_id || data.external_id)
              ? data.order_id || data.external_id
              : null;

        // Terminal statuses vary: consider 'finished', 'paid', 'successful' as completion
        const s = String(status || "").toLowerCase();
        if (
          s.includes("finished") ||
          s.includes("paid") ||
          s.includes("successful") ||
          s === "confirmed"
        ) {
          try {
            // Prefer local orderId mapping; fall back to providerRef lookup
            const redisClient = getRedisClient();
            if (orderId) {
              try {
                if (redisClient)
                  await verifyAndActivatePayment(
                    redisClient,
                    orderId,
                    providerRef || `now-${Date.now()}`,
                  );
              } catch (e) {
                logger.warn(
                  "verifyAndActivatePayment failed for orderId",
                  e?.message || e,
                );
              }
            } else if (providerRef && redisClient) {
              try {
                const key = await redisClient.get(
                  `payment:by_provider_ref:NOWPAYMENTS:${providerRef}`,
                );
                if (key) {
                  await verifyAndActivatePayment(redisClient, key, providerRef);
                }
              } catch (e) {
                logger.warn(
                  "Failed to lookup order by providerRef",
                  e?.message || e,
                );
              }
            }
          } catch (e) {
            logger.error(
              "Failed to credit user for nowpayments webhook",
              e?.message || e,
            );
          }
        }

        // Ingest event for analytics/archival
        try {
          await betrixIngest(payload);
        } catch (e) {
          logger.warn("betrixIngest failed for nowpayments", e?.message || e);
        }

        res.status(200).json({ ok: true });
      } catch (err) {
        logger.error("NowPayments webhook handler error", err?.message || err);
        res.status(500).json({ ok: false });
      }
    });
  } catch (err) {
    logger.error("M-Pesa webhook error", err);
    res.status(500).json({ ok: false });
  }
});

// Start server
let _server = null;

export function startServer(options = {}) {
  // If server already started and listening, return same instance (idempotent)
  try {
    if (_server && _server.listening) return _server;
  } catch (e) {
    _server = null;
  }

  const PORT = (options && options.port != null) ? Number(options.port) : (process.env.PORT ? Number(process.env.PORT) : 5000);
  const HOST = process.env.HOST || "0.0.0.0";
  const server = app.listen(PORT, HOST, () => {
    const addr = server.address && server.address();
    const usedPort = addr && addr.port ? addr.port : PORT;
    logger.info(`🚀 Server on port ${usedPort}`);
  });
  _server = server;

  // Clear module-level server reference when closed so tests can restart cleanly
  server.on('close', () => { try { _server = null; } catch (e) { /**/ } });

  function shutdown(signal) {
    try {
      logger.info(`Received ${signal} - shutting down gracefully`);
      // stop accepting new connections
      server.close(() => {
        logger.info("Server closed cleanly");
        process.exit(0);
      });

      // force exit if close doesn't complete in time
      setTimeout(() => {
        logger.error("Graceful shutdown timed out, forcing exit");
        process.exit(1);
      }, 10000).unref();
    } catch (e) {
      logger.error("Error during shutdown", e);
      process.exit(1);
    }
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  process.on("uncaughtException", (err) => {
    logger.error(
      "uncaughtException - exiting",
      err && err.stack ? err.stack : err,
    );
    // allow logs to flush then exit
    try {
      setTimeout(() => process.exit(1), 100);
    } catch (e) {
      process.exit(1);
    }
  });

  process.on("unhandledRejection", (reason, promise) => {
    logger.error("unhandledRejection", { reason, promise });
  });

  return server;
}

export { app };
