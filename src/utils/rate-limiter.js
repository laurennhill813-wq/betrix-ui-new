import logger from "./logger.js";

// Simple token-bucket style rate limiter using Redis for counters and TTLs.
// If `redis` is not provided, uses an in-memory Map fallback (process-local).
export function createRateLimiter(redis) {
  const mem = new Map();

  async function allow(key, limit = 5, windowSeconds = 60) {
    try {
      if (redis && redis.incr) {
        const count = await redis.incr(`rl:${key}`);
        if (count === 1) {
          try {
            await redis.expire(`rl:${key}`, windowSeconds);
          } catch (e) {
            /* ignore */
          }
        }
        return count <= limit;
      }
      // Memory fallback
      const now = Math.floor(Date.now() / 1000);
      const entry = mem.get(key) || { ts: now, count: 0 };
      if (now - entry.ts >= windowSeconds) {
        entry.ts = now;
        entry.count = 1;
        mem.set(key, entry);
        return true;
      }
      entry.count += 1;
      mem.set(key, entry);
      return entry.count <= limit;
    } catch (err) {
      logger.warn("RateLimiter error", err?.message || String(err));
      return true; // Fail open
    }
  }

  return { allow };
}

export default createRateLimiter;
