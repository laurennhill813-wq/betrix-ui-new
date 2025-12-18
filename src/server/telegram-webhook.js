const { createClient } = require("redis");
const { getRedisAdapter } = require("../lib/redis-factory.js");

// Prefer using the central `getRedis` factory if available in the codebase.
// This attempts a dynamic ESM import and falls back to the local shim when
// importing the factory fails (e.g., when run in isolation).
async function getRedis() {
  try {
    const mod = await import("../lib/redis-factory.js");
    if (mod && typeof mod.getRedis === "function") {
      return await mod.getRedis();
    }
  } catch (e) {
    // ignore and fall through to local shim
  }

  if (global.__REDIS_CLIENT && global.__REDIS_CLIENT.isOpen)
    return getRedisAdapter();
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL not set");
  const client = createClient({
    url,
    password: process.env.REDIS_PASSWORD || undefined,
    socket: { reconnectStrategy: () => 1000 },
  });
  client.on("error", (e) =>
    console.error("REDIS_ERR", e && e.stack ? e.stack : String(e)),
  );
  await client.connect();
  global.__REDIS_CLIENT = client;
  return getRedisAdapter();
}

module.exports = async function telegramWebhookHandler(req, res) {
  try {
    const body = req.body || {};
    let client = await getRedis();
    try {
      const { default: createRedisAdapter } =
        await import("../utils/redis-adapter.js");
      client = createRedisAdapter(client);
    } catch (e) {
      // ignore - use raw client
    }

    // Enqueue the raw Telegram update onto the canonical list the worker consumes
    // Worker (src/worker-db.js) expects JSON updates on `telegram:updates` and will
    // JSON.parse the popped value directly into the update object.
    // adapter exposes rPush/rpush/lpush - prefer rPush for tail append semantics
    if (
      typeof client.rPush === "function" ||
      typeof client.rpush === "function"
    ) {
      await (client.rPush
        ? client.rPush("telegram:updates", JSON.stringify(body))
        : client.rpush("telegram:updates", JSON.stringify(body)));
    } else if (
      typeof client.rpush === "undefined" &&
      typeof client.lpush === "function"
    ) {
      // no rpush available, fall back to lpush
      await client.lpush("telegram:updates", JSON.stringify(body));
    } else {
      await client.rPush("telegram:updates", JSON.stringify(body));
    }

    // Keep additional audit/debug queues for observability
    try {
      const auditJob = JSON.stringify({
        jobId: `wh-${Date.now()}`,
        payload: body,
      });
      if (
        typeof client.rPush === "function" ||
        typeof client.rpush === "function"
      ) {
        await (client.rPush
          ? client.rPush("telegram:webhook:queue", auditJob)
          : client.rpush("telegram:webhook:queue", auditJob));
        await (client.rPush
          ? client.rPush("webhooks:incoming", auditJob)
          : client.rpush("webhooks:incoming", auditJob));
      } else if (typeof client.lpush === "function") {
        await client.lpush("telegram:webhook:queue", auditJob);
        await client.lpush("webhooks:incoming", auditJob);
      } else {
        await client.rPush("telegram:webhook:queue", auditJob);
        await client.rPush("webhooks:incoming", auditJob);
      }
      console.log("SHIM_ENQUEUED", { jobId: auditJob.slice(0, 64) });
    } catch (e) {
      console.warn("SHIM_AUDIT_QUEUE_WARN", e && e.message ? e.message : e);
    }

    return res.status(200).json({ ok: true, enqueued: true });
  } catch (err) {
    console.error(
      "SHIM_ENQUEUE_ERR",
      err && err.stack ? err.stack : String(err),
    );
    return res.status(500).json({ ok: false, error: "enqueue_failed" });
  }
};
