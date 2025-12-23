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

describe('Heisenbug Premier League normalization', () => {
  afterEach(() => {
    jest.resetAllMocks();
    delete process.env.RAPIDAPI_KEY;
  });

  test('writes rapidapi:soccer:fixtures:premierleague with team names', async () => {
    process.env.RAPIDAPI_KEY = 'test-key';
    global.fetch = jest.fn().mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes('/api/premierleague')) {
        return { status: 200, json: async () => ({ fixtures: [{ home: 'Chelsea', away: 'Arsenal', date: '2025-12-20' }] }), text: async () => JSON.stringify({ fixtures: [{ home: 'Chelsea', away: 'Arsenal' }] }) };
      }
      return { status: 404, json: async () => ({ error: 'Not found' }), text: async () => '{}' };
    });

    const redis = createInMemoryRedis();
    const handle = startPrefetchScheduler({ redis, intervalSeconds: 60 });
    await new Promise((r) => setTimeout(r, 800));
    const key = 'rapidapi:soccer:fixtures:premierleague';
    const raw = await redis.get(key);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw);
    expect(parsed).toHaveProperty('fixtures');
    expect(parsed.fixtures[0]).toHaveProperty('home_team', 'Chelsea');
    expect(parsed.fixtures[0]).toHaveProperty('away_team', 'Arsenal');
    expect(parsed.fixtures[0]).toHaveProperty('date', '2025-12-20');
    handle.stop();
  }, 15000);

  test('logs concise warning and skips on 404', async () => {
    process.env.RAPIDAPI_KEY = 'test-key';
    const logs = [];
    global.fetch = jest.fn().mockImplementation(async (url) => ({ status: 404, json: async () => ({ error: 'Not found' }), text: async () => '{}' }));
    const origInfo = console.info;
    console.info = (...args) => { logs.push(args.join(' ')); };
    const redis = createInMemoryRedis();
    const handle = startPrefetchScheduler({ redis, intervalSeconds: 60 });
    await new Promise((r) => setTimeout(r, 800));
    // ensure no fixtures key written
    const key = 'rapidapi:soccer:fixtures:premierleague';
    const raw = await redis.get(key);
    expect(raw).toBeNull();
    // check logs contain rapidapi-warning concise line
    const found = logs.find(l => l.includes('[rapidapi-warning]') && l.includes('status=404'));
    expect(found).toBeTruthy();
    console.info = origInfo;
    handle.stop();
  }, 15000);
});
