import axios from 'axios';
import { CONFIG } from '../config.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('ISportsService');

export default class ISportsService {
  constructor(redis = null) {
    this.redis = redis;
    this.base = (CONFIG.API_FOOTBALL && CONFIG.API_FOOTBALL.BASE) || 'https://v3.football.api-sports.io';
    this.key = (CONFIG.API_FOOTBALL && CONFIG.API_FOOTBALL.KEY) || null;
  }

  _headers() {
    const h = { Accept: 'application/json' };
    if (this.key) h['x-apisports-key'] = this.key;
    return h;
  }

  async getFixtures(leagueId = null, params = {}) {
    try {
      const url = `${this.base.replace(/\/$/, '')}/fixtures`;
      const p = Object.assign({}, params);
      if (leagueId) p.league = leagueId;
      const resp = await axios.get(url, { headers: this._headers(), params: p, timeout: 10000 });
      const data = resp && resp.data && resp.data.response ? resp.data.response : (resp && resp.data ? resp.data : []);
      // Normalize to simple array of items
      if (!Array.isArray(data)) return [];
      return data.map(it => {
        const fixture = it.fixture || it;
        const teams = it.teams || {};
        return {
          id: it.fixture && it.fixture.id ? it.fixture.id : (it.id || null),
          home: (teams.home && (teams.home.name || teams.home.fullName)) || it.home || null,
          away: (teams.away && (teams.away.name || teams.away.fullName)) || it.away || null,
          start: fixture && (fixture.date || fixture.timestamp || fixture.start) || it.date || null,
          raw: it
        };
      });
    } catch (e) {
      logger.warn('ISports getFixtures failed', e?.message || String(e));
      return [];
    }
  }

  async getLivescores(leagueId = null) {
    try {
      const url = `${this.base.replace(/\/$/, '')}/fixtures`;
      const params = { status: 'LIVE' };
      if (leagueId) params.league = leagueId;
      const resp = await axios.get(url, { headers: this._headers(), params, timeout: 10000 });
      const data = resp && resp.data && resp.data.response ? resp.data.response : (resp && resp.data ? resp.data : []);
      if (!Array.isArray(data)) return [];
      return data.map(it => {
        const fixture = it.fixture || it;
        const teams = it.teams || {};
        return {
          id: it.fixture && it.fixture.id ? it.fixture.id : (it.id || null),
          home: (teams.home && (teams.home.name || teams.home.fullName)) || it.home || null,
          away: (teams.away && (teams.away.name || teams.away.fullName)) || it.away || null,
          start: fixture && (fixture.date || fixture.timestamp || fixture.start) || it.date || null,
          raw: it
        };
      });
    } catch (e) {
      logger.warn('ISports getLivescores failed', e?.message || String(e));
      return [];
    }
  }
}
