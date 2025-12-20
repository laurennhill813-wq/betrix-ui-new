import { getRedisAdapter } from "../src/lib/redis-factory.js";
import { startSportradarPrefetch } from "../src/tasks/sportradar-prefetch.js";
import { SPORTRADAR_SPORTS } from "../src/config/sportradar-sports.js";

(async () => {
  try {
    if (!process.env.SPORTRADAR_KEY && process.argv[2]) process.env.SPORTRADAR_KEY = process.argv[2];
    if (!process.env.SPORTRADAR_KEY) {
      console.error("SPORTRADAR_KEY not set. Pass as env or first arg.");
      process.exit(2);
    }

    // create redis adapter from REDIS_URL env
    const redis = getRedisAdapter();

    console.log("Starting one-shot Sportradar prefetch (real Redis)");
    const handle = startSportradarPrefetch({ redis, cronExpr: "@never", days: 0, ttlFixtures: 300, ttlTeams: 300 });

    // wait for the run to complete
    await new Promise((r) => setTimeout(r, 15000));

    const healthRaw = await redis.get("sportradar:health");
    console.log("sportradar:health:", healthRaw ? "(present)" : "<none>");
    if (healthRaw) {
      try { console.log(healthRaw); } catch (e) {}
    }

    // print some upcoming keys
    for (const s of SPORTRADAR_SPORTS.slice(0, 4)) {
      const k = `sportradar:upcoming:${s.id}`;
      const v = await redis.get(k);
      console.log(k, v ? "(present)" : "<none>");
    }

    try { handle.stop(); } catch (e) {}
    process.exit(0);
  } catch (e) {
    console.error("prefetch run failed", e && e.message ? e.message : e);
    process.exit(1);
  }
})();
