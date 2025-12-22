/**
 * Minimal RapidAPI client for Free Football API Data
 * - reads `RAPIDAPI_KEY` from environment
 * - uses host from `RAPIDAPI_HOST_FREE_FOOTBALL` or default
 */
const DEFAULT_HOST = process.env.RAPIDAPI_HOST_FREE_FOOTBALL || 'free-football-api-data.p.rapidapi.com';

async function request(path, params = {}, { host = DEFAULT_HOST, key = process.env.RAPIDAPI_KEY } = {}) {
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

export async function getEventStatistics(eventId, opts) {
  if (!eventId) throw new Error('eventId is required');
  return request('/football-event-statistics', { eventid: eventId }, opts);
}

export async function getMatches(params = {}, opts) {
  return request('/matches', params, opts);
}

export default { getEventStatistics, getMatches };
