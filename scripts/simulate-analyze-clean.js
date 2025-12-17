// Simple harness to simulate calling handleAnalyzeMatch
import { handleAnalyzeMatch } from '../src/handlers/telegram-handler-v2.js';

class MockRedis { constructor(){ this.store = new Map(); } async get(k){ return this.store.get(k) ?? null; } async set(k,v){ this.store.set(k,String(v)); return 'OK'; } }

async function runExamples(){
  const redis = new MockRedis();
  const services = {
    sportsAggregator: {
      getAllLiveMatches: async () => [ { id: '1001', home: 'Mock United', away: 'Example FC', status: 'LIVE', time: "45'", raw: {} } ],
      getFixtures: async (leagueId) => {
        if (!leagueId) return [ { id: '2001', home: 'Upcoming A', away: 'Upcoming B', kickoff: new Date(Date.now() + 86400000).toISOString(), raw: {} } ];
        if (leagueId === 42) return [ { id: '4242', home: 'LeagueTeamA', away: 'LeagueTeamB', kickoff: new Date().toISOString(), raw: {} } ];
        return [];
      },
      getHeadToHead: async () => ({ totalMatches: 5, homeWins: 2, awayWins: 2, draws: 1 }),
      getRecentForm: async () => ([]),
      getStandings: async () => ([]),
      getOdds: async () => ([])
    }
  };

  const examples = [
    'analyze_match_live_1',
    'analyze_match_live_1001',
    'analyze_match_42_0',
    'analyze_match_2001',
    'analyze_match_nonexistent'
  ];

  for (const ex of examples) {
    console.log('\n---\nCalling handleAnalyzeMatch with token:', ex);
    const res = await handleAnalyzeMatch(ex, 9999, 12345, redis, services);
    console.log('Result method:', res.method);
    console.log('Text snippet:\n', (res.text||'').slice(0,200));
  }
}

runExamples().catch(e=>{ console.error('Simulation failed', e); process.exit(1); });
