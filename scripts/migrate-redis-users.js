#!/usr/bin/env node
/**
 * Safe Redis migration for `user:<id>` keys that are HASHes — convert to JSON string SET
 * Usage:
 *  DRY_RUN=1 node scripts/migrate-redis-users.js   # show what would change
 *  node scripts/migrate-redis-users.js            # perform migration
 */
import Redis from "ioredis";

const url = process.env.REDIS_URL || process.env.REDIS || null;
if (!url) {
  console.error("REDIS_URL not set");
  process.exit(1);
}

const dry = !!process.env.DRY_RUN;
const redis = new Redis(url);

async function migrate() {
  let cursor = "0";
  const pattern = "user:*";
  console.log(
    dry ? "[DRY RUN] Scanning for keys: user:*" : "Scanning for keys: user:*",
  );
  do {
    const res = await redis.scan(cursor, "MATCH", pattern, "COUNT", 500);
    cursor = res[0];
    const keys = res[1] || [];
    for (const k of keys) {
      // Skip any backup keys we previously created to avoid nested backups
      if (String(k).includes(":backup:hash")) {
        // uncomment for verbose: console.log('Skipping backup key', k);
        continue;
      }
      try {
        const type = await redis.type(k);
        if (type === "hash") {
          const obj = await redis.hgetall(k);
          // convert integer-like fields back to numbers where possible
          const clean = {};
          for (const [field, val] of Object.entries(obj)) {
            let v = val;
            if (/^\d+$/.test(v)) v = Number(v);
            else if (/^\d+\.\d+$/.test(v)) v = Number(v);
            clean[field] = v;
          }
          if (dry) {
            console.log("[DRY] Would convert", k, "to string JSON");
          } else {
            // Backup old key
            const backupKey = `${k}:backup:hash`;
            await redis.rename(k, backupKey).catch(() => null);
            await redis.set(k, JSON.stringify(clean));
            console.log("Migrated", k, "-> JSON (backup at", backupKey + ")");
          }
        }
      } catch (e) {
        console.error(
          "Error inspecting key",
          k,
          e && e.message ? e.message : e,
        );
      }
    }
  } while (cursor !== "0");
  console.log("Migration scan complete");
  await redis.quit();
}

migrate().catch((err) => {
  console.error(err);
  process.exit(2);
});
