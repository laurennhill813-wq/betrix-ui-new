import "dotenv/config";
import { getRedis } from "../src/lib/redis-factory.js";
import { SportsAggregator } from "../src/services/sports-aggregator.js";
import { setAggregator, formatMatchShort } from "../src/bot/football.js";

(async function () {
  const redis = getRedis();
  const agg = new SportsAggregator(redis);
  setAggregator(agg);
  const { items, total } = await (
    await import("../src/bot/football.js")
  ).getUpcomingFixtures({ page: 1, perPage: 10 });
  console.log(`Total upcoming fixtures: ${total}`);
  for (let i = 0; i < Math.min(10, items.length); i++) {
    const f = items[i];
    console.log(`${i + 1}. ${formatMatchShort(f)}`);
  }
  process.exit(0);
})();
