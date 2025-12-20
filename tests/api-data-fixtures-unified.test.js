import { DataExposureHandler } from '../src/handlers/data-exposure-handler.js';

class MockRouter {
  constructor() { this.routes = {}; }
  get(path, handler) { this.routes[path] = handler; }
  post(path, handler) { this.routes[path] = handler; }
}

class MockRedis {
  constructor() { this.store = new Map(); }
  async keys() { return []; }
  async get(k) { return this.store.has(k) ? this.store.get(k) : null; }
  async set(k, v) { this.store.set(k, typeof v === 'string' ? v : JSON.stringify(v)); }
}

test('DataExposureHandler /api/data/fixtures unified returns aggregator summary', async () => {
  const mockRouter = new MockRouter();
  // sportsAggregator with redis and dataCache
  const mockRedis = new MockRedis();
  // seed a fixtures list for aggregator to pick up
  await mockRedis.set('rapidapi:soccer:fixtures:premierleague', JSON.stringify({ apiName: 'Heisenbug', fixtures: [ { home_team: 'X', away_team: 'Y', date: new Date().toISOString() } ], ts: Date.now() }));
  const sportsAggregator = { redis: mockRedis, dataCache: { getFixtures: async () => [] } };
  new DataExposureHandler(mockRouter, sportsAggregator);
  const handler = mockRouter.routes['/api/data/fixtures'];
  expect(typeof handler).toBe('function');

  let captured = null;
  const req = { query: { unified: '1' } };
  const res = {
    status(code) { this._status = code; return this; },
    json(obj) { captured = obj; }
  };
  await handler(req, res);
  expect(captured).not.toBeNull();
  expect(typeof captured.liveMatches).toBe('number');
  expect(typeof captured.upcomingFixtures).toBe('number');
  expect(Array.isArray(captured.fixtures)).toBe(true);
});
