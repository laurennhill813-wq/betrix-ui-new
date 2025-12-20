import { MockRedis } from "../src/lib/redis-factory.js";
import { startSportradarPrefetch } from "../src/tasks/sportradar-prefetch.js";
import { SPORTRADAR_SPORTS } from "../src/config/sportradar-sports.js";

function wrapMock(m) {
  // Provide publish as a compatible shim and preserve existing methods
  return Object.assign(m, {
    publish: async (channel, message) => {
      const key = `pub:${channel}`;
      const arr = (m.kv.get(key) || []);
      arr.push(message);
      m.kv.set(key, arr);
      return arr.length;
    },
  });
}

(async () => {
  try {
    if (!process.env.SPORTRADAR_API_KEY && process.argv[2]) {
      process.env.SPORTRADAR_API_KEY = process.argv[2];
    }
    if (!process.env.SPORTRADAR_API_KEY) {
      console.error("SPORTRADAR_API_KEY not set. Pass as env or first arg.");
      process.exit(2);
    }

    const mr = wrapMock(new MockRedis());

    console.log("Starting live Sportradar prefetch (using MockRedis)");
    const handle = startSportradarPrefetch({ redis: mr, cronExpr: "@never" /* disable schedule */ , days: 0, ttlFixtures: 120, ttlTeams: 300 });

    // Wait for the immediate run to complete (prefetchOnce runs immediately)
    await new Promise((r) => setTimeout(r, 20000));

    const healthRaw = await mr.get("sportradar:health");
    console.log("sportradar:health:", healthRaw || "<none>");

    // print upcoming sample for first sport
    const firstSport = (SPORTRADAR_SPORTS && SPORTRADAR_SPORTS[0] && SPORTRADAR_SPORTS[0].id) || "soccer";
    const upcomingRaw = await mr.get(`sportradar:upcoming:${firstSport}`);
    console.log(`sportradar:upcoming:${firstSport}:`, upcomingRaw || "<none>");

    // print teams count for first sport
    const teamsRaw = await mr.get(`sportradar:teams:${firstSport}`);
    console.log(`sportradar:teams:${firstSport}:`, teamsRaw || "<none>");

    // Dump all MockRedis keys for inspection
    try {
      console.log("MockRedis keys:", Array.from(mr.kv.keys()));
    } catch (e) {}

    try { handle.stop(); } catch (e) {}
    process.exit(0);
  } catch (e) {
    console.error("prefetch run failed", e && e.message ? e.message : e);
    process.exit(1);
  }
})();
