import { RapidApiFetcher } from "../src/lib/rapidapi-fetcher.js";

describe("RapidApiFetcher", () => {
  beforeEach(() => {
    process.env.RAPIDAPI_KEY = "test-key-123";
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ ok: true }),
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
    delete process.env.RAPIDAPI_KEY;
  });

  test("builds correct URL and headers", async () => {
    const f = new RapidApiFetcher();
    const host = "example.p.rapidapi.com";
    const endpoint = "/v1/test?x=1";
    const res = await f.fetchRapidApi(host, endpoint);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const calledUrl = global.fetch.mock.calls[0][0];
    const calledOpts = global.fetch.mock.calls[0][1];
    expect(calledUrl).toBe(`https://${host}${endpoint}`);
    expect(calledOpts.headers["X-RapidAPI-Key"]).toBe("test-key-123");
    expect(calledOpts.headers["X-RapidAPI-Host"]).toBe(host);
    expect(res.httpStatus).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  test("maps 403 and 429 to errorReason when present", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({ status: 403, json: async () => ({ message: 'forbidden' }) });
    const f = new RapidApiFetcher();
    const r403 = await f.fetchRapidApi("example.p.rapidapi.com", "/forbidden");
    expect(r403.httpStatus).toBe(403);
    global.fetch = jest.fn().mockResolvedValueOnce({ status: 429, json: async () => ({ message: 'rate limit' }) });
    const r429 = await f.fetchRapidApi("example.p.rapidapi.com", "/ratelimit");
    expect(r429.httpStatus).toBe(429);
  });

  test("preserves header entries returned by fetch", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      status: 200,
      json: async () => ({ ok: true }),
      headers: {
        entries: () => [['x-requests-remaining', '42'], ['x-ratelimit-limit', '1000']].values(),
      },
    });
    const f = new RapidApiFetcher();
    const r = await f.fetchRapidApi('example.p.rapidapi.com', '/hdrs');
    expect(r.headers['x-requests-remaining']).toBe('42');
    expect(r.headers['x-ratelimit-limit']).toBe('1000');
  });
});
