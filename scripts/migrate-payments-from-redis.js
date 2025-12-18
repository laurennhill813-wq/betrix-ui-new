#!/usr/bin/env node
import initDb from "../src/db/client.js";
import { getRedis } from "../src/lib/redis-factory.js";
import createRedisAdapter from "../src/utils/redis-adapter.js";
import { createPaymentRecord } from "../src/services/payments.js";

async function main() {
  console.log("Starting payments migration from Redis to Postgres...");
  const dbClient = await initDb();
  const dry =
    String(process.env.DRY_RUN || "").toLowerCase() === "1" ||
    String(process.env.DRY_RUN || "").toLowerCase() === "true";
  if (!dbClient) {
    if (!dry) {
      console.error("No DB client available; aborting");
      process.exit(1);
    } else {
      console.warn("No DB client available — running in dry-run mode");
    }
  }

  const rawRedis = getRedis();
  const r = createRedisAdapter(rawRedis);

  // Find Redis payment logs
  const keys = (await (r.keys ? r.keys("payments:log:*") : [])) || [];
  console.log("Found", keys.length, "payments:log:* keys");

  for (const k of keys) {
    try {
      const raw = await r.get(k);
      if (!raw) continue;
      let obj = null;
      try {
        obj = JSON.parse(raw);
      } catch (e) {
        console.warn("Skipping non-JSON payment log", k);
        continue;
      }
      // Map to payment shape expected by createPaymentRecord
      const payment = {
        userId: obj.user_id || obj.userId || null,
        provider: obj.provider || null,
        providerRef:
          obj.provider_ref || obj.providerRef || obj.provider_ref || null,
        totalAmount: obj.amount || obj.totalAmount || null,
        currency: obj.currency || null,
        status: obj.status || "completed",
        metadata: obj.metadata || obj.meta || {},
      };
      if (dry) {
        console.log(
          "[DRY RUN] Would migrate",
          k,
          "->",
          payment.providerRef || "(no provider_ref)",
          "amount:",
          payment.totalAmount,
        );
      } else {
        const inserted = await createPaymentRecord(dbClient, r, payment);
        console.log(
          "Migrated",
          k,
          "->",
          inserted && (inserted.id || inserted._redis_key || inserted),
          "OK",
        );
      }
      // Optionally remove the old key (commented by default)
      // await r.del(k);
    } catch (e) {
      console.error("Failed migrating key", k, e && e.message ? e.message : e);
    }
  }

  // Also migrate provider->key mappings
  const byKeys =
    (await (r.keys ? r.keys("payment:by_provider_ref:*") : [])) || [];
  console.log("Found", byKeys.length, "payment:by_provider_ref:* keys");
  for (const bk of byKeys) {
    try {
      const raw = await r.get(bk);
      if (!raw) continue;
      // raw may either be the redis-log-key or JSON containing { id }
      let parsed = null;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        parsed = raw;
      }
      if (parsed && parsed.id) continue; // already points to id
      // If parsed is a key pointing to payment log, try to read and migrate
      if (typeof parsed === "string" && parsed.startsWith("payments:log:")) {
        const logRaw = await r.get(parsed);
        if (!logRaw) continue;
        let obj = null;
        try {
          obj = JSON.parse(logRaw);
        } catch (e) {
          continue;
        }
        const payment = {
          userId: obj.user_id || obj.userId || null,
          provider: obj.provider || null,
          providerRef:
            obj.provider_ref || obj.providerRef || obj.provider_ref || null,
          totalAmount: obj.amount || obj.totalAmount || null,
          currency: obj.currency || null,
          status: obj.status || "completed",
          metadata: obj.metadata || obj.meta || {},
        };
        if (dry) {
          console.log(
            "[DRY RUN] Would migrate mapping",
            bk,
            "->",
            payment.providerRef || "(no provider_ref)",
          );
        } else {
          const inserted = await createPaymentRecord(dbClient, r, payment);
          console.log(
            "Migrated mapping",
            bk,
            "->",
            inserted && (inserted.id || inserted._redis_key || inserted),
          );
        }
        // Optionally update mapping to point to id
        // await r.setex(bk, 30*24*60*60, JSON.stringify({ id: inserted.id }));
      }
    } catch (e) {
      console.error(
        "Failed migrating mapping",
        bk,
        e && e.message ? e.message : e,
      );
    }
  }

  console.log("Migration complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration error", err);
  process.exit(2);
});
