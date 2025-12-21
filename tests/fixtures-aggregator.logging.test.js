import { aggregateFixtures } from '../src/lib/fixtures-aggregator.js';

class MockRedis {
  constructor() { this.store = new Map(); }
  async keys(pattern) {
    const all = Array.from(this.store.keys());
    if (!pattern) return all;
    const regex = new RegExp('^' + pattern.split('*').map(s => s.replace(/[-\/\\^$+?.()|[\]{}]/g, '\\$&')).join('.*') + '$');
    return all.filter(k => regex.test(k));
  }
  async get(k) { return this.store.has(k) ? this.store.get(k) : null; }
  async set(k, v) { this.store.set(k, typeof v === 'string' ? v : JSON.stringify(v)); }
}

test('aggregateFixtures writes per-sport totals and returns bySport', async () => {
  const redis = new MockRedis();
  const now = Date.now();

  // Seed Football-Data fixtures (soccer)
  await redis.set('prefetch:footballdata:sample', JSON.stringify({ apiName: 'FootballData', fixtures: [ { home_team: 'A', away_team: 'B', commence: new Date(now + 3600000).toISOString() } ], data: [ { home_team: 'A', away_team: 'B', commence: new Date(now + 3600000).toISOString() } ] }));

  // Seed Heisenbug fixtures (soccer)
  await redis.set('rapidapi:soccer:fixtures:premierleague', JSON.stringify({ apiName: 'Heisenbug', league: 'premierleague', fixtures: [ { home_team: 'X', away_team: 'Y', commence: new Date(now + 7200000).toISOString() } ], ts: now }));

  // Seed OddsAPI scores for basketball
  await redis.set('rapidapi:scores:sport:basketball', JSON.stringify({ apiName: 'OddsAPI', sportKey: 'basketball', data: [ { home_team: 'T1', away_team: 'T2', commence: new Date(now - 60000).toISOString() } ], ts: now }));

  const res = await aggregateFixtures(redis, { cap: 100 });
  expect(res).toBeDefined();
  expect(typeof res.totalLiveMatches).toBe('number');
  expect(typeof res.totalUpcomingFixtures).toBe('number');
  expect(res.bySport && typeof res.bySport === 'object').toBe(true);

  // Check that Redis keys for per-sport totals were written
  const soccerLive = await redis.get('rapidapi:fixtures:live:soccer');
  const soccerUpcoming = await redis.get('rapidapi:fixtures:upcoming:soccer');
  const basketballLive = await redis.get('rapidapi:fixtures:live:basketball');
  expect(soccerLive !== undefined).toBe(true);
  expect(soccerUpcoming !== undefined).toBe(true);
  expect(basketballLive !== undefined).toBe(true);
});
