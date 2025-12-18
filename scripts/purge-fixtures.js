#!/usr/bin/env node
// Purge Redis keys for raw fixtures and raw live caches (useful after deploy)
// Usage: ALLOW_INSECURE_TLS=1 node ./scripts/purge-fixtures.js

import { getRedisAdapter } from "../src/lib/redis-factory.js";

async function purge() {
  try {
    console.log("Scanning for keys matching raw:fixtures:* and raw:live:*");
    const patterns = ["raw:fixtures:*", "raw:live:*", "betrix:prefetch:*"];
    const redis = getRedisAdapter();
    for (const pattern of patterns) {
      console.log(`Scanning ${pattern} ...`);
      // Adapter doesn't implement SCAN in-memory; use KEYS fallback
      const keys = await (redis.keys ? redis.keys(pattern) : []);
      if (keys && keys.length) {
        console.log(`  Deleting ${keys.length} keys...`);
        try {
          await redis.del(...keys);
        } catch (e) {
          // Some adapters may prefer single-key deletes
          for (const k of keys) {
            try {
              await redis.del(k);
            } catch (_) {}
          }
        }
      }
      console.log(`Finished pattern ${pattern}`);
    }
    console.log("Purge complete.");
  } catch (e) {
    console.error("Error during purge:", e && e.message);
    process.exit(1);
  } finally {
    // Best effort shutdown
    try {
      if (typeof redis?.quit === "function") await redis.quit();
    } catch (_) {}
  }
}

purge();
