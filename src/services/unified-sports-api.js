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
    url: 'https://odds-api1.p.rapidapi.com/scores',
    host: 'odds-api1.p.rapidapi.com',
    sport: 'Multi-Sport',
    dataType: 'odds',
    method: 'GET'
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

    // Build URL with parameters
    let url = config.url;
    if (config.requiresParam && params[config.requiresParam]) {
      url += encodeURIComponent(params[config.requiresParam]);
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

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Cache successful response
      this.cache.set(cacheKey, { data, time: Date.now() });

      return data;
    } catch (err) {
      console.error(`[UnifiedSportsAPI] ${apiKey} error:`, err.message);
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
    return await this.fetch('odds_api1', { fixtureId });
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
    return await this.fetch('newsnow', {
      body: {
        location: 'us',
        language: 'en',
        page: 1,
        time_bounded: false
      }
    });
  }

  /**
   * Get available sports and data types
   */
  getAvailableSports() {
    const sports = {};
    Object.entries(API_CONFIG).forEach(([key, config]) => {
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
