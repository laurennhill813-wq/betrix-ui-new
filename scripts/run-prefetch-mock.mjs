import { MockRedis } from "../src/lib/redis-factory.js";
import { startPrefetchScheduler } from "../src/tasks/prefetch-scheduler.js";

function wrapMock(m) {
  return Object.assign(m, {
    publish: async (channel, message) => {
      const key = `pub:${channel}`;
      const arr = m.kv.get(key) || [];
      arr.push(message);
      m.kv.set(key, arr);
      return arr.length;
    },
  });
}

// Minimal mock sportsAggregator that returns mixed-sport fixtures
const sportsAggregatorMock = {
  getAllLiveMatches: async () => {
    return [
      { sport: 'basketball', home: 'Lakers', away: 'Heat', start: new Date().toISOString() },
      { sport: 'tennis', home: 'Nadal', away: 'Federer', start: new Date().toISOString() },
      { sport: 'soccer', home: 'Arsenal', away: 'Chelsea', start: new Date().toISOString() },
    ];
  },
  getFixtures: async () => {
    // upcoming fixtures across sports
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    return [
      { sport: 'basketball', home_team: 'Bulls', away_team: 'Celtics', commence: tomorrow },
      { sport: 'tennis', home_team: 'Serena', away_team: 'Osaka', commence: tomorrow },
      { sport: 'soccer', home_team: 'Man City', away_team: 'Man U', commence: tomorrow },
      { sport: 'rugby', home_team: 'Team A', away_team: 'Team B', commence: tomorrow },
    ];
  },
};

(async () => {
  try {
    // Mock global fetch to simulate RapidAPI provider responses
    global.fetch = async (url, opts) => {
      try {
        const u = String(url || '');
        // Simple heuristics to return arrays of fixtures/scores for different endpoints
        const now = new Date();
        const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
        const sampleSport = (sport) => ([{ sport, home_team: `${sport}-Home`, away_team: `${sport}-Away`, commence: tomorrow }]);
        let body = null;
        if (/odds|sports\/|scores|fixtures|v4\/sports/i.test(u)) {
          // return mixed sports depending on path
          body = [
            { sport: 'basketball', home_team: 'MockHoopsA', away_team: 'MockHoopsB', commence: tomorrow },
            { sport: 'tennis', home_team: 'MockTennisA', away_team: 'MockTennisB', commence: tomorrow },
            { sport: 'soccer', home_team: 'MockSocA', away_team: 'MockSocB', commence: tomorrow },
            { sport: 'rugby', home_team: 'MockRugbyA', away_team: 'MockRugbyB', commence: tomorrow },
          ];
        } else {
          body = sampleSport('soccer');
        }
        return {
          ok: true,
          status: 200,
          json: async () => body,
          headers: {
            entries: () => (function*(){ yield ['content-type','application/json']; })(),
          },
        };
      } catch (e) {
        return { ok: false, status: 500, json: async ()=> null, headers: { entries: ()=>[] } };
      }
    };

    const mr = wrapMock(new MockRedis());
    console.log('Using MockRedis for prefetch test');

    // Start scheduler with short interval and only the sportsAggregator mocked
    const handle = startPrefetchScheduler({ redis: mr, sportsAggregator: sportsAggregatorMock, intervalSeconds: 5 });

    // Wait for immediate run to finish (scheduler runs job immediately)
    await new Promise((r) => setTimeout(r, 5000));

    // Inspect consolidated keys
    const upcomingBySport = await mr.get('betrix:prefetch:upcoming:by-sport');
    const liveBySport = await mr.get('betrix:prefetch:live:by-sport');
    console.log('betrix:prefetch:upcoming:by-sport =', upcomingBySport || '<none>');
    console.log('betrix:prefetch:live:by-sport =', liveBySport || '<none>');

    // Inspect per-sport rapidapi keys that scheduler writes
    const sports = ['basketball', 'tennis', 'soccer', 'rugby', 'americanfootball'];
    for (const s of sports) {
      try {
        const upKey = `rapidapi:fixtures:upcoming:${s}`;
        const liveKey = `rapidapi:fixtures:live:${s}`;
        const up = await mr.get(upKey);
        const lv = await mr.get(liveKey);
        console.log(`${upKey} =>`, up ? String(up).slice(0, 800) : '<none>');
        console.log(`${liveKey} =>`, lv ? String(lv).slice(0, 800) : '<none>');
      } catch (e) {}
    }

    // Dump MockRedis keys
    try {
      console.log('MockRedis keys:', Array.from(mr.kv.keys()));
    } catch (e) {}

    try { handle.stop(); } catch (e) {}
    process.exit(0);
  } catch (e) {
    console.error('prefetch mock run failed', e && e.message ? e.message : e);
    process.exit(1);
  }
})();
