import { handleAnalyzeMatch } from '../src/handlers/telegram-handler-v2.js';

const redis = { get: async () => null, set: async () => null, setex: async () => null, hgetall: async () => null };
const mockAgg = {
  getAllLiveMatches: async () => [],
  getFixtures: async () => [ { id: '537952', home: 'Home', away: 'Away', kickoff: new Date().toISOString(), competition: 'TestComp' } ],
  getHeadToHead: async () => ({ totalMatches: 0 }),
  getRecentForm: async () => [],
  getStandings: async () => [],
  getOdds: async () => []
};

(async () => {
  const res = await handleAnalyzeMatch('analyze_match_upcoming_537952', 1111, 2222, redis, { sportsAggregator: mockAgg, azureAI: { isHealthy: () => false } });
  console.log(JSON.stringify(res, null, 2));
})();
