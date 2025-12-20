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

describe('RapidAPI fixture normalization edge cases (MLB + missing league)', () => {
  beforeEach(() => {
    process.env.RAPIDAPI_KEY = 'test-key';
    process.env.RAPIDAPI_ODDS_MAX_SPORTS = '3';

    global.fetch = jest.fn().mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes('/v4/sports/?')) {
        return { status: 200, json: async () => ([{ key: 'basketball_nba', title: 'NBA' }, { key: 'baseball_mlb', title: 'MLB' }, { key: 'icehockey_nhl', title: 'NHL' }]) };
      }
      if (u.includes('/basketball_nba/odds')) {
        return { status: 200, json: async () => ([{ id: 'e1', sport_key: 'basketball_nba', home_team: 'Lakers', away_team: 'Celtics', commence_time: new Date().toISOString(), bookmakers: [] }]) };
      }
      if (u.includes('/baseball_mlb/odds')) {
        return { status: 200, json: async () => ([{ id: 'e2', sport_key: 'baseball_mlb', home_team: 'Yankees', away_team: 'Red Sox', commence_time: new Date().toISOString(), bookmakers: [] }]) };
      }
      if (u.includes('/icehockey_nhl/odds')) {
        return { status: 200, json: async () => ([] ) };
      }
      if (u.includes('/basketball_nba/scores')) {
        return { status: 200, json: async () => ([{ id: 's1', sport_key: 'basketball_nba', sport_title: 'NBA', commence_time: new Date().toISOString(), home_team: 'Lakers', away_team: 'Celtics', league: 'NBA' }]) };
      }
      if (u.includes('/baseball_mlb/scores')) {
        // MLB response without explicit league (edge case) but includes sport_title
        return { status: 200, json: async () => ([{ id: 's2', sport_key: 'baseball_mlb', sport_title: 'MLB', commence_time: new Date().toISOString(), home_team: 'Yankees', away_team: 'Red Sox' }]) };
      }
      if (u.includes('/icehockey_nhl/scores')) {
        // Missing both league and sport_title (worst-case) -> should fall back to sportKey
        return { status: 200, json: async () => ([{ id: 's3', sport_key: 'icehockey_nhl', commence_time: new Date().toISOString(), home_team: 'Bruins', away_team: 'Canadiens' }]) };
      }
      return { status: 404, json: async () => ({}) };
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
    delete process.env.RAPIDAPI_KEY;
    delete process.env.RAPIDAPI_ODDS_MAX_SPORTS;
  });

  test('writes MLB fixtures key and includes team names', async () => {
    const redis = createInMemoryRedis();
    const handle = startPrefetchScheduler({ redis, intervalSeconds: 60 });
    await new Promise((r) => setTimeout(r, 400));
    const mlbKey = 'rapidapi:baseball_mlb:fixtures:MLB';
    const raw = await redis.get(mlbKey);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw);
    expect(parsed).toHaveProperty('sportKey', 'baseball_mlb');
    expect(Array.isArray(parsed.fixtures)).toBe(true);
    expect(parsed.fixtures[0]).toHaveProperty('home_team', 'Yankees');
    expect(parsed.fixtures[0]).toHaveProperty('away_team', 'Red Sox');
    handle.stop();
  }, 15000);

  test('falls back to sportKey when league and sport_title missing', async () => {
    const redis = createInMemoryRedis();
    const handle = startPrefetchScheduler({ redis, intervalSeconds: 60 });
    await new Promise((r) => setTimeout(r, 400));
    const key = 'rapidapi:icehockey_nhl:fixtures:icehockey_nhl';
    const raw = await redis.get(key);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw);
    expect(parsed).toHaveProperty('sportKey', 'icehockey_nhl');
    expect(parsed.fixtures[0]).toHaveProperty('home_team', 'Bruins');
    expect(parsed.fixtures[0]).toHaveProperty('away_team', 'Canadiens');
    handle.stop();
  }, 15000);
});
