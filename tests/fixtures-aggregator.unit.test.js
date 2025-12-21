import { aggregateFixtures } from '../src/lib/fixtures-aggregator.js';

class MockRedis {
  constructor() { this.store = new Map(); }
  async keys(pattern) {
    const all = Array.from(this.store.keys());
    if (!pattern) return all;
    // simple wildcard '*' -> match any substring
    const regex = new RegExp('^' + pattern.split('*').map(s => s.replace(/[-\/\\^$+?.()|[\]{}]/g, '\\$&')).join('.*') + '$');
    return all.filter(k => regex.test(k));
  }
  async get(k) { return this.store.has(k) ? this.store.get(k) : null; }
  async set(k, v) { this.store.set(k, typeof v === 'string' ? v : JSON.stringify(v)); }
}

test('aggregateFixtures merges multiple provider keys and writes Redis totals', async () => {
  const redis = new MockRedis();
  const now = Date.now();

  // Seed sportmonks live sample (2 matches: one live, one upcoming)
  await redis.set('prefetch:sportsmonks:live', JSON.stringify({ fetchedAt: now, count: 2, data: [
    { home_team: 'Home A', away_team: 'Away A', commence: new Date(now - 60000).toISOString(), status: 'LIVE' },
    { home_team: 'Home B', away_team: 'Away B', commence: new Date(now + 3600000).toISOString() }
  ] }));

  // Seed rapidapi odds/scores for a sport
  await redis.set('rapidapi:scores:sport:football', JSON.stringify({ apiName: 'OddsAPI', sportKey: 'football', data: [ { home_team: 'Home C', away_team: 'Away C', commence: new Date(now - 120000).toISOString() } ], ts: now }));

  // Seed a provider-specific fixtures key
  await redis.set('rapidapi:soccer:fixtures:premierleague', JSON.stringify({ apiName: 'Heisenbug', league: 'premierleague', fixtures: [ { home_team: 'X', away_team: 'Y', commence: new Date(now + 7200000).toISOString() } ], ts: now }));

  const result = await aggregateFixtures(redis, { cap: 100 });

  expect(result).toBeDefined();
  expect(typeof result.totalLiveMatches).toBe('number');
  expect(typeof result.totalUpcomingFixtures).toBe('number');
  expect(Array.isArray(result.fixtures)).toBe(true);

  // Verify Redis totals were written
  const liveTotal = await redis.get('rapidapi:fixtures:live:total');
  const upcomingTotal = await redis.get('rapidapi:fixtures:upcoming:total');
  expect(String(result.totalLiveMatches)).toBe(String(liveTotal));
  expect(String(result.totalUpcomingFixtures)).toBe(String(upcomingTotal));

  // Verify providers summary written
  const prov = await redis.get('rapidapi:fixtures:providers');
  expect(prov).not.toBeNull();
  const parsedProv = JSON.parse(prov);
  expect(parsedProv && typeof parsedProv === 'object').toBe(true);
});
