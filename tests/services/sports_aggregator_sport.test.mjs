import test from "node:test";
import assert from "node:assert/strict";
import { SportsAggregator } from "../../src/services/sports-aggregator.js";

test("SportsAggregator.getLiveBySport normalizes sportradar matches", async () => {
  const agg = new SportsAggregator(null, {});
  // inject a mock sportradar handler
  agg.sportradar = async (sport, type, params, opts) => ({
    ok: true,
    data: {
      matches: [
        {
          id: "g1",
          home: { name: "Team A" },
          away: { name: "Team B" },
          scheduled: "2025-12-01T18:00:00Z",
          status: "SCHEDULED",
        },
      ],
    },
  });

  const res = await agg.getLiveBySport("nba");
  assert.ok(Array.isArray(res), "Expected an array");
  assert.strictEqual(res.length, 1);
  const g = res[0];
  assert.strictEqual(g.home, "Team A");
  assert.strictEqual(g.away, "Team B");
  assert.ok(g.startTime, "expected startTime");
});
