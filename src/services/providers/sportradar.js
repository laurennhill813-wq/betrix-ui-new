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

  // Map canonical types to Sportradar endpoint patterns. Try production-style
  // paths first, then fall back to the trial paths. This helps support keys
  // that are on a production plan vs trial accounts.
  const candidates = [];
  if (sport === 'soccer') {
    if (type === 'competitions') {
      // production then trial
      candidates.push(`/soccer/v4/en/competitions.json`);
      candidates.push(`/soccer/trial/v4/en/competitions.json`);
    } else if (type === 'seasons') {
      candidates.push(`/soccer/v4/en/seasons.json`);
      candidates.push(`/soccer/trial/v4/en/seasons.json`);
    } else if (type === 'matches_by_date' && params.date) {
      candidates.push(`/soccer/v4/en/matches/${params.date}/summaries.json`);
      candidates.push(`/soccer/trial/v4/en/matches/${params.date}/summaries.json`);
    } else if (type === 'standings') {
      candidates.push(`/soccer/v4/en/standings.json`);
      candidates.push(`/soccer/trial/v4/en/standings.json`);
    } else {
      return { error: true, message: `Unsupported type ${type} for sport ${sport}` };
    }
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

  // Try candidate paths in order until one returns ok
  let res = null;
  let lastErr = null;
  for (const pathCandidate of candidates) {
    try {
      res = await fetcher({ base: 'https://api.sportradar.com', path: pathCandidate, auth: DEFAULT_AUTH, key }, opts);
    } catch (e) {
      lastErr = e;
      res = null;
    }
    if (res && res.ok) {
      // found a working endpoint
      break;
    }
  }
  if (!res || !res.ok) {
    // Prefer to return provider response details when available, otherwise propagate error
    if (res) return { error: true, provider: 'Sportradar', status: res.status, headers: res.headers, bodyText: res.bodyText };
    return { error: true, provider: 'Sportradar', message: 'Failed to reach any configured Sportradar endpoint', cause: String(lastErr) };
  }

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

/**
 * Probe available Sportradar endpoints for this key.
 * Returns an object describing which route families succeeded and details.
 */
export async function probeSportradarCapabilities(sport = 'soccer', date = null, opts = {}) {
  const key = process.env.SPORTRADAR_KEY;
  if (!key) return { error: true, message: 'Missing SPORTRADAR_KEY' };

  const fetcher = opts.fetcher || callProvider;
  const base = opts.base || 'https://api.sportradar.com';
  const probeDate = date || new Date().toISOString().slice(0, 10);

  const probes = {};

  // reuse candidate logic for common types
  const candidateMap = {
    competitions: [`/soccer/v4/en/competitions.json`, `/soccer/trial/v4/en/competitions.json`],
    matches_by_date: [
      `/soccer/v4/en/matches/${probeDate}/schedule.json`,
      `/soccer/v4/en/matches/${probeDate}/matches.json`,
      `/soccer/trial/v4/en/matches/${probeDate}/schedule.json`,
      `/soccer/trial/v4/en/matches/${probeDate}/matches.json`,
      `/soccer/v4/en/matches_by_date/${probeDate}.json`,
      `/soccer/trial/v4/en/matches_by_date/${probeDate}.json`
    ]
  };

  for (const [kind, candidates] of Object.entries(candidateMap)) {
    probes[kind] = [];
    for (const p of candidates) {
      try {
        const res = await fetcher({ base, path: p, auth: DEFAULT_AUTH, key }, opts);
        probes[kind].push({ path: p, ok: !!(res && res.ok), status: res && res.status, statusText: res && res.statusText });
      } catch (e) {
        probes[kind].push({ path: p, ok: false, error: String(e) });
      }
    }
  }

  // Summarize
  const summary = {};
  for (const k of Object.keys(probes)) {
    summary[k] = probes[k].some(r => r.ok) ? 'available' : 'unavailable';
  }

  return { ok: true, provider: 'Sportradar', summary, probes };
}
