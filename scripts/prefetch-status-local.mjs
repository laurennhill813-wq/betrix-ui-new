import { getRedis } from "../src/lib/redis-factory.js";

(async function () {
  const redis = getRedis();
  try {
    const failures = await redis.keys("prefetch:failures:*");
    const oddsKeys = await redis.keys("*:odds:*");
    const fixtureKeys = await redis.keys("*:fixtures:*");
    const liveKeys = await redis.keys("*:livescores:*");

    const sample = [];
    for (let i = 0; i < Math.min(5, fixtureKeys.length); i++) {
      try {
        const ttl = await redis.ttl(fixtureKeys[i]);
        sample.push(`${fixtureKeys[i]} (ttl:${ttl}s)`);
      } catch (e) {
        sample.push(`${fixtureKeys[i]} (ttl:?)`);
      }
    }

    const msg = [
      "🛠 Prefetch Status",
      "",
      `✅ Fixtures: ${fixtureKeys.length}`,
      `✅ Livescores: ${liveKeys.length}`,
      `✅ Odds: ${oddsKeys.length}`,
      "",
      failures.length
        ? `❌ Failures (${failures.length}):\n${failures.slice(0, 20).join("\n")}`
        : "✅ No failures recorded",
      "",
      `🔎 Sample fixture keys:\n${sample.join("\n")}`,
    ].join("\n");

    console.log(msg);
    process.exit(0);
  } catch (e) {
    console.error("Failed to build prefetch status", e?.message || e);
    process.exit(2);
  }
})();
