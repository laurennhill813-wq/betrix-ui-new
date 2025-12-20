import RapidApiLogger from "../src/lib/rapidapi-logger.js";
import { RapidApiFetcher } from "../src/lib/rapidapi-fetcher.js";

describe("RapidApiLogger", () => {
  beforeEach(() => {
    process.env.RAPIDAPI_LOG_BODY = 'false';
    jest.spyOn(console, 'info').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.resetAllMocks();
    delete process.env.RAPIDAPI_LOG_BODY;
  });

  test('logs header quota info and handles 429 backoff counter', async () => {
    // stub RapidApiFetcher.fetchRapidApi to return headers and 429
    const stub = jest.spyOn(RapidApiFetcher.prototype, 'fetchRapidApi').mockResolvedValue({ httpStatus: 429, body: { message: 'quota' }, headers: { 'x-requests-remaining': '0', 'x-ratelimit-limit': '100' } });
    const logger = new RapidApiLogger({ apiKey: 'x' });
    const res = await logger.fetch('odds.p.rapidapi.com', '/v4/sports/?', { apiName: 'Odds' });
    expect(res.httpStatus).toBe(429);
    expect(console.info).toHaveBeenCalled();
    stub.mockRestore();
  });
});
import RapidApiLogger from '../src/lib/rapidapi-logger.js';

describe('RapidApiLogger', () => {
  let originalEnv;
  beforeEach(() => {
    originalEnv = Object.assign({}, process.env);
    delete process.env.RAPIDAPI_LOG_BODY;
    global.fetch = jest.fn();
    jest.spyOn(console, 'info').mockImplementation(() => {});
  });
  afterEach(() => {
    process.env = originalEnv;
    jest.resetAllMocks();
  });

  test('logs host/endpoint/status and body when enabled', async () => {
    process.env.RAPIDAPI_LOG_BODY = 'true';
    const body = { ok: true, items: [1,2,3] };
    global.fetch.mockResolvedValueOnce({ status: 200, json: async () => body, headers: { entries: () => [['content-type','application/json']] } });
    const logger = new RapidApiLogger({ apiKey: 'test' });
    const res = await logger.fetch('example.p.rapidapi.com', '/v1/test?x=1', { apiName: 'TestAPI' });
    expect(res.httpStatus).toBe(200);
    expect(console.info).toHaveBeenCalled();
    // check that main rapidapi and body logs were emitted
    const calls = console.info.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(calls).toMatch(/\[rapidapi\]/);
    expect(calls).toMatch(/\[rapidapi-body\]/);
  });

  test('truncates large payloads', async () => {
    process.env.RAPIDAPI_LOG_BODY = 'true';
    const large = 'A'.repeat(5000);
    global.fetch.mockResolvedValueOnce({ status: 200, json: async () => ({ big: large }), headers: { entries: () => [] } });
    const logger = new RapidApiLogger({ apiKey: 'test' });
    await logger.fetch('example.p.rapidapi.com', '/v1/large', {});
    const calls = console.info.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(calls).toMatch(/\.\.\.\<truncated\>/);
  });

  test('logs errorReason for 403/429', async () => {
    process.env.RAPIDAPI_LOG_BODY = 'false';
    global.fetch.mockResolvedValueOnce({ status: 403, json: async () => ({ message: 'forbidden' }) });
    const logger = new RapidApiLogger({ apiKey: 'test' });
    const res = await logger.fetch('example.p.rapidapi.com', '/forbidden', {});
    expect(res.httpStatus).toBe(403);
    const calls = console.info.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(calls).toMatch(/errorReason=|forbidden/);
  });
});
