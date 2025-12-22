/**
 * Minimal RapidAPI client for NFL API Data
 * - reads `RAPIDAPI_KEY` from environment
 * - uses host from `RAPIDAPI_HOST_NFL` or default
 */
const DEFAULT_HOST = process.env.RAPIDAPI_HOST_NFL || 'nfl-api-data.p.rapidapi.com';

async function request(path, params = {}, { host = DEFAULT_HOST, key = process.env.RAPIDAPI_KEY } = {}) {
  // Allow tests to use a local mock without requiring network RapidAPI key
  if (String(process.env.RAPIDAPI_MOCK || '').toLowerCase() === '1' || process.env.NODE_ENV === 'test') {
    // Return a simple mocked payload similar to the real API
    return {
      teams: [
        { id: 1, name: 'Cardinals' },
        { id: 2, name: 'Falcons' },
        { id: 3, name: 'Ravens' },
        { id: 4, name: 'Bills' },
        { id: 5, name: 'Panthers' },
      ],
      fetched_at: new Date().toISOString(),
    };
  }
  if (!key) throw new Error('RAPIDAPI_KEY is not set. Add it to your environment.');
  const url = new URL(`https://${host}${path}`);
  Object.entries(params).forEach(([k, v]) => { if (v != null) url.searchParams.append(k, String(v)); });

  const res = await fetch(url.toString(), {
    headers: {
      'x-rapidapi-host': host,
      'x-rapidapi-key': key,
    },
  });

  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }

  if (!res.ok) {
    const err = new Error(`RapidAPI error ${res.status} ${res.statusText}`);
    err.status = res.status;
    err.body = data;
    throw err;
  }

  return data;
}

export async function getTeamListing() {
  return request('/nfl-team-listing/v1/data');
}

export default { getTeamListing };
