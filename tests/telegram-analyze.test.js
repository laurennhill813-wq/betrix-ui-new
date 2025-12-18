import assert from "assert";
import { test } from "node:test";
import { handleAnalyzeMatch } from "../src/handlers/telegram-handler-v2.js";

class MockRedis {
  constructor() {
    this.store = new Map();
  }
  async get(k) {
    return this.store.get(k) ?? null;
  }
  async set(k, v) {
    this.store.set(k, String(v));
    return "OK";
  }
}

test("handleAnalyzeMatch: basic upcoming fixture analysis", async () => {
  const redis = new MockRedis();

  const mockAgg = {
    getAllLiveMatches: async () => [],
    getFixtures: async (leagueId) => {
      return [
        {
          id: 536966,
          home: "Cagliari Calcio",
          away: "AC Pisa 1909",
          status: "TIMED",
          time: "2025-12-20T15:00:00Z",
          competition: "Serie A",
          venue: "Unipol Domus",
          raw: { competition: { id: 1, name: "Serie A" } },
        },
      ];
    },
    getHeadToHead: async () => ({
      totalMatches: 0,
      homeWins: 0,
      awayWins: 0,
      draws: 0,
    }),
    getRecentForm: async () => [
      { starting_at: "2025-11-01", result: "2-1", score: "2-1" },
    ],
    getStandings: async () => [
      { team: { name: "Cagliari Calcio" }, position: 10, points: 30 },
      { team: { name: "AC Pisa 1909" }, position: 16, points: 20 },
    ],
    getOdds: async () => [],
  };

  const services = { sportsAggregator: mockAgg };

  const data = "analyze_match_upcoming_536966";
  const chatId = 12345;
  const userId = 99999;

  const res = await handleAnalyzeMatch(data, chatId, userId, redis, services);

  // Basic assertions about the response shape and content
  assert.ok(res && typeof res === "object", "expected an object response");
  assert.ok(res.text && res.text.length > 0, "expected non-empty text");
  assert.ok(
    /Match Analysis|BETRIX/i.test(res.text),
    "expected analysis header to be present",
  );
  // Either editMessageText (when short) or sendMessage when too long/truncated
  assert.ok(
    res.method === "editMessageText" || res.method === "sendMessage",
    "unexpected telegram method",
  );
});
