import { jest } from '@jest/globals';
import RapidApiLogger from '../src/lib/rapidapi-logger.js';
import { RapidApiFetcher } from '../src/lib/rapidapi-fetcher.js';

describe('RapidApiLogger', () => {
  let originalEnv;
  beforeEach(() => {
    originalEnv = Object.assign({}, process.env);
    delete process.env.RAPIDAPI_LOG_BODY;
    fetch = jest.fn();
    jest.spyOn(console, 'info').mockImplementation(() => {});
  });
  afterEach(() => {
    process.env = originalEnv;
    jest.resetAllMocks();
  });

  test('logs host/endpoint/status and body when enabled', async () => {
    process.env.RAPIDAPI_LOG_BODY = 'true';
    const body = { ok: true, items: [1,2,3] };
    fetch.mockResolvedValueOnce({ status: 200, json: async () => body, headers: { entries: () => [['content-type','application/json']] } });
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
    fetch.mockResolvedValueOnce({ status: 200, json: async () => ({ big: large }), headers: { entries: () => [] } });
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
