import { broadcastText } from "../telegram/broadcast.js";

const FIXTURES_TICKER_ENABLED =
  String(process.env.FIXTURES_TICKER_ENABLED || "false").toLowerCase() ===
  "true";

let aggInstance = null;

export function setAggregator(aggregator) {
  aggInstance = aggregator;
}

export async function runFixturesTickerCycle() {
  if (!FIXTURES_TICKER_ENABLED) return;
  try {
    if (!aggInstance || typeof aggInstance.getTodayFixtures !== "function") {
      console.warn(
        "[FixturesTicker] No aggregator available or method missing; skipping cycle",
      );
      return;
    }
    const fixtures = await aggInstance.getTodayFixtures();
    if (!fixtures || fixtures.length === 0) return;
    const lines = fixtures
      .slice(0, 20)
      .map(
        (f) =>
          `• <b>${f.home} vs ${f.away}</b> — ${f.kickoffLocal || f.kickoff || ""}`,
      );
    const text = [
      "📅 <b>Today’s Matches</b>",
      "",
      ...lines,
      "",
      "Stay tuned — more updates live.",
    ].join("\n");
    await broadcastText(text);
    console.log("[FixturesTicker] Posted today’s fixtures");
  } catch (e) {
    console.error("[FixturesTicker] Error", e?.message || e);
  }
}

export function startFixturesTickerScheduler(cron, aggregator) {
  if (aggregator) setAggregator(aggregator);
  if (!FIXTURES_TICKER_ENABLED) {
    console.log("[FixturesTicker] Disabled (FIXTURES_TICKER_ENABLED != true)");
    return;
  }
  const expr = "0 7 * * *";
  console.log("[FixturesTicker] Starting scheduler with cron:", expr);
  cron.schedule(expr, () => {
    runFixturesTickerCycle();
  });
}

export default {
  runFixturesTickerCycle,
  startFixturesTickerScheduler,
  setAggregator,
};
