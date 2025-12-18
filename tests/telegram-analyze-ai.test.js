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

test("handleAnalyzeMatch: prefers Azure AI output when available", async () => {
  const redis = new MockRedis();

  const mockAgg = {
    getAllLiveMatches: async () => [],
    getFixtures: async () => [
      {
        id: 537950,
        home: "Leeds United FC",
        away: "Crystal Palace FC",
        status: "TIMED",
        time: "2025-12-21T17:00:00Z",
        competition: "Premier League",
        venue: "Elland Road",
        raw: { competition: { id: 2 } },
      },
    ],
    getHeadToHead: async () => ({
      totalMatches: 2,
      homeWins: 1,
      awayWins: 1,
      draws: 0,
    }),
    getRecentForm: async () => [
      { starting_at: "2025-11-01", result: "1-0", score: "1-0" },
    ],
    getStandings: async () => [],
    getOdds: async () => [],
  };

  // Mock Azure-like AI service
  const mockAzure = {
    isHealthy: () => true,
    chat: async (prompt, opts) => {
      // ensure we were passed a prompt containing home/away
      if (!/Leeds United FC/.test(prompt) || !/Crystal Palace FC/.test(prompt))
        return "";
      return "AI GENERATED ANALYSIS: This is an Azure mock output.\n\nPowered by BETRIX";
    },
  };

  const services = { sportsAggregator: mockAgg, azureAI: mockAzure };

  const res = await handleAnalyzeMatch(
    "analyze_match_upcoming_537950",
    11111,
    22222,
    redis,
    services,
  );

  assert.ok(res && typeof res === "object", "expected object response");
  assert.ok(
    res.text && res.text.includes("AI GENERATED ANALYSIS"),
    "expected AI text from azure mock",
  );
});
