import { handleAnalyzeMatch } from "../src/handlers/telegram-handler-v2.js";

const redis = {
  get: async (k) => null,
  set: async () => null,
  setex: async () => null,
  hgetall: async () => null,
};

const mockAgg = {
  getAllLiveMatches: async () => [
    {
      id: "live-1",
      home: "LiveHome",
      away: "LiveAway",
      status: "LIVE",
      homeScore: 1,
      awayScore: 0,
    },
  ],
  getFixtures: async (leagueId) => {
    // return different fixtures depending on leagueId
    if (!leagueId || String(leagueId) === "upcoming") {
      return [
        {
          id: "fix-123",
          home: "Alpha FC",
          away: "Beta United",
          kickoff: new Date().toISOString(),
          league: "Test League",
          competition: "TL",
        },
      ];
    }
    return [
      {
        id: `fix-${leagueId}`,
        home: "Lega FC",
        away: "Rossi United",
        kickoff: new Date().toISOString(),
        league: `League ${leagueId}`,
      },
    ];
  },
  getHeadToHead: async () => ({
    totalMatches: 2,
    homeWins: 1,
    awayWins: 0,
    draws: 1,
  }),
  getRecentForm: async () => [],
  getStandings: async () => [],
  getOdds: async () => [],
};

(async () => {
  // Test resolving upcoming fixture by id
  const res1 = await handleAnalyzeMatch(
    "analyze_match_upcoming_fix-123",
    1111,
    2222,
    redis,
    { sportsAggregator: mockAgg, azureAI: { isHealthy: () => false } },
  );
  console.log("=== RESULT FOR upcoming fix-123 ===");
  console.log(JSON.stringify(res1, null, 2));

  // Test resolving live match by index
  const res2 = await handleAnalyzeMatch(
    "analyze_match_live_0",
    1111,
    2222,
    redis,
    { sportsAggregator: mockAgg, azureAI: { isHealthy: () => false } },
  );
  console.log("=== RESULT FOR live index 0 ===");
  console.log(JSON.stringify(res2, null, 2));
})();
