import { startPrefetchScheduler } from "../src/tasks/prefetch-scheduler.js";

function createInMemoryRedis() {
  const kv = new Map();
  return {
    async set(k, v) { kv.set(k, typeof v === 'string' ? v : JSON.stringify(v)); return 'OK'; },
    async get(k) { return kv.has(k) ? kv.get(k) : null; },
    async publish() { return 1; },
    async del(k) { kv.delete(k); return 1; },
    async expire() { return 1; },
    async keys(pattern) { const re = new RegExp('^' + pattern.replace(/\*/g,'.*') + '$'); return Array.from(kv.keys()).filter(k=>re.test(k)); }
  };
}

describe('NewsNow and TVPRO endpoints', () => {
  beforeEach(() => {
    process.env.RAPIDAPI_KEY = 'test-key';
    global.fetch = jest.fn().mockImplementation(async (url, opts) => {
      const u = String(url);
      if (u.includes('/top_news') || u.includes('/news?category=sports')) {
        return { status: 200, json: async () => ({ articles: [{ title: 'Match recap' }] }), text: async () => JSON.stringify({ articles: [{ title: 'Match recap' }] }) };
      }
      if (u.includes('/channels') || u.includes('/programs')) {
        return { status: 200, json: async () => ({ channels: [{ id: 'c1', name: 'Sports Channel' }] }), text: async () => JSON.stringify({ channels: [{ id: 'c1' }] }) };
      }
      return { status: 404, json: async () => ({ error: 'Not found' }), text: async () => '{}' };
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
    delete process.env.RAPIDAPI_KEY;
  });

  test('writes NewsNow and TVPRO sample keys without error', async () => {
    const redis = createInMemoryRedis();
    const handle = startPrefetchScheduler({ redis, intervalSeconds: 60 });
    await new Promise(r => setTimeout(r, 400));
    const keys = await redis.keys('rapidapi:*');
    expect(keys.length).toBeGreaterThan(0);
    // ensure one of the newsnow or tvpro-related store keys exist
    const found = keys.find(k => /newsnow|tvpro|news/i.test(k));
    expect(found).toBeTruthy();
    handle.stop();
  }, 15000);
});
