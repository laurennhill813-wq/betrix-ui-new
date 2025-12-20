import { createClient } from "redis";
import createRedisAdapter from "../utils/redis-adapter.js";

let client = null;
let fallbackStore = new Map();

function getClient() {
  if (client) return client;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  client = createClient({ url });
  client.on("error", () => {
    // swallow errors; fall back to in-memory
  });
  try {
    // connect lazily
    client.connect().catch(() => {});
  } catch (e) {}
  return client;
}

export async function cacheGet(key) {
  const c = getClient();
  if (!c) {
    const raw = fallbackStore.get(key);
    return raw === undefined ? null : raw;
  }
  try {
    // If the key exists as a non-string type (list/hash), prefer reading by type
    try {
      if (typeof c.type === 'function') {
        const t = await c.type(key).catch(() => null);
        if (t && t.toLowerCase() === 'list') {
          const arr = await (c.lRange ? c.lRange(key, 0, -1) : c.lrange(key, 0, -1));
          if (!arr || arr.length === 0) return null;
          const parsed = arr
            .map((s) => {
              try {
                return JSON.parse(s);
              } catch {
                return null;
              }
            })
            .filter(Boolean)
            .reverse();
          return parsed;
        }
      }
    } catch (e) {
      // fall back to normal GET
    }

    const v = await c.get(key);
    if (!v) return null;
    return JSON.parse(v);
  } catch (e) {
    // If the key exists but is a different Redis type (e.g. list), try to
    // recover by reading the list entries (common for `context:<id>:history`).
    try {
      const msg = String(e?.message || "").toLowerCase();
      if (msg.includes("wrongtype") || msg.includes("operation against a key holding the wrong kind of value")) {
        try {
          const arr = await c.lRange ? await c.lRange(key, 0, -1) : await c.lrange(key, 0, -1);
          if (!arr || arr.length === 0) return null;
          const parsed = arr
            .map((s) => {
              try {
                return JSON.parse(s);
              } catch {
                return null;
              }
            })
            .filter(Boolean)
            .reverse();
          return parsed;
        } catch (e2) {
          // fall through to fallbackStore below
        }
      }
    } catch {
      // ignore
    }

    // on other errors fall back to in-memory store
    const raw = fallbackStore.get(key);
    return raw === undefined ? null : raw;
  }
}

export async function cacheSet(key, value, ttlSeconds = 60) {
  const c = getClient();
  const raw = JSON.stringify(value);
  if (!c) {
    try {
      fallbackStore.set(key, value);
      return true;
    } catch (e) {
      return false;
    }
  }
  try {
    if (ttlSeconds && ttlSeconds > 0) {
      await c.setEx(key, ttlSeconds, raw);
    } else {
      await c.set(key, raw);
    }
    return true;
  } catch (e) {
    // fall back
    fallbackStore.set(key, value);
    return false;
  }
}

export async function cacheDel(key) {
  const c = getClient();
  if (!c) return fallbackStore.delete(key);
  try {
    await c.del(key);
    return true;
  } catch (e) {
    return false;
  }
}

export function _clearFallback() {
  fallbackStore = new Map();
}

// Atomic increment with optional TTL. Returns numeric value after increment.
export async function incrWithTTL(key, ttlSeconds = 0) {
  const c = getClient();
  if (!c) {
    const raw = fallbackStore.get(key) || 0;
    const next = Number(raw) + 1;
    fallbackStore.set(key, next);
    return next;
  }
  try {
    const val = await c.incr(key);
    if (ttlSeconds && ttlSeconds > 0) {
      try {
        await c.expire(key, ttlSeconds);
      } catch (e) {
        /* ignore */
      }
    }
    return Number(val);
  } catch (e) {
    // fallback
    const raw = fallbackStore.get(key) || 0;
    const next = Number(raw) + 1;
    fallbackStore.set(key, next);
    return next;
  }
}

export async function getRaw(key) {
  const c = getClient();
  if (!c) return fallbackStore.get(key) || null;
  try {
    const v = await c.get(key);
    return v === null ? null : v;
  } catch (e) {
    return fallbackStore.get(key) || null;
  }
}

// Export a function to access the Redis client when callers need to perform
// non-cache operations such as pushing to lists. Returns `null` if no
// `REDIS_URL` configured so callers can gracefully fall back.
export function getRedisClient() {
  const c = getClient();
  if (!c) return null;
  try {
    return createRedisAdapter(c);
  } catch (e) {
    return c;
  }
}
