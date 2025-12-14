/**
 * SportMonks Service
 * Lightweight wrapper around the SportsMonks Football API used as a fallback
 * provider for live scores, fixtures and metadata.
 */
import fetch from 'node-fetch';
import axios from 'axios';
import https from 'https';
import dns from 'dns';
import { URL } from 'url';
import { CONFIG } from '../config.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('SportMonksService');
// Mark imports that may be optional or used conditionally to avoid lint noise
void fetch; void dns; void URL;

export default class SportMonksService {
  constructor(redis = null) {
    this.redis = redis;
    // Try multiple possible SportMonks endpoints/IPs in order of preference
    // Primary: official v3 API, Secondary: try without /v3, Tertiary: direct IP if known
    this.baseUrls = [
      (CONFIG.SPORTSMONKS && CONFIG.SPORTSMONKS.BASE) || 'https://api.sportsmonks.com/v3',
      'https://api.sportmonks.com/v3', // alternate spelling (without 's')
      'https://www.api.sportsmonks.com/v3' // try www prefix
    ];
    this.base = this.baseUrls[0];
    // Accept multiple possible env var names for the API token to be resilient
    this.key = (CONFIG.SPORTSMONKS && CONFIG.SPORTSMONKS.KEY) || process.env.SPORTSMONKS_API_KEY || process.env.SPORTSMONKS_API || process.env.SPORTSMONKS_TOKEN || null;
    
    // Do NOT override DNS globally - that affects all Node requests
    // Instead, we'll use proxy/agent per-request
    logger.info(`[SportMonksService] Initialized with base URL: ${this.base}`);
  }

  _buildUrl(endpoint, query = {}) {
    return this._buildUrlWithBase(this.base, endpoint, query);
  }

  _buildUrlWithBase(base, endpoint, query = {}) {
    const urlBase = base.replace(/\/+$/, '');
    const parts = [urlBase, 'football', endpoint].map(p => String(p).replace(/^\/+|\/+$/g, ''));
    const q = Object.assign({}, query);
    if (this.key) q.api_token = this.key;
    const qs = Object.keys(q).map(k => `${encodeURIComponent(k)}=${encodeURIComponent(q[k])}`).join('&');
    return `${parts.join('/')}${qs ? `?${qs}` : ''}`;
  }

  async _fetch(endpoint, query = {}) {
    // Support multiple auth strategies. By default use query param `api_token` (legacy)
    // Fallback strategies: Authorization header Bearer, alternate query names ('token','access_token')
    const strategies = this._smStrategy
      ? [this._smStrategy]
      : ['query_api_token', 'header_bearer', 'query_token', 'query_access_token'];

    for (const strat of strategies) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const baseIndex = (attempt === 1) ? 0 : 1;
          const currentBase = this.baseUrls[baseIndex % this.baseUrls.length];

          // Build url & headers according to strategy
          let url;
          let headers = { Accept: 'application/json' };
          if (strat === 'query_api_token') {
            url = this._buildUrlWithBase(currentBase, endpoint, query);
          } else if (strat === 'query_token') {
            const q = Object.assign({}, query, { token: this.key });
            url = this._buildUrlWithBase(currentBase, endpoint, q);
          } else if (strat === 'query_access_token') {
            const q = Object.assign({}, query, { access_token: this.key });
            url = this._buildUrlWithBase(currentBase, endpoint, q);
          } else if (strat === 'header_bearer') {
            // build URL without token param
            url = this._buildUrlWithBase(currentBase, endpoint, Object.assign({}, query));
            headers.Authorization = `Bearer ${this.key}`;
          } else {
            // default fallback to query_api_token
            url = this._buildUrlWithBase(currentBase, endpoint, query);
          }

          const safeUrlForLog = String(url).replace(/(api_token=[^&]+)/gi, 'api_token=REDACTED').replace(/(token=[^&]+)/gi, 'token=REDACTED').replace(/(access_token=[^&]+)/gi, 'access_token=REDACTED');
          logger.info(`[SportMonksService] Requesting (strategy:${strat}) ${safeUrlForLog}`);

          const insecure = (process.env.SPORTSMONKS_INSECURE === 'true');
          const agent = new https.Agent({ rejectUnauthorized: !insecure, keepAlive: true, maxSockets: 50 });
          const resp = await axios.get(url, { timeout: 15000, httpsAgent: agent, headers });
          const data = resp && resp.data ? resp.data : null;
          if (!data) throw new Error('Empty response from SportMonks');

          // remember successful strategy for subsequent calls
          this._smStrategy = strat;
          // persist strategy to redis for diagnostics if available
          try {
            if (this.redis && typeof this.redis.set === 'function') {
              const key = `betrix:provider:strategy:sportsmonks`;
              await this.redis.set(key, String(strat));
              await this.redis.expire(key, Number(process.env.PROVIDER_STRATEGY_TTL || 3600));
            }
          } catch (err) {
            logger.debug('Failed to persist SportMonks strategy to redis', err?.message || String(err));
          }
          return data && (data.data || data) ? (data.data || data) : data;
        } catch (e) {
          try {
            const status = e && e.response && e.response.status ? e.response.status : 'N/A';
            logger.warn(`[SportMonksService] strategy ${strat} attempt ${attempt} failed | endpoint:${endpoint} | status:${status} | error:${e?.message || String(e)}`);
            if (e && e.response && e.response.data) {
              const snippet = typeof e.response.data === 'string' ? e.response.data.substring(0,200) : JSON.stringify(e.response.data).substring(0,200);
              logger.info(`[SportMonksService] response body: ${snippet}`);
            }
            // Special-case TLS certificate problems — log an actionable message and temporarily backoff prefetch attempts
            const msg = String(e?.message || '').toLowerCase();
            if (msg.includes('certificate has expired') || (e && e.code === 'CERT_HAS_EXPIRED')) {
              logger.error('[SportMonksService] TLS certificate appears expired or invalid for SportMonks endpoint.');
              logger.error('[SportMonksService] Recommended actions: (1) verify SPORTSMONKS_BASE env, (2) contact SportMonks support, or (3) set SPORTSMONKS_INSECURE=true for short-term testing only.');
              // Attempt to capture peer certificate details from the underlying socket (if available)
              try {
                const sock = e && e.request && e.request.socket ? e.request.socket : (e && e.config && e.config.transport && e.config.transport.socket ? e.config.transport.socket : null);
                if (sock && typeof sock.getPeerCertificate === 'function') {
                  const cert = sock.getPeerCertificate(true);
                  const certInfo = {
                    subject: cert && cert.subject ? cert.subject : undefined,
                    issuer: cert && cert.issuer ? cert.issuer : undefined,
                    valid_from: cert && cert.valid_from ? cert.valid_from : undefined,
                    valid_to: cert && cert.valid_to ? cert.valid_to : undefined,
                    fingerprint: cert && cert.fingerprint ? cert.fingerprint : undefined,
                  };
                  logger.info('[SportMonksService] Peer certificate details:', JSON.stringify(certInfo));
                }
              } catch (certLogErr) {
                logger.debug('[SportMonksService] Failed to read peer certificate details', certLogErr?.message || String(certLogErr));
              }
              try {
                if (this.redis && typeof this.redis.set === 'function') {
                  const now = Math.floor(Date.now() / 1000);
                  const pauseSec = Number(process.env.SPORTSMONKS_TLS_PAUSE_SECONDS || 300);
                  const next = now + pauseSec;
                  await this.redis.set('prefetch:next:sportsmonks', String(next), 'EX', Math.min(3600, pauseSec + 60)).catch(()=>{});
                  logger.info(`[SportMonksService] Temporarily pausing sportmonks prefetch for ${pauseSec}s (prefetch:next:sportsmonks=${next})`);
                }
              } catch(_) { void _; }
            }
          } catch (logErr) { logger.error('Error logging SportMonks fetch failure:', logErr.message); }

          // If this strategy caused an auth failure, try the next strategy immediately
          if (attempt < 2) {
            const waitMs = 300 * Math.pow(2, attempt - 1);
            await new Promise(r => setTimeout(r, waitMs));
            continue;
          }
          // try next strategy in outer loop
        }
      }
    }

    // all strategies exhausted
    logger.warn(`[SportMonksService] All auth strategies exhausted for endpoint ${endpoint}`);
    return null;
  }

  async getLivescores(leagueId = null) {
    try {
      const q = {};
      if (leagueId) q.league_id = leagueId;
      // SportMonks endpoint: livescores
      const data = await this._fetch('livescores', q);
      if (!data) return [];
      // data may be array or object wrapper
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.data)) return data.data;
      // some responses include a `result` or `results` array
      if (data && Array.isArray(data.results)) return data.results;
      return [];
    } catch (e) {
      logger.warn('getLivescores error', e?.message || String(e));
      return [];
    }
  }

  /**
   * Generic paginated fetch helper - will iterate pages until exhausted or until a safety cap
   */
  async _fetchAll(endpoint, query = {}) {
    try {
      const perPage = Number(process.env.SPORTSMONKS_PER_PAGE || 250);
      const maxPages = Number(process.env.SPORTSMONKS_MAX_PAGES || 20);
      let page = 1;
      let results = [];

      while (page <= maxPages) {
        const q = Object.assign({}, query, { page, per_page: perPage });
        const pageData = await this._fetch(endpoint, q);
        if (!pageData) break;

        // pageData may be array or object with data[]
        const arr = Array.isArray(pageData) ? pageData : (Array.isArray(pageData.data) ? pageData.data : (Array.isArray(pageData.results) ? pageData.results : null));
        if (arr && arr.length > 0) {
          results = results.concat(arr);
        } else if (Array.isArray(pageData) && pageData.length === 0) {
          break;
        } else if (!arr && page === 1) {
          // single-page non-array response - return it as-is
          return pageData;
        }

        // Try to detect explicit pagination metadata
        const meta = pageData && pageData.meta ? pageData.meta : (pageData && pageData.pagination ? pageData.pagination : null);
        if (meta && meta.pagination && meta.pagination.total_pages) {
          if (page >= meta.pagination.total_pages) break;
        }

        // If returned items are less than perPage, assume last page
        if (arr && arr.length < perPage) break;

        page += 1;
      }

      return results;
    } catch (e) {
      logger.warn('_fetchAll failed', e?.message || String(e));
      return null;
    }
  }

  /**
   * Get all live matches globally (no league filter)
   * Used for comprehensive live feed
   */
  async getAllLiveMatches() {
    try {
      // Try to fetch all pages where supported. Fallback to single _fetch if pagination isn't supported.
      const paged = await this._fetchAll('livescores', {});
      if (paged && Array.isArray(paged) && paged.length > 0) return paged;
      const single = await this._fetch('livescores', {});
      if (!single) return [];
      if (Array.isArray(single)) return single;
      if (single && Array.isArray(single.data)) return single.data;
      if (single && Array.isArray(single.results)) return single.results;
      return [];
    } catch (e) {
      logger.warn('getAllLiveMatches error', e?.message || String(e));
      return [];
    }
  }

  async getFixtures(params = {}) {
    // Use paginated fetch to retrieve a large set of fixtures when available
    const paged = await this._fetchAll('fixtures', params);
    if (paged && Array.isArray(paged)) return paged;
    const single = await this._fetch('fixtures', params);
    return single || [];
  }

  async getLeagues(params = {}) {
    return await this._fetch('leagues', params) || [];
  }

  async getSeasons(params = {}) {
    return await this._fetch('seasons', params) || [];
  }

  async getTeams(params = {}) {
    return await this._fetch('teams', params) || [];
  }

  async getPlayers(params = {}) {
    return await this._fetch('players', params) || [];
  }

  async getVenues(params = {}) {
    return await this._fetch('venues', params) || [];
  }

  // Convenience: fetch a set of common endpoints in parallel
  async fetchAll() {
    const endpoints = ['livescores', 'fixtures', 'leagues', 'seasons', 'teams', 'players', 'venues'];
    try {
      const promises = endpoints.map(ep => this._fetch(ep));
      const results = await Promise.all(promises);
      const out = {};
      endpoints.forEach((ep, i) => out[ep] = results[i] || []);
      return out;
    } catch (e) {
      logger.warn('fetchAll failed', e?.message || String(e));
      return null;
    }
  }
}
