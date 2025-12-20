import { RapidApiFetcher } from '../src/lib/rapidapi-fetcher.js';

describe('Odds API header authentication', () => {
  afterEach(() => { jest.resetAllMocks(); delete process.env.RAPIDAPI_KEY; });

  test('sends X-RapidAPI-Key and X-RapidAPI-Host headers', async () => {
    process.env.RAPIDAPI_KEY = 'secret-123';
    const fetcher = new RapidApiFetcher({ apiKey: process.env.RAPIDAPI_KEY });
    const captured = {};
    global.fetch = jest.fn().mockImplementation(async (url, opts) => {
      captured.url = String(url);
      captured.opts = opts;
      return { status: 200, json: async () => ({}), headers: { entries: () => new Map() } };
    });
    await fetcher.fetchRapidApi('api.the-odds-api.com', '/v4/sports/', {});
    expect(captured.opts).toBeDefined();
    const h = captured.opts.headers || {};
    expect(h['X-RapidAPI-Key'] || h['x-rapidapi-key']).toBe('secret-123');
    expect(h['X-RapidAPI-Host'] || h['x-rapidapi-host']).toBe('api.the-odds-api.com');
  });
});
