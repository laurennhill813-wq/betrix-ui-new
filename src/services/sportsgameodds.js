import { HttpClient } from './http-client.js';
import { getRedis } from '../lib/redis-factory.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('SportsGameOdds');

// Default to the provider's v2 API (per provider docs). Allow override via env.
const BASE = process.env.SPORTSGAMEODDS_BASE_URL || 'https://api.sportsgameodds.com/v2';
const API_KEY = process.env.SPORTSGAMEODDS_API_KEY || null;
const RATE_LIMIT_PER_MIN = Number(process.env.SPORTSGAMEODDS_RATE_LIMIT_PER_MIN || 10);
const CACHE_TTL_SECONDS = Number(process.env.SPORTSGAMEODDS_CACHE_TTL || 600); // 10 minutes default

function _minuteBucket() {
  return Math.floor(Date.now() / 60000);
}

async function _checkRateLimit(redis) {
  try {
    const key = `ratelimit:sportsgameodds:${_minuteBucket()}`;
    const cur = await redis.incr(key);
    // Set TTL to 70s so it naturally expires
    if (Number(cur) === 1) await redis.expire(key, 70);
    return Number(cur) <= RATE_LIMIT_PER_MIN;
  } catch (e) {
    // If Redis is unavailable, be conservative and allow the caller to attempt
    logger.warn('Rate limit check failed, allowing request', e?.message || String(e));
    return true;
  }
}

async function _request(path, opts = {}, label = 'sgo') {
  const url = `${BASE.replace(/\/$/, '')}${path.startsWith('/') ? path : '/' + path}`;

  // Prefer the provider-specified header `X-Api-Key` (case-insensitive)
  const headers = Object.assign({}, opts.headers || {}, API_KEY ? { 'X-Api-Key': API_KEY } : {});
  try {
    return await HttpClient.fetch(url, { headers }, label);
  } catch (err) {
    // If provider rejects, and we had tried Authorization, attempt x-api-key as fallback
    const status = err && (err.statusCode || err.status || 0);
    if (API_KEY && (!headers['Authorization'])) {
      try {
        const altHeaders = Object.assign({}, opts.headers || {}, { 'X-Api-Key': API_KEY });
        return await HttpClient.fetch(url, { headers: altHeaders }, `${label}-xapikey`);
      } catch (err2) {
        throw err2;
      }
    }
    throw err;
  }
}

async function fetchOdds({ league = 'nba', eventId = null, redis = null, forceFetch = false } = {}) {
  const r = redis || getRedis();
  const key = eventId ? `odds:${league}:${eventId}` : `odds:${league}:latest`;

  // Return cached version if present (and not forcing)
  if (!forceFetch) {
    try {
      const cached = await r.get(key);
      if (cached) {
        try { return JSON.parse(cached); } catch { return cached; }
      }
    } catch (e) { logger.warn('Redis get failed', e?.message || String(e)); }
  }

  // Rate limit guard
  const allowed = await _checkRateLimit(r);
  if (!allowed) {
    // Try to return cached stale value if exists, else throw
    try {
      const stale = await r.get(key);
      if (stale) {
        try { return JSON.parse(stale); } catch { return stale; }
      }
    } catch (e) { /* ignore */ }
    throw new Error('Rate limit exceeded for SportGameOdds API');
  }

  // Build path
  const path = eventId ? `/odds?league=${encodeURIComponent(league)}&eventId=${encodeURIComponent(eventId)}` : `/odds?league=${encodeURIComponent(league)}`;

  const data = await _request(path, {}, `sportsgameodds:odds:${league}`);

  // Cache result
  try {
    await r.setex(key, CACHE_TTL_SECONDS, JSON.stringify(data));
  } catch (e) {
    logger.warn('Redis setex failed', e?.message || String(e));
  }

  return data;
}

async function fetchEvents({ league = 'nba', redis = null, forceFetch = false } = {}) {
  const r = redis || getRedis();
  const key = `events:${league}:latest`;

  if (!forceFetch) {
    try {
      const cached = await r.get(key);
      if (cached) return JSON.parse(cached);
    } catch (e) { /* ignore */ }
  }

  const allowed = await _checkRateLimit(r);
  if (!allowed) throw new Error('Rate limit exceeded for SportGameOdds API');

  const data = await _request(`/events?league=${encodeURIComponent(league)}`, {}, `sportsgameodds:events:${league}`);

  try { await r.setex(key, CACHE_TTL_SECONDS, JSON.stringify(data)); } catch (e) { logger.warn('Redis setex failed', e?.message || String(e)); }
  return data;
}

/**
 * Fetch all pages from /events using cursor pagination.
 * Params accepted mirror provider: league, startsAfter, startsBefore, finalized, limit (max 100)
 * Returns aggregated array of event objects.
 */
async function fetchAllEvents({ league = 'nba', startsAfter, startsBefore, finalized, limit = 100, redis = null, forceFetch = false } = {}) {
  const r = redis || getRedis();
  // Build a stable cache key based on params
  const cacheKey = `events:all:${league}:${startsAfter || ''}:${startsBefore || ''}:${finalized ? '1' : '0'}:L${limit}`;
  if (!forceFetch) {
    try {
      const cached = await r.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (e) { /* ignore */ }
  }

  // pagination loop
  let nextCursor = null;
  const all = [];
  const perPage = Math.min(100, Math.max(1, Number(limit || 100)));

  do {
    // Rate limit guard per request
    const allowed = await _checkRateLimit(r);
    if (!allowed) throw new Error('Rate limit exceeded for SportGameOdds API');

    const qs = new URLSearchParams();
    if (league) qs.set('leagueID', league);
    if (startsAfter) qs.set('startsAfter', startsAfter);
    if (startsBefore) qs.set('startsBefore', startsBefore);
    if (typeof finalized !== 'undefined') qs.set('finalized', finalized ? 'true' : 'false');
    qs.set('limit', String(perPage));
    if (nextCursor) qs.set('cursor', nextCursor);

    const path = `/events?${qs.toString()}`;
    const page = await _request(path, {}, `sportsgameodds:events:page`);
    const items = page?.data || page || [];
    if (Array.isArray(items)) all.push(...items);
    nextCursor = page?.nextCursor || null;
  } while (nextCursor);

  // cache aggregated result for short TTL
  try { await r.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(all)); } catch (e) { logger.warn('Redis setex failed', e?.message || String(e)); }
  return all;
}

/**
 * Fetch teams with cursor pagination. Accepts teamID, leagueID, sportID and limit.
 * Returns aggregated array of team objects.
 */
async function fetchAllTeams({ teamID, leagueID, sportID, limit = 100, redis = null, forceFetch = false } = {}) {
  const r = redis || getRedis();
  const cacheKey = `teams:all:${teamID || ''}:${leagueID || ''}:${sportID || ''}:L${limit}`;
  if (!forceFetch) {
    try { const cached = await r.get(cacheKey); if (cached) return JSON.parse(cached); } catch (e) { /* ignore */ }
  }

  let nextCursor = null;
  const all = [];
  const perPage = Math.min(100, Math.max(1, Number(limit || 100)));
  do {
    const allowed = await _checkRateLimit(r);
    if (!allowed) throw new Error('Rate limit exceeded for SportGameOdds API');

    const qs = new URLSearchParams();
    if (teamID) qs.set('teamID', teamID);
    if (leagueID) qs.set('leagueID', leagueID);
    if (sportID) qs.set('sportID', sportID);
    qs.set('limit', String(perPage));
    if (nextCursor) qs.set('cursor', nextCursor);

    const page = await _request(`/teams?${qs.toString()}`, {}, `sportsgameodds:teams:page`);
    const items = page?.data || page || [];
    if (Array.isArray(items)) all.push(...items);
    nextCursor = page?.nextCursor || null;
  } while (nextCursor);

  try { await r.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(all)); } catch (e) { logger.warn('Redis setex failed', e?.message || String(e)); }
  return all;
}

/**
 * Fetch all paginated odds. Accepts league, eventIDs (comma-separated), limit.
 * Note: requesting many odds may be heavy; consider using oddIDs param to restrict.
 */
async function fetchAllOdds({ league, eventIDs, limit = 100, redis = null, forceFetch = false } = {}) {
  const r = redis || getRedis();
  const cacheKey = `odds:all:${league || ''}:${eventIDs || ''}:L${limit}`;
  if (!forceFetch) {
    try { const cached = await r.get(cacheKey); if (cached) return JSON.parse(cached); } catch (e) { /* ignore */ }
  }

  let nextCursor = null;
  const all = [];
  const perPage = Math.min(100, Math.max(1, Number(limit || 100)));
  do {
    const allowed = await _checkRateLimit(r);
    if (!allowed) throw new Error('Rate limit exceeded for SportGameOdds API');

    const qs = new URLSearchParams();
    if (league) qs.set('league', league);
    if (eventIDs) qs.set('eventIDs', eventIDs);
    qs.set('limit', String(perPage));
    if (nextCursor) qs.set('cursor', nextCursor);

    const page = await _request(`/odds?${qs.toString()}`, {}, `sportsgameodds:odds:page`);
    const items = page?.data || page || [];
    if (Array.isArray(items)) all.push(...items);
    nextCursor = page?.nextCursor || null;
  } while (nextCursor);

  try { await r.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(all)); } catch (e) { logger.warn('Redis setex failed', e?.message || String(e)); }
  return all;
}

/**
 * Fetch provider leagues list. Caches result in Redis under `prefetch:sgo:leagues`.
 * Returns an array of league objects as provided by SGO.
 */
async function fetchLeagues({ redis = null, forceFetch = false } = {}) {
  const r = redis || getRedis();
  const cacheKey = 'prefetch:sgo:leagues';
  if (!forceFetch) {
    try {
      const cached = await r.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (e) { /* ignore */ }
  }
  const data = await _request('/leagues', {}, 'sportsgameodds:leagues');
  // Normalize to an array of league objects (provider may return { data: [...] } or raw array)
  const leaguesArray = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);

  try {
    // Cache the raw response under the main key
    await r.setex(cacheKey, CACHE_TTL_SECONDS * 6, JSON.stringify(leaguesArray));

    // Build a lightweight lookup index to help fallback/resolution in callbacks:
    // map keys: id, leagueID, slug, lowercased name
    const index = {};
    const bySport = {};
    for (const lg of leaguesArray) {
      try {
        if (!lg) continue;
        if (lg.id) index[String(lg.id)] = lg;
        if (lg.leagueID) index[String(lg.leagueID)] = lg;
        if (lg.slug) index[String(lg.slug).toLowerCase()] = lg;
        if (lg.name) index[String(lg.name).toLowerCase()] = lg;
        if (lg.code) index[String(lg.code).toLowerCase()] = lg;

        // Determine sport key (best-effort)
        const sportKey = String(lg.sport || lg.sportID || lg.sportName || (lg.sport && (lg.sport.id || lg.sport.code)) || 'unknown');
        if (!bySport[sportKey]) bySport[sportKey] = [];
        bySport[sportKey].push(lg);
      } catch (e) {
        /* ignore per-item */
      }
    }

    // Persist helpful indexes
    try { await r.setex('prefetch:sgo:leagues:index', CACHE_TTL_SECONDS * 6, JSON.stringify(index)); } catch (e) { logger.warn('Redis setex failed for leagues index', e?.message || String(e)); }
    try { await r.setex('prefetch:sgo:leagues:by-sport', CACHE_TTL_SECONDS * 6, JSON.stringify(bySport)); } catch (e) { logger.warn('Redis setex failed for leagues by-sport', e?.message || String(e)); }
  } catch (e) {
    logger.warn('Redis setex failed', e?.message || String(e));
  }

  return leaguesArray;
}

export { fetchOdds, fetchEvents, fetchAllEvents, fetchAllTeams, fetchAllOdds, fetchLeagues };

export default {
  fetchOdds,
  fetchEvents,
  fetchAllEvents,
  fetchAllTeams,
  fetchAllOdds,
  fetchLeagues
};
