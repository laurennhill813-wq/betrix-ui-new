import fetch from '../lib/fetch.js';
import { Logger } from '../utils/logger.js';

const log = new Logger('FlashLive');

export default class FlashLiveService {
  constructor(redis, opts = {}) {
    this.redis = redis;
    this.apiKey = opts.apiKey || process.env.FLASHLIVE_API_KEY || process.env.FLASHLIVE_KEY || null;
    this.host = opts.host || process.env.FLASHLIVE_HOST || 'flashlive-sports-api.hgapi.top';
    this.baseUrl = `https://${this.host}`;
  }

  _headers() {
    const h = { Accept: 'application/json' };
    if (this.apiKey) h['x-portal-apikey'] = this.apiKey;
    return h;
  }

  async fetchPath(path) {
    try {
      const url = `${this.baseUrl}${path}`;
      const res = await fetch(url, { method: 'GET', headers: this._headers() }).catch((e) => { throw e; });
      const body = res && typeof res.json === 'function' ? await res.json().catch(() => null) : null;
      return { httpStatus: res.status, body };
    } catch (e) {
      log.warn('fetchPath failed', e?.message || String(e));
      return { httpStatus: null, body: null, error: e };
    }
  }

  // Get live events list (returns array of events)
  async getLiveEvents(opts = {}) {
    try {
      const q = `?page=${opts.page||0}&locale=${opts.locale||'en_INT'}`;
      const res = await this.fetchPath(`/v1/events/live-list${q}`);
      if (res && res.httpStatus && res.httpStatus >= 200 && res.httpStatus < 300) {
        // some responses return { data: [...] } or array
        const body = res.body || [];
        const arr = Array.isArray(body) ? body : (body && Array.isArray(body.data) ? body.data : []);
        return arr;
      }
      return [];
    } catch (e) { return []; }
  }

  // Get upcoming events (list)
  async getEventsList(params = {}) {
    try {
      const page = params.page || 0;
      const category = params.category_id ? `&category_id=${encodeURIComponent(params.category_id)}` : '';
      const locale = params.locale || 'en_INT';
      const q = `?page=${page}${category}&locale=${locale}`;
      const res = await this.fetchPath(`/v1/events/list${q}`);
      if (res && res.httpStatus && res.httpStatus >= 200 && res.httpStatus < 300) {
        const body = res.body || [];
        return Array.isArray(body) ? body : (body && Array.isArray(body.data) ? body.data : []);
      }
      return [];
    } catch (e) { return []; }
  }
}
