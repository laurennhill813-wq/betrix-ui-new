import { getRedis } from "../src/lib/redis-factory.js";

(async function () {
  const redis = getRedis();
  try {
    const key = process.argv[2] || "raw:fixtures:footballdata:39";
    console.log("[inspect-fixtures] Redis key:", key);
    const raw = await redis.get(key);
    if (!raw) {
      console.log("[inspect-fixtures] Key not found or empty");
      process.exit(0);
    }
    const payload = JSON.parse(raw);
    const data = payload.data || payload;
    console.log(
      "[inspect-fixtures] Items:",
      Array.isArray(data) ? data.length : typeof data,
    );
    const sample = Array.isArray(data) ? data.slice(0, 3) : [data];
    for (let i = 0; i < sample.length; i++) {
      console.log(`--- ITEM ${i} ---`);
      const item = sample[i];
      // print some representative fields
      console.log(
        "id:",
        item.id ?? item.match_id ?? item.fixture?.id ?? item._id ?? "(none)",
      );
      console.log(
        "home (raw):",
        item.homeTeam ||
          item.home ||
          (item.teams && item.teams.home) ||
          item.participants ||
          item.name ||
          "(none)",
      );
      console.log(
        "away (raw):",
        item.awayTeam ||
          item.away ||
          (item.teams && item.teams.away) ||
          "(none)",
      );
      console.log(
        "competition:",
        item.competition || item.league || item.competition_id || "(none)",
      );
      console.log("raw keys:", Object.keys(item).slice(0, 20));
    }
    process.exit(0);
  } catch (e) {
    console.error("[inspect-fixtures] Error", (e && e.message) || e);
    process.exit(2);
  }
})();
