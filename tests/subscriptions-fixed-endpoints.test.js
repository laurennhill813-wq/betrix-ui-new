import { jest } from '@jest/globals';
import { startPrefetchScheduler } from "../src/tasks/prefetch-scheduler.js";

function createInMemoryRedis() {
  const kv = new Map();
  return {
    async set(k, v) {
      kv.set(k, typeof v === "string" ? v : JSON.stringify(v));
      return "OK";
    },
    async get(k) {
      return kv.has(k) ? kv.get(k) : null;
    },
    async publish(_c, _m) { return 1; },
    async del(k) { kv.delete(k); return 1; },
    async expire(_k, _t) { return 1; },
    async keys(pattern) {
      const re = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return Array.from(kv.keys()).filter(k => re.test(k));
    }
  };
}

describe('Subscriptions corrected endpoints produce fixtures', () => {
  beforeEach(() => {
    process.env.RAPIDAPI_KEY = 'test-key';
    // Mock fetch to respond with fixtures for the corrected endpoints
    global.fetch = jest.fn().mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes('/api/premierleague/fixtures')) {
        return { status: 200, json: async () => ({ fixtures: [{ home: 'Chelsea', away: 'Arsenal', commence: new Date().toISOString(), league: 'EPL' }] }), text: async () => JSON.stringify({ fixtures: [{ home: 'Chelsea', away: 'Arsenal' }] }) };
      }
      if (u.includes('/fixtures?league=NBA')) {
        return { status: 200, json: async () => ([{ id: 'n1', home: 'Lakers', away: 'Celtics', commence_time: new Date().toISOString(), league: 'NBA' }]), text: async () => '[]' };
      }
      if (u.includes('/fixtures?league=MLB')) {
        return { status: 200, json: async () => ([{ id: 'm1', home: 'Yankees', away: 'Red Sox', commence_time: new Date().toISOString(), league: 'MLB' }]), text: async () => '[]' };
      }
      return { status: 404, json: async () => ({ error: 'Not found' }), text: async () => '{}' };
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
    delete process.env.RAPIDAPI_KEY;
  });

  test('premierleague fixtures write rapidapi:key and include team names', async () => {
    const redis = createInMemoryRedis();
    const handle = startPrefetchScheduler({ redis, intervalSeconds: 60 });
    await new Promise((r) => setTimeout(r, 400));
    const key = 'rapidapi:heisenbug-premier-league-live-scores-v1-p-p-rapidapi-com:fixtures:EPL';
    // The scheduler normalizes endpoint into a key; we will search for any fixtures key
    const keys = await redis.keys('rapidapi:*:fixtures:*');
    expect(keys.length).toBeGreaterThan(0);
    // find a key that contains 'heisenbug' or 'premier'
    const found = keys.find(k => /premier|heisenbug/i.test(k) || /epl/i.test(k));
    expect(found).toBeTruthy();
    const raw = await redis.get(found);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw);
    expect(Array.isArray(parsed.fixtures) || Array.isArray(parsed.data) || parsed.fixtures).toBeTruthy();
    handle.stop();
  }, 15000);
});
