import { jest } from '@jest/globals';
import { RapidApiFetcher } from '../src/lib/rapidapi-fetcher.js';
import { startPrefetchScheduler } from '../src/tasks/prefetch-scheduler.js';
import fs from 'fs';
import path from 'path';

describe('RapidAPI full verification', () => {
  beforeEach(() => {
    process.env.RAPIDAPI_KEY = 'test-key-final';
    process.env.RAPIDAPI_TTL_SEC = String(300);
    // Fetch stub that returns specific statuses for test URLs
    fetch = jest.fn().mockImplementation(async (url) => {
      if (url.includes('/forbidden')) return { status: 403, json: async () => ({ message: 'forbidden' }) };
      if (url.includes('/ratelimit')) return { status: 429, json: async () => ({ message: 'rate limit' }) };
      return { status: 200, json: async () => ({ ok: true, url }) };
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
    delete process.env.RAPIDAPI_KEY;
    delete process.env.RAPIDAPI_TTL_SEC;
  });

  test('all subscriptions produce expected fetch URLs and headers', async () => {
    const p = path.join(process.cwd(), 'src', 'rapidapi', 'subscriptions.json');
    const raw = fs.readFileSync(p, 'utf8');
    const subs = JSON.parse(raw);
    expect(subs.length).toBe(21);

    const f = new RapidApiFetcher();
    for (const s of subs) {
      const host = s.host;
      const endpoint = Array.isArray(s.sampleEndpoints) && s.sampleEndpoints.length ? s.sampleEndpoints[0] : '/';
      await f.fetchRapidApi(host, endpoint);
      const calledUrl = global.fetch.mock.calls[global.fetch.mock.calls.length - 1][0];
      const calledOpts = global.fetch.mock.calls[global.fetch.mock.calls.length - 1][1];
      expect(calledUrl).toBe(`https://${host}${endpoint}`);
      expect(calledOpts.headers['X-RapidAPI-Key']).toBe('test-key-final');
      expect(calledOpts.headers['X-RapidAPI-Host']).toBe(host);
    }
  }, 20000);

  test('scheduler writes TTL-backed rapidapi keys and records http_403/http_429', async () => {
    // Simple in-memory redis mock capturing set/get
    const kv = new Map();
    const calls = [];
    const redis = {
      async set(k, v, ...rest) {
        calls.push({ op: 'set', key: k, value: v, rest });
        kv.set(k, typeof v === 'string' ? v : JSON.stringify(v));
        return 'OK';
      },
      async get(k) {
        calls.push({ op: 'get', key: k });
        return kv.has(k) ? kv.get(k) : null;
      },
      async publish(ch, msg) { calls.push({ op: 'publish', ch, msg }); return 1; },
      async del(k) { calls.push({ op: 'del', key: k }); kv.delete(k); return 1; },
      async incr(k) { return 1; },
      async expire(k, t) { return 1; },
      async keys(pattern) {
        const out = [];
        for (const k of kv.keys()) if (k.startsWith(pattern.replace('*',''))) out.push(k);
        return out;
      }
    };

    // Adjust fetch mock so one endpoint returns 403 and another 429
    fetch = jest.fn().mockImplementation(async (url) => {
      if (url.includes('newsv2_top_news')) return { status: 403, json: async () => ({ message: 'forbidden' }) };
      if (url.includes('v1/events')) return { status: 429, json: async () => ({ message: 'rate limit' }) };
      return { status: 200, json: async () => ({ ok: true, url }) };
    });

    const handle = startPrefetchScheduler({ redis, intervalSeconds: 60 });
    // wait for immediate run
    await new Promise((r) => setTimeout(r, 500));

    // ensure health key written
    const rawHealth = await redis.get('rapidapi:health');
    expect(rawHealth).not.toBeNull();
    const parsed = JSON.parse(rawHealth);
    expect(parsed).toHaveProperty('apis');

    // verify at least 21 rapidapi:* set calls exist
    const rapidSets = calls.filter((c) => c.op === 'set' && c.key && c.key.startsWith('rapidapi:'));
    expect(rapidSets.length).toBeGreaterThanOrEqual(21);

    // each set call should include EX TTL in rest args
    const TTL = Number(process.env.RAPIDAPI_TTL_SEC || 300);
    for (const s of rapidSets) {
      // rest should be ['EX', TTL]
      expect(s.rest && s.rest.length).toBeGreaterThanOrEqual(2);
      expect(s.rest[0]).toBe('EX');
      expect(Number(s.rest[1])).toBe(TTL);
    }

    // check that newsnow endpoint produced http_403 in diagnostics
    const newsEntry = parsed.apis['NewsNow'];
    expect(newsEntry).toBeDefined();
    const newsEpKeys = Object.keys(newsEntry.endpoints || {});
    expect(newsEpKeys.length).toBeGreaterThan(0);
    const found403 = Object.values(newsEntry.endpoints).some((e) => e.errorReason && String(e.errorReason).includes('403'));
    expect(found403).toBe(true);

    // check that AllSportsApi v1/events produced a 429 mapping (or error recorded)
    const allsports = parsed.apis['AllSportsApi'];
    expect(allsports).toBeDefined();
    const found429 = Object.values(allsports.endpoints).some((e) => e.httpStatus === 429 || (e.errorReason && String(e.errorReason).includes('429')));
    expect(found429).toBe(true);

    handle.stop();
  }, 20000);
});
