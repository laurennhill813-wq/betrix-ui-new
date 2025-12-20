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
});
