import { aggregateFixtures } from '../src/lib/fixtures-aggregator.js';

class MockRedis {
  constructor() { this.store = new Map(); }
  async keys(pattern) {
    const rx = new RegExp('^' + pattern.split('*').map(s=>s.replace(/[\^$\\.+?()[\]{}]/g,'\\$&')).join('.*') + '$');
    return Array.from(this.store.keys()).filter(k=>rx.test(k));
  }
  async get(k) { return this.store.has(k) ? this.store.get(k) : null; }
  async set(k, v) { this.store.set(k, typeof v === 'string' ? v : JSON.stringify(v)); return 'OK'; }
}

test('aggregateFixtures merges sample provider data and writes Redis keys', async () => {
  const redis = new MockRedis();
  const now = Date.now();
  // SportMonks-like fixtures
  await redis.set('prefetch:sportsmonks:fixtures', JSON.stringify({ fetchedAt: now, data: [ { home_team: 'A', away_team: 'B', date: new Date(Date.now()+3600000).toISOString() } ] }));
  // RapidAPI scores sample (live)
  await redis.set('rapidapi:scores:sport:soccer', JSON.stringify({ apiName: 'OddsAPI', data: [ { home_team: 'C', away_team: 'D', commence_time: new Date(Date.now()-600000).toISOString(), status: 'LIVE' } ] }));
  // Heisenbug fixtures sample
  await redis.set('rapidapi:soccer:fixtures:premierleague', JSON.stringify({ apiName: 'Heisenbug', league: 'premierleague', fixtures: [ { home_team: 'E', away_team: 'F', date: new Date(Date.now()+86400000).toISOString() } ], ts: now }));

  const summary = await aggregateFixtures(redis);
  expect(typeof summary.totalLiveMatches).toBe('number');
  expect(typeof summary.totalUpcomingFixtures).toBe('number');
  expect(Array.isArray(summary.fixtures)).toBe(true);

  // Redis keys written
  const liveTotal = await redis.get('rapidapi:fixtures:live:total');
  const upcomingTotal = await redis.get('rapidapi:fixtures:upcoming:total');
  expect(liveTotal).not.toBeNull();
  expect(upcomingTotal).not.toBeNull();
});
