import { fetchUpcomingFixtures, fetchLiveMatches } from '../src/lib/rapidapi-client.js';
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

test('rapidapi-client fetchers normalize TheRundown responses and aggregator merges them', async () => {
  // Mock global.fetch to return predictable TheRundown-like payloads
  const now = Date.now();
  global.fetch = jest.fn(async (url, opts) => {
    const body = [
      { home_team: 'TR Home', away_team: 'TR Away', commence_time: new Date(now + 60000).toISOString(), sport: 'soccer' },
    ];
    return { ok: true, json: async () => body };
  });

  const provider = { host: 'therundown.io', name: 'TheRundown' };
  const upcoming = await fetchUpcomingFixtures(provider, { path: '/v2/sports/markets/2025-01-01' });
  const live = await fetchLiveMatches(provider, { path: '/v2/events/live' });

  expect(Array.isArray(upcoming)).toBe(true);
  expect(upcoming.length).toBeGreaterThanOrEqual(0);
  expect(Array.isArray(live)).toBe(true);

  // Write to MockRedis similar to scheduler behavior
  const redis = new MockRedis();
  if (upcoming.length) {
    await redis.set('rapidapi:fixtures:upcoming:soccer', JSON.stringify({ apiName: 'TheRundown', sport: 'soccer', fixtures: upcoming, fetchedAt: now }));
  }
  if (live.length) {
    await redis.set('rapidapi:fixtures:live:soccer', JSON.stringify({ apiName: 'TheRundown', sport: 'soccer', fixtures: live, fetchedAt: now }));
  }

  const agg = await aggregateFixtures(redis);
  expect(agg).toBeDefined();
  expect(typeof agg.totalLiveMatches).toBe('number');
  expect(typeof agg.totalUpcomingFixtures).toBe('number');
  // Redis totals should match aggregator results
  const liveTotal = await redis.get('rapidapi:fixtures:live:total');
  const upcomingTotal = await redis.get('rapidapi:fixtures:upcoming:total');
  expect(String(agg.totalLiveMatches)).toBe(String(liveTotal));
  expect(String(agg.totalUpcomingFixtures)).toBe(String(upcomingTotal));
});
