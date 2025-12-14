import { callProvider } from './fetcher.js';
import { cacheGet, cacheSet } from '../../lib/redis-cache.js';

const DEFAULT_AUTH = { method: 'query', queryParam: 'api_key' };

// TTLs in seconds
const TTL = {
  competitions: 24 * 60 * 60,
  seasons: 24 * 60 * 60,
  matches_by_date: 120,
  match_summary: 60,
  odds: 30
};

export async function fetchSportradar(sport, type, params = {}, opts = {}) {
  const key = process.env.SPORTRADAR_KEY;
  if (!key) return { error: true, message: 'Missing SPORTRADAR_KEY' };

  // Map canonical types to Sportradar trial endpoints (minimal mapping)
  let path;
  if (sport === 'soccer') {
    if (type === 'competitions') path = `/soccer/trial/v4/en/competitions.json`;
    else if (type === 'seasons') path = `/soccer/trial/v4/en/seasons.json`;
    else if (type === 'matches_by_date' && params.date) path = `/soccer/trial/v4/en/matches/${params.date}/summaries.json`;
    else if (type === 'standings') path = `/soccer/trial/v4/en/standings.json`;
    else return { error: true, message: `Unsupported type ${type} for sport ${sport}` };
  } else {
    return { error: true, message: `Unsupported sport: ${sport}` };
  }

  // Cache key
  const cacheKey = `betrix:sportradar:${sport}:${type}${params.date ? `:${params.date}` : ''}`;

  // Try cache first
  try {
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return { ok: true, provider: 'Sportradar', data: cached, cached: true };
    }
  } catch (e) {
    // If cache fails, just continue to fetch
  }

  // Allow tests to inject a fetcher to avoid network calls
  const fetcher = opts.fetcher || callProvider;

  const res = await fetcher({ base: 'https://api.sportradar.com', path, auth: DEFAULT_AUTH, key }, opts);
  if (!res.ok) return { error: true, provider: 'Sportradar', status: res.status, headers: res.headers, bodyText: res.bodyText };

  // Very small normalization for competitions/seasons/matches
  if (type === 'competitions') {
    const data = res.body;
    const competitions = (data && data.competitions) ? data.competitions.map(c => ({ id: c.id, name: c.name, country: c.category && c.category.country_code })) : [];
    const payload = { generated_at: data.generated_at, competitions };
    try { await cacheSet(cacheKey, payload, TTL.competitions); } catch (e) { }
    return { ok: true, provider: 'Sportradar', data: payload };
  }

  if (type === 'seasons') {
    const data = res.body;
    const seasons = (data && data.seasons) ? data.seasons.map(s => ({ id: s.id, name: s.name, start_date: s.start_date, end_date: s.end_date, competition_id: s.competition_id })) : [];
    const payload = { generated_at: data.generated_at, seasons };
    try { await cacheSet(cacheKey, payload, TTL.seasons); } catch (e) { }
    return { ok: true, provider: 'Sportradar', data: payload };
  }

  if (type === 'matches_by_date') {
    const data = res.body;
    const payload = data;
    try { await cacheSet(cacheKey, payload, TTL.matches_by_date); } catch (e) { }
    return { ok: true, provider: 'Sportradar', data: payload };
  }

  return { ok: true, provider: 'Sportradar', data: res.body };
}
