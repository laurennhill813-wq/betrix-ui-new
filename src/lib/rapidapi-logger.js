import { RapidApiFetcher } from './rapidapi-fetcher.js';
import { getRedisClient, cacheSet, incrWithTTL } from './redis-cache.js';

const DEFAULT_TRUNCATE = 2048; // bytes ~2KB

export class RapidApiLogger {
  constructor({ apiKey } = {}) {
    this.fetcher = new RapidApiFetcher({ apiKey });
    this.logBody = String(process.env.RAPIDAPI_LOG_BODY || '').toLowerCase() === 'true';
    this.truncate = Number(process.env.RAPIDAPI_BODY_TRUNCATE_BYTES || DEFAULT_TRUNCATE);
    this.backoffSeconds = Number(process.env.RAPIDAPI_BACKOFF_SECONDS || 3600);
    this.backoffThreshold = Number(process.env.RAPIDAPI_BACKOFF_THRESHOLD || 3);
  }

  _safeHeadersForLog(originalHeaders) {
    try {
      const h = Object.assign({}, originalHeaders || {});
      // Remove sensitive keys if present
      if (h['x-rapidapi-key']) delete h['x-rapidapi-key'];
      if (h['X-RapidAPI-Key']) delete h['X-RapidAPI-Key'];
      return h;
    } catch (e) {
      return {};
    }
  }

  _truncateBody(body) {
    try {
      if (body === null || body === undefined) return null;
      const s = typeof body === 'string' ? body : JSON.stringify(body);
      if (s.length <= this.truncate) return s;
      return s.slice(0, this.truncate) + '...<truncated>';
    } catch (e) {
      return String(body).slice(0, this.truncate) + '...<truncated>';
    }
  }

  async fetch(host, endpoint, opts = {}) {
    const url = (() => {
      try {
        return new URL(`https://${host}${endpoint}`);
      } catch (e) {
        try {
          return new URL(`https://${host}${endpoint.replace(/\s/g, '')}`);
        } catch (e2) {
          return { href: `https://${host}${endpoint}`, searchParams: new URLSearchParams() };
        }
      }
    })();

    const query = url.searchParams ? Object.fromEntries(url.searchParams.entries()) : {};

    // honor provider-level backoff if present
    try {
      const redis = getRedisClient();
      if (redis) {
        try {
          const backoffKey = `rapidapi:backoff:${host}`;
          const off = await redis.get(backoffKey).catch(() => null);
          if (off) {
            console.info(`[rapidapi] backoff_active=true host=${host} backoffKey=${backoffKey}`);
            return { httpStatus: null, body: null, error: { message: 'backoff_active' } };
          }
        } catch (e) {
          /* ignore redis errors */
        }
      }
    } catch (e) {}

    // call the underlying fetcher
    const result = await this.fetcher.fetchRapidApi(host, endpoint, opts).catch((e) => ({ httpStatus: null, body: null, error: { message: String(e && e.message ? e.message : e) } }));

    // Prepare headers log (exclude key)
    const hdrs = this._safeHeadersForLog(result.headers || {});

    // Main log line
    try {
      const info = {
        host,
        endpoint,
        url: url.href || `${host}${endpoint}`,
        query,
        status: result.httpStatus || null,
        apiName: opts.apiName || opts.api || null,
        timestamp: new Date().toISOString(),
      };
      // Write via console.info so Render picks it up readily
      console.info('[rapidapi] ' + Object.entries(info).map(([k, v]) => `${k}=${typeof v==='string'?v:v}`).join(' '));
    } catch (e) {
      console.info('[rapidapi] log-error', e && e.message ? e.message : String(e));
    }

    // Body log
    try {
      const shouldLogBody = this.logBody;
      if (shouldLogBody) {
        const truncated = this._truncateBody(result.body);
        console.info('[rapidapi-body] ' + String(truncated || '').slice(0, this.truncate + 50));
      } else if (result && result.httpStatus && result.httpStatus >= 400) {
        // For errors, always log a small body/errorReason
        const truncated = this._truncateBody(result.body || result.error || {});
        console.info('[rapidapi-body] ' + String(truncated || '').slice(0, 600));
      }
    } catch (e) {
      console.info('[rapidapi-body] log-error', e && e.message ? e.message : String(e));
    }

    // Persist quota/health info to Redis (if available)
    try {
      const redis = getRedisClient();
      if (redis) {
        const hdrs = result.headers || {};
        const quota = {
          apiName: opts.apiName || opts.api || null,
          host,
          endpoint,
          httpStatus: result.httpStatus || null,
          updatedAt: Date.now(),
          headers: {
            'x-ratelimit-limit': hdrs['x-ratelimit-limit'] || hdrs['x-ratelimit-Limit'] || null,
            'x-ratelimit-remaining': hdrs['x-ratelimit-remaining'] || hdrs['x-ratelimit-Remaining'] || hdrs['x-requests-remaining'] || null,
            'x-ratelimit-reset': hdrs['x-ratelimit-reset'] || hdrs['x-ratelimit-Reset'] || null,
          },
        };
        try {
          await cacheSet(`rapidapi:health:${host}`, quota, Number(process.env.RAPIDAPI_TTL_SEC || 300));
        } catch (e) {
          /* ignore cache errors */
        }

        // handle 429 backoff counting
        if (result && result.httpStatus === 429) {
          try {
            const count = await incrWithTTL(`rapidapi:429count:${host}`, this.backoffSeconds).catch(() => 1);
            if (Number(count) >= this.backoffThreshold) {
              const backoffKey = `rapidapi:backoff:${host}`;
              try {
                // set a backoff flag with TTL so other processes skip this host
                await redis.set(backoffKey, '1', 'EX', this.backoffSeconds).catch(() => {});
                console.info(`[rapidapi] backoff_set host=${host} ttl=${this.backoffSeconds} threshold=${this.backoffThreshold}`);
              } catch (e) {}
            }
          } catch (e) {
            /* ignore */
          }
        }
      }
    } catch (e) {
      /* ignore */
    }

    // For error statuses, add structured diagnostics to result
    if (result && (result.httpStatus === 403 || result.httpStatus === 429 || (result.error && result.error.message))) {
      const errReason = result.error && result.error.message ? result.error.message : `http_${result.httpStatus}`;
      try {
        console.info('[rapidapi] errorReason=' + errReason + ' endpoint=' + endpoint + ' timestamp=' + new Date().toISOString());
      } catch (e) {}
    }

    return result;
  }
}

export default RapidApiLogger;
