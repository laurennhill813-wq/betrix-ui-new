// CommonJS preload for Node test runner. Sets a safe global.fetch mock.
function makeResponse(status, body) {
  return {
    status: status,
    ok: status >= 200 && status < 300,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

// Also stub require('node-fetch') so modules importing it get our mock
try {
  const Module = require('module');
  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === 'node-fetch') {
      return global.fetch;
    }
    // Provide a minimal stub for 'pg' so Drizzle/pg doesn't attempt DNS in tests
    if (request === 'pg') {
      class DummyClient {
        constructor() {}
        connect() { return Promise.resolve(); }
        query() { return Promise.resolve({ rows: [] }); }
        end() { return Promise.resolve(); }
      }
      class DummyPool {
        constructor() {}
        connect() { return Promise.resolve(new DummyClient()); }
        query() { return Promise.resolve({ rows: [] }); }
        end() { return Promise.resolve(); }
      }
      return { Client: DummyClient, Pool: DummyPool };
    }

    return originalLoad.apply(this, arguments);
  };
} catch (e) {
  // ignore if we can't patch
}

global.fetch = async function mockedFetch(url, opts) {
  const s = String(url || '');
  // Sportbex
  if (s.includes('trial-api.sportbex.com') || s.includes('sportbex')) {
    if (s.includes('/betfair/competitions')) {
      return makeResponse(200, [ { competition: { id: '12161756', name: 'Sample League' }, marketCount: 10, competitionRegion: 'INT' } ]);
    }
    if (s.includes('/live-score/series')) {
      return makeResponse(200, { message: 'Series fetched successfully', data: [], pageInfo: { total: 0, perPage: 10, page: 1 } });
    }
    return makeResponse(200, {});
  }
  if (s.includes('soccersapi')) {
    return makeResponse(200, { data: [ { id: 1, name: 'Premier League' }, { id: 2, name: 'La Liga' } ] });
  }
  // RapidAPI providers often hit quota in CI; mock common ones explicitly
  if (s.match(/nfl[-_.]?api/i) || s.includes('nfl-api-data') || s.includes('Creativesdev')) {
    return makeResponse(200, [ { team: { id: 'NFL1', displayName: 'Sample Team A', abbreviation: 'STA' } }, { team: { id: 'NFL2', displayName: 'Sample Team B', abbreviation: 'STB' } } ]);
  }
  if (s.match(/betsapi/i) || s.includes('betsapi2') || s.includes('b365api')) {
    return makeResponse(200, { events: [], meta: { note: 'mocked betsapi response' } });
  }
  if (s.match(/newsnow|newsnow.p.|rphrp1985/i)) {
    return makeResponse(200, { articles: [] });
  }
  if (s.includes('rapidapi') || s.includes('odds') || s.includes('the-odds-api')) {
    return makeResponse(200, { success: true, data: [] });
  }
  return makeResponse(200, {});
};

console.log('[test-preload-cjs] global.fetch mocked');
