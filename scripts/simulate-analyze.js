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

async function main() {
  const redis = new MockRedis();
  const mockAgg = {
    getAllLiveMatches: async () => [],
    getFixtures: async () => [
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
    ],
    getHeadToHead: async () => ({ totalMatches: 0 }),
    getRecentForm: async () => [],
    getStandings: async () => [],
    getOdds: async () => [],
  };
  const services = { sportsAggregator: mockAgg };
  const data = process.argv[2] || "analyze_match_upcoming_536966";
  const chatId = Number(process.argv[3] || 99999);
  const userId = Number(process.argv[4] || 88888);

  const res = await handleAnalyzeMatch(data, chatId, userId, redis, services);
  console.log("--- Simulation Result ---");
  console.log("method:", res.method);
  console.log("text snippet:\n", (res.text || "").slice(0, 200));
}

if (import.meta.url === `file://${process.cwd()}/scripts/simulate-analyze.js`)
  main().catch((e) => {
    console.error(e);
    process.exit(2);
  });
