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
  };
}

describe("RapidAPI Odds host handling and fixture normalization", () => {
  beforeEach(() => {
    process.env.RAPIDAPI_KEY = "test-key";
    process.env.RAPIDAPI_ODDS_MAX_SPORTS = "2";
    // mock fetch to respond for The Odds API direct host
    fetch = jest.fn().mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes("/v4/sports/?")) {
        return { status: 200, json: async () => ([{ key: 'basketball_nba', title: 'NBA' }, { key: 'baseball_mlb', title: 'MLB' }]) };
      }
      if (u.includes('/odds')) {
        return { status: 200, json: async () => ([{ id: 'e1', sport_key: 'basketball_nba', home_team: 'Lakers', away_team: 'Celtics', bookmakers: [] }]) };
      }
      if (u.includes('/scores')) {
        return { status: 200, json: async () => ([{ id: 's1', sport_key: 'basketball_nba', sport_title: 'NBA', commence_time: new Date().toISOString(), home_team: 'Lakers', away_team: 'Celtics', league: 'NBA' }]) };
      }
      return { status: 404, json: async () => ({}) };
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
    delete process.env.RAPIDAPI_KEY;
    delete process.env.RAPIDAPI_ODDS_MAX_SPORTS;
  });

  test('writes NBA and MLB fixtures keys for The Odds API host', async () => {
    const redis = createInMemoryRedis();
    const handle = startPrefetchScheduler({ redis, intervalSeconds: 60 });
    await new Promise((r) => setTimeout(r, 300));
    const bKey = 'rapidapi:basketball_nba:fixtures:NBA';
    const raw = await redis.get(bKey);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw);
    expect(parsed).toHaveProperty('sportKey', 'basketball_nba');
    expect(parsed).toHaveProperty('fixtures');
    expect(Array.isArray(parsed.fixtures)).toBe(true);
    handle.stop();
  }, 10000);
});
