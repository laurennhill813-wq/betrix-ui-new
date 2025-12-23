/**
 * Unified Sports API Client
 * Integrates all verified RapidAPI endpoints for fixtures, odds, and team data
 * Provides consistent interface for the bot to fetch sports data
 */

import fetch from 'node-fetch';

const API_KEY = process.env.RAPIDAPI_KEY || 'd04027f383msh0b0565415dfbe6dp1fc23bjsn22d9d050080e';

// Configuration for all working APIs organized by sport/data type
const API_CONFIG = {
  // NFL Data
  nfl_teams: {
    name: 'NFL Teams',
    url: 'https://nfl-api-data.p.rapidapi.com/nfl-team-listing/v1/data',
    host: 'nfl-api-data.p.rapidapi.com',
    sport: 'NFL',
    dataType: 'teams',
    method: 'GET'
  },

  // Soccer/Football APIs
  premier_league: {
    name: 'Premier League Teams',
    url: 'https://heisenbug-premier-league-live-scores-v1.p.rapidapi.com/api/premierleague/team?name=',
    host: 'heisenbug-premier-league-live-scores-v1.p.rapidapi.com',
    sport: 'Soccer',
    dataType: 'team_lookup',
    method: 'GET',
    requiresParam: 'team_name'
  },

  free_livescore: {
    name: 'LiveScore Search',
    url: 'https://free-livescore-api.p.rapidapi.com/livescore-get-search?sportname=soccer&search=',
    host: 'free-livescore-api.p.rapidapi.com',
    sport: 'Soccer',
    dataType: 'matches',
    method: 'GET',
    requiresParam: 'search_term'
  },

  // Basketball
  sports_info: {
    name: 'Basketball News/Info',
    url: 'https://sports-information.p.rapidapi.com/mbb/news?limit=30',
    host: 'sports-information.p.rapidapi.com',
    sport: 'Basketball',
    dataType: 'news',
    method: 'GET'
  },

  // Multi-Sport Odds & Fixtures
  sofascore: {
    name: 'SofaScore Matches (H2H)',
    url: 'https://sofascore.p.rapidapi.com/matches/get-h2h?matchId=',
    host: 'sofascore.p.rapidapi.com',
    sport: 'Multi-Sport',
    dataType: 'h2h_stats',
    method: 'GET',
    requiresParam: 'match_id'
  },

  betsapi: {
    name: 'Bet365 Matches',
    url: 'https://betsapi2.p.rapidapi.com/v3/bet365/prematch',
    host: 'betsapi2.p.rapidapi.com',
    sport: 'Multi-Sport',
    dataType: 'upcoming_matches',
    method: 'GET'
  },

  therundown: {
    name: 'TheRundown Conferences',
    url: 'https://therundown-therundown-v1.p.rapidapi.com/sports/1/conferences',
    host: 'therundown-therundown-v1.p.rapidapi.com',
    sport: 'Multi-Sport',
    dataType: 'conferences',
    method: 'GET'
  },

  // Odds & Predictions
  odds_api1: {
    name: 'Match Odds & Scores',
    url: 'https://odds-api1.p.rapidapi.com/scores?fixtureId=',
    host: 'odds-api1.p.rapidapi.com',
    sport: 'Multi-Sport',
    dataType: 'odds',
    method: 'GET',
    requiresParam: 'fixtureId'
  },

  bet365_inplay: {
    name: 'Bet365 Live Leagues',
    url: 'https://bet365-api-inplay.p.rapidapi.com/bet365/get_leagues',
    host: 'bet365-api-inplay.p.rapidapi.com',
    sport: 'Multi-Sport',
    dataType: 'live_leagues',
    method: 'GET'
  },

  pinnacle: {
    name: 'Pinnacle Odds Periods',
    url: 'https://pinnacle-odds.p.rapidapi.com/kit/v1/meta-periods?sport_id=1',
    host: 'pinnacle-odds.p.rapidapi.com',
    sport: 'Multi-Sport',
    dataType: 'odds_periods',
    method: 'GET'
  },

  // News
  newsnow: {
    name: 'Top Sports News',
    url: 'https://newsnow.p.rapidapi.com/newsv2_top_news',
    host: 'newsnow.p.rapidapi.com',
    sport: 'News',
    dataType: 'news_feed',
    method: 'POST'
  }
  ,
  // Additional providers (previously reported as missing in diagnostics)
  football_live_stream: {
    name: 'Football Live Stream Lookup',
    url: 'https://football-live-streams.p.rapidapi.com/streams?team=',
    host: 'football-live-streams.p.rapidapi.com',
    sport: 'Soccer',
    dataType: 'streams',
    method: 'GET',
    requiresParam: 'team_name',
    enabled: false
  },
  free_football_data: {
    name: 'Free Football Data',
    url: 'https://free-football.p.rapidapi.com/api/v1/teams',
    host: 'free-football.p.rapidapi.com',
    sport: 'Soccer',
    dataType: 'teams',
    method: 'GET',
    enabled: false
  },
  sportspage_feeds: {
    name: 'Sportspage Feeds',
    url: 'https://sportspage-feeds.p.rapidapi.com/feeds',
    host: 'sportspage-feeds.p.rapidapi.com',
    sport: 'Multi-Sport',
    dataType: 'feeds',
    method: 'GET',
    enabled: false
  },
  football_pro: {
    name: 'Football Pro API',
    url: 'https://football-pro.p.rapidapi.com/api/v1/teams',
    host: 'football-pro.p.rapidapi.com',
    sport: 'Soccer',
    dataType: 'teams',
    method: 'GET',
    enabled: false
  }
};

class UnifiedSportsAPI {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Fetch data from any RapidAPI endpoint with caching
   */
  async fetch(apiKey, params = {}) {
    const config = API_CONFIG[apiKey];
    if (!config) throw new Error(`Unknown API: ${apiKey}`);

    // Build cache key
    const cacheKey = `${apiKey}:${JSON.stringify(params)}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.time < this.cacheTimeout) {
      return cached.data;
    }

    // Build URL with parameters. Append any primitive params as query params
    let url = config.url;
    // If a single required param name is declared, support the old style
    if (config.requiresParam && params[config.requiresParam]) {
      // append directly for endpoints that expect the value at the end of the URL
      if (!String(url).includes("?")) {
        // if url already contains an equals (e.g. ...?q=) then just append value
        if (url.endsWith("=") || url.includes("=")) {
          url = `${url}${encodeURIComponent(params[config.requiresParam])}`;
        } else {
          url = `${url}${encodeURIComponent(params[config.requiresParam])}`;
        }
      } else {
        url = `${url}&${config.requiresParam}=${encodeURIComponent(
          params[config.requiresParam],
        )}`;
      }
    }

    // Generic: append any other primitive params as query string
    const qs = [];
    Object.keys(params).forEach((k) => {
      const v = params[k];
      if (v === undefined || v === null) return;
      if (k === config.requiresParam) return;
      if (
        typeof v === 'string' ||
        typeof v === 'number' ||
        typeof v === 'boolean'
      ) {
        qs.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
      }
    });
    if (qs.length > 0) {
      url += (String(url).includes('?') ? '&' : '?') + qs.join('&');
    }

    try {
      const response = await fetch(url, {
        method: config.method,
        headers: {
          'x-rapidapi-host': config.host,
          'x-rapidapi-key': API_KEY,
          'Content-Type': 'application/json'
        },
        body: config.method === 'POST' ? JSON.stringify(params.body || {}) : undefined,
        timeout: 8000
      });

      // Read raw text and attempt to parse JSON safely to avoid exceptions on empty/non-JSON bodies
      const rawText = await response.text();
      let data = null;
      if (rawText && String(rawText).trim()) {
        try {
          data = JSON.parse(rawText);
        } catch (e) {
          // fallback to raw text when not valid JSON
          data = rawText;
        }
      }

      if (!response.ok) {
        const preview = typeof data === 'string' ? data.substring(0, 200) : JSON.stringify(data || {}).substring(0, 200);
        throw new Error(`API returned ${response.status}: ${response.statusText}${preview ? ' - ' + preview : ''}`);
      }

      // Cache successful response
      this.cache.set(cacheKey, { data, time: Date.now() });

      return data;
    } catch (err) {
      console.error(`[UnifiedSportsAPI] ${apiKey} error:`, err && err.message ? err.message : String(err));
      throw err;
    }
  }

  /**
   * Get all NFL teams
   */
  async getNFLTeams() {
    const data = await this.fetch('nfl_teams');
    if (data && Array.isArray(data)) {
      return data.map(t => ({
        id: t.team?.id,
        name: t.team?.displayName,
        abbreviation: t.team?.abbreviation,
        league: 'NFL'
      }));
    }
    return [];
  }

  /**
   * Search for soccer teams/matches
   */
  async searchSoccer(searchTerm) {
    return await this.fetch('free_livescore', { search_term: searchTerm });
  }

  /**
   * Get Premier League team info
   */
  async getPremierLeagueTeam(teamName) {
    return await this.fetch('premier_league', { team_name: teamName });
  }

  /**
   * Get upcoming matches from Bet365
   */
  async getUpcomingMatches() {
    return await this.fetch('betsapi');
  }

  /**
   * Get head-to-head match stats
   */
  async getMatchH2H(matchId) {
    return await this.fetch('sofascore', { match_id: matchId });
  }

  /**
   * Get odds and scores
   */
  async getOdds(fixtureId) {
    if (!fixtureId) {
      return { ok: false, status: 400, error: 'fixtureId required' };
    }
    try {
      const data = await this.fetch('odds_api1', { fixtureId });
      return { ok: true, status: 200, data };
    } catch (e) {
      // Normalize error shape so callers can handle gracefully
      const statusMatch = e && e.message ? e.message.match(/API returned (\d+)/) : null;
      const status = statusMatch ? Number(statusMatch[1]) : 500;
      return { ok: false, status, error: e && e.message ? e.message : String(e) };
    }
  }

  /**
   * Get basketball news
   */
  async getBasketballNews() {
    return await this.fetch('sports_info');
  }

  /**
   * Get top sports news
   */
  async getTopNews() {
    const raw = await this.fetch('newsnow', {
      body: {
        location: 'us',
        language: 'en',
        page: 1,
        time_bounded: false
      }
    }).catch(() => null);

    // Normalize to array form so callers can safely use .length and substring
    try {
      if (!raw) return [];
      if (Array.isArray(raw)) return raw;
      if (raw.articles && Array.isArray(raw.articles)) return raw.articles;
      if (raw.items && Array.isArray(raw.items)) return raw.items;
      if (raw.news && Array.isArray(raw.news)) return raw.news;
      // Fallback: if object has list-like keys, try to collect them
      const arr = Object.values(raw).find((v) => Array.isArray(v));
      if (arr) return arr;
      // Last resort: wrap single object into array
      return [raw];
    } catch (e) {
      return [];
    }
  }

  /**
   * Get available sports and data types
   */
  getAvailableSports() {
    const sports = {};
    Object.entries(API_CONFIG).forEach(([key, config]) => {
      // Skip APIs that are explicitly disabled until validated
      if (config && config.enabled === false) return;
      if (!sports[config.sport]) {
        sports[config.sport] = [];
      }
      sports[config.sport].push({
        id: key,
        name: config.name,
        dataType: config.dataType
      });
    });
    return sports;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }
}

export default new UnifiedSportsAPI();
export { API_CONFIG };
