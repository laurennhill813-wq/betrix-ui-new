// Preload for Node tests: provide a safe global.fetch mock to avoid external calls
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);

function makeResponse(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
    text: async () => JSON.stringify(body)
  };
}

global.fetch = async function mockedFetch(url, opts = {}) {
  const s = String(url || '');
  // Sportbex: competitions
  if (s.includes('trial-api.sportbex.com') || s.includes('sportbex')) {
    if (s.includes('/betfair/competitions')) {
      return makeResponse(200, [ { competition: { id: '12161756', name: 'Sample League' }, marketCount: 10, competitionRegion: 'INT' } ]);
    }
    if (s.includes('/live-score/series')) {
      return makeResponse(200, { message: 'Series fetched successfully', data: [], pageInfo: { total: 0, perPage: 10, page: 1 } });
    }
    // generic sportbex
    return makeResponse(200, {});
  }

  // SoccersAPI: leagues
  if (s.includes('soccersapi')) {
    return makeResponse(200, { data: [ { id: 1, name: 'Premier League' }, { id: 2, name: 'La Liga' } ] });
  }

  // RapidAPI / odds APIs: return minimal success shapes to satisfy tests
  if (s.includes('rapidapi') || s.includes('odds') || s.includes('the-odds-api')) {
    return makeResponse(200, { success: true, data: [] });
  }

  // Default: safe empty object
  return makeResponse(200, {});
};

console.log('[test-preload] global.fetch mocked by tests/setup-mock-fetch.mjs', __filename);
