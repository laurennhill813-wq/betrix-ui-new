#!/usr/bin/env node
// Simple harness to simulate calling handleAnalyzeMatch
// Usage: node scripts/simulate-analyze.js

(async () => {
  try {
    const mod = await import('../src/handlers/telegram-handler-v2.js');
    const { handleAnalyzeMatch } = mod;

    // Minimal redis mock
    const redis = {
      get: async (k) => null,
      hgetall: async () => ({}),
    };

    // Mock sportsAggregator: provides live matches and fixtures
    const services = {
      sportsAggregator: {
        getAllLiveMatches: async () => {
          return [
            { id: '1001', home: 'Mock United', away: 'Example FC', status: 'LIVE', time: "45'", raw: {} },
            { id: '1002', home: 'Demo City', away: 'Sample Rovers', status: 'NOT_STARTED', kickoff: new Date(Date.now() + 3600000).toISOString(), raw: {} }
          ];
        },
        getFixtures: async (leagueId) => {
          if (!leagueId) return [
            { id: '2001', home: 'Upcoming A', away: 'Upcoming B', kickoff: new Date(Date.now() + 86400000).toISOString(), raw: {} }
          ];
          if (leagueId === 42) return [ { id: '4242', home: 'LeagueTeamA', away: 'LeagueTeamB', kickoff: new Date().toISOString(), raw: {} } ];
          return [];
        },
        getHeadToHead: async () => ({ totalMatches: 5, homeWins: 2, awayWins: 2, draws: 1 }),
        getRecentForm: async () => ([]),
        getStandings: async () => ([]),
        getOdds: async () => ([])
      }
    };

    // Example tokens to test resolution paths
    const examples = [
      'analyze_match_live_1',     // should match first live entry (1-based index)
      'analyze_match_live_1001',  // by id
      'analyze_match_42_0',       // league-specific index
      'analyze_match_2001',       // direct id in fixtures
      'analyze_match_nonexistent' // should not find
    ];

    for (const ex of examples) {
      console.log('\n---\nCalling handleAnalyzeMatch with token:', ex);
      const res = await handleAnalyzeMatch(ex, 9999, 12345, redis, services);
      console.log('Result:', res);
    }
  } catch (e) {
    console.error('Simulation failed', e);
    process.exit(1);
  }
})();
