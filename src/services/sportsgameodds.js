import axios from "axios";
import { CONFIG } from "../config.js";
import { Logger } from "../utils/logger.js";

const logger = new Logger("SportGameOdds");

class SportGameOddsService {
  constructor(redis = null) {
    this.redis = redis;
    this.base =
      (CONFIG.SPORTSGAMEODDS && CONFIG.SPORTSGAMEODDS.BASE) ||
      "https://api.sportsgameodds.com/v1";
    this.key = (CONFIG.SPORTSGAMEODDS && CONFIG.SPORTSGAMEODDS.KEY) || null;
    this.cacheTTL =
      (CONFIG.SPORTSGAMEODDS && CONFIG.SPORTSGAMEODDS.CACHE_TTL) || 600;
  }

  _headers() {
    return { Accept: "application/json" };
  }

  // Generic fetch with timeout and graceful error handling
  async _fetch(path, params = {}) {
    if (!this.key) throw new Error("SPORTSGAMEODDS API key not configured");
    const url = path.startsWith("http") ? path : `${this.base}${path}`;

    // Try a set of common auth header/query formats when calling the API
    const headerVariants = [
      { Authorization: `Bearer ${this.key}` },
      { "x-api-key": this.key },
      { "X-API-KEY": this.key },
      { "Api-Key": this.key },
      {},
    ];

    const queryVariants = [
      Object.assign({}, params),
      Object.assign({}, params, { api_key: this.key }),
      Object.assign({}, params, { key: this.key }),
      Object.assign({}, params, { token: this.key }),
    ];

    let lastErr = null;
    for (const q of queryVariants) {
      for (const h of headerVariants) {
        const headers = Object.assign({}, this._headers(), h);
        try {
          const resp = await axios.get(url, {
            headers,
            params: q,
            timeout: 15000,
          });
          return resp.data;
        } catch (e) {
          lastErr = e;
          // continue trying other variants
        }
      }
    }

    logger.warn(
      "SportGameOdds fetch failed",
      lastErr?.message || String(lastErr),
    );
    throw lastErr;
  }

  // Fetch upcoming fixtures for a league (attempts several common endpoint shapes)
  async getUpcomingFixtures(leagueId = null, opts = {}) {
    try {
      const params = Object.assign({}, opts || {});
      if (leagueId) params.league_id = leagueId;

      // Attempt common endpoints
      const candidates = [
        `/events/upcoming`,
        `/fixtures/upcoming`,
        `/events`,
        `/fixtures`,
      ];

      for (const p of candidates) {
        try {
          const data = await this._fetch(p, params);
          const items =
            (data &&
              (data.data || data.events || data.results || data.items)) ||
            data ||
            [];
          if (Array.isArray(items) && items.length > 0) {
            // Normalise minimal shape: { home, away, start_ts, league }
            const normalized = items.map((it) => {
              const homeRaw =
                it.home_team || it.home || (it.teams && it.teams.home) || null;
              const awayRaw =
                it.away_team || it.away || (it.teams && it.teams.away) || null;
              const home =
                homeRaw && typeof homeRaw === "object"
                  ? homeRaw.name ||
                    homeRaw.fullName ||
                    homeRaw.title ||
                    homeRaw.teamName ||
                    null
                  : homeRaw;
              const away =
                awayRaw && typeof awayRaw === "object"
                  ? awayRaw.name ||
                    awayRaw.fullName ||
                    awayRaw.title ||
                    awayRaw.teamName ||
                    null
                  : awayRaw;

              return {
                id: it.id || it.event_id || it.fixture_id || null,
                home: home || null,
                away: away || null,
                start:
                  it.start ||
                  it.start_time ||
                  it.kickoff ||
                  it.date ||
                  it.utcDate ||
                  null,
                raw: it,
              };
            });
            return normalized;
          }
        } catch (e) {
          // try next endpoint
          continue;
        }
      }

      return [];
    } catch (e) {
      logger.warn("getUpcomingFixtures failed", e?.message || String(e));
      return [];
    }
  }
}

export default SportGameOddsService;
