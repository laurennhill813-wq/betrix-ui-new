import { RapidApiFetcher } from '../src/lib/rapidapi-fetcher.js';

describe('Odds API header auth', () => {
  test('adds x-api-key header for direct The Odds API host', () => {
    const f = new RapidApiFetcher({ apiKey: 'SAMPLEKEY' });
    const headers = f._buildHeaders('api.the-odds-api.com');
    expect(headers['x-api-key'] || headers['X-RapidAPI-Key']).toBeDefined();
    expect(headers['x-api-key']).toBe('SAMPLEKEY');
  });
});
