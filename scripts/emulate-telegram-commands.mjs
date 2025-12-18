import "dotenv/config";
import { handleFootballOdds } from "../src/bot/handlers/odds-football.js";
import { handleBasketballOdds } from "../src/bot/handlers/odds-basketball.js";
import {
  getUpcomingFixtures,
  formatMatchShort,
  setAggregator,
} from "../src/bot/football.js";
import { getRedis } from "../src/lib/redis-factory.js";
import { SportsAggregator } from "../src/services/sports-aggregator.js";

async function callHandler(handler, ctx) {
  try {
    await handler(ctx);
  } catch (e) {
    console.error("Handler error:", e?.message || e);
  }
}

(async function () {
  const redis = getRedis();
  const agg = new SportsAggregator(redis);
  setAggregator(agg);

  console.log("\n=== /upcoming fixtures preview ===");
  const fixtures = await agg.getFixtures();
  for (let i = 0; i < Math.min(5, fixtures.length); i++) {
    console.log(`${i + 1}. ${formatMatchShort(fixtures[i])}`);
  }

  console.log("\n=== /odds football (NFL) ===");
  const fakeCtxOdds = {
    from: { id: 9999 },
    reply: (msg, opts) => {
      console.log(msg);
      return Promise.resolve();
    },
  };
  await callHandler(handleFootballOdds, fakeCtxOdds);

  console.log("\n=== /odds basketball (handler fallback) ===");
  await callHandler(handleBasketballOdds, fakeCtxOdds);

  console.log("\n=== /prefetch_status (local) ===");
  // call local prefetch-status script output
  const pref = await import("./prefetch-status-local.mjs");
  // The script prints output and exits; instead we call the logic directly by invoking that module
  // But to keep it simple, spawn the script
  const { spawn } = await import("child_process");
  const ps = spawn(process.execPath, ["./scripts/prefetch-status-local.mjs"], {
    stdio: "inherit",
  });
  ps.on("close", () => process.exit(0));
})();
