import { handleAnalyzeMatch } from "../src/handlers/telegram-handler-v2.js";

const redis = {
  get: async () => null,
  set: async () => null,
  setex: async () => null,
  hgetall: async () => null,
};
const mockAgg = {
  getAllLiveMatches: async () => [],
  getFixtures: async () => [
    {
      id: "537952",
      home: "Newcastle",
      away: "Chelsea",
      kickoff: new Date().toISOString(),
      competition: "EPL",
    },
  ],
  getHeadToHead: async () => ({
    totalMatches: 5,
    homeWins: 2,
    awayWins: 2,
    draws: 1,
  }),
  getRecentForm: async () => [],
  getStandings: async () => [],
  getOdds: async () => [],
};

(async () => {
  // simulate encoded token as used by fallback: Newcaste_Chelsea
  const token = "analyze_match_upcoming_Newcastle_Chelsea";
  const res = await handleAnalyzeMatch(token, 1111, 2222, redis, {
    sportsAggregator: mockAgg,
    azureAI: { isHealthy: () => false },
  });
  console.log("=== SIM RESULT ===");
  console.log(JSON.stringify(res, null, 2));
})();
