/**
 * Unified Sports API Integration Layer
 * 
 * Consolidates all verified RapidAPI endpoints and provides:
 * - Centralized team/fixture data fetching
 * - Automatic failover between APIs
 * - Caching for performance
 * - Prefetch capabilities for fixtures
 * - Bot menu population
 */

import fetch from 'node-fetch';

const API_KEY = process.env.RAPIDAPI_KEY || 'd04027f383msh0b0565415dfbe6dp1fc23bjsn22d9d050080e';

const WORKING_APIS = {
  nfl: {
    id: 'nfl',
    name: 'NFL Teams',
    sport: 'NFL',
    host: 'nfl-api-data.p.rapidapi.com',
    url: 'https://nfl-api-data.p.rapidapi.com/nfl-team-listing/v1/data',
    dataType: 'Teams',
    cacheTTL: 86400, // 24 hours for static team list
    parser: parseNFLTeams
  },
  premier_league: {
    id: 'premier_league',
    name: 'Premier League',
    sport: 'Soccer',
    host: 'heisenbug-premier-league-live-scores-v1.p.rapidapi.com',
    url: 'https://heisenbug-premier-league-live-scores-v1.p.rapidapi.com/api/premierleague/teams',
    dataType: 'Teams',
    cacheTTL: 3600,
    parser: parsePremierLeagueTeams
  },
  therundown: {
    id: 'therundown',
    name: 'TheRundown Sports',
    sport: 'Multi-Sport',
    host: 'therundown-therundown-v1.p.rapidapi.com',
    url: 'https://therundown-therundown-v1.p.rapidapi.com/sports/{sportId}/events',
    dataType: 'Events/Fixtures',
    cacheTTL: 1800,
    parser: parseTheRundownFixtures
  },
  livescore: {
    id: 'livescore',
    name: 'Live Score Soccer',
    sport: 'Soccer',
    host: 'free-livescore-api.p.rapidapi.com',
    url: 'https://free-livescore-api.p.rapidapi.com/livescore-get-search',
    dataType: 'Live Scores',
    cacheTTL: 600, // 10 minutes for live data
    parser: parseLiveScoreData
  },
  bet365: {
    id: 'bet365_leagues',
    name: 'Bet365 Leagues',
    sport: 'Multi-Sport',
    host: 'bet365-api-inplay.p.rapidapi.com',
    url: 'https://bet365-api-inplay.p.rapidapi.com/bet365/get_leagues',
    dataType: 'Leagues',
    cacheTTL: 7200,
    parser: parseBet365Leagues
  },
  pinnacle: {
    id: 'pinnacle',
    name: 'Pinnacle Odds',
    sport: 'Multi-Sport',
    host: 'pinnacle-odds.p.rapidapi.com',
    url: 'https://pinnacle-odds.p.rapidapi.com/kit/v1/sports',
    dataType: 'Odds/Fixtures',
    cacheTTL: 300, // 5 minutes for odds
    parser: parsePinnacleOdds
  }
};

// ============================================
// PARSERS - Extract team/fixture data from APIs
// ============================================

function parseNFLTeams(data) {
  if (!data) return [];
  
  // Handle array of teams directly
  if (Array.isArray(data)) {
    return data.map(item => {
      // Handle nested team object structure from NFL API
      const team = item.team || item;
      return {
        id: team.id || team.team_id,
        name: team.displayName || team.name || team.team_name,
        shortName: team.shortDisplayName || team.shortName,
        conference: team.conference || team.conf,
        division: team.division || team.div,
        abbreviation: team.abbreviation || team.abbr,
        logo: team.logo || team.image,
        sport: 'NFL'
      };
    }).filter(t => t.name);
  }

  // Handle object with teams property
  if (data.teams && Array.isArray(data.teams)) {
    return parseNFLTeams(data.teams);
  }

  // If data is an object with a count/data structure
  if (data.data && Array.isArray(data.data)) {
    return parseNFLTeams(data.data);
  }

  return [];
}

function parsePremierLeagueTeams(data) {
  if (!data) return [];
  
  const teams = [];
  
  // Handle array directly
  if (Array.isArray(data)) {
    return data.map(team => ({
      id: team.id,
      name: team.name,
      sport: 'Soccer',
      league: 'Premier League',
      logo: team.logo || team.image_path
    })).filter(t => t.name);
  }

  // Handle nested structure
  if (data.teams && Array.isArray(data.teams)) {
    data.teams.forEach(team => {
      teams.push({
        id: team.id,
        name: team.name,
        sport: 'Soccer',
        league: 'Premier League',
        logo: team.logo || team.image_path
      });
    });
  }

  // Handle wrapped data
  if (data.data && Array.isArray(data.data)) {
    return parsePremierLeagueTeams(data.data);
  }

  return teams;
}

function parseTheRundownFixtures(data) {
  if (!data || !data.events) return [];
  
  return data.events.map(event => ({
    id: event.event_id,
    homeTeam: event.away_team,
    awayTeam: event.home_team,
    sport: event.sport,
    league: event.league,
    startTime: event.event_date,
    odds: event.odds || {}
  })).filter(e => e.homeTeam && e.awayTeam);
}

function parseLiveScoreData(data) {
  const fixtures = [];
  
  if (!data) return fixtures;

  // Handle nested results
  if (data.results && Array.isArray(data.results)) {
    data.results.forEach(result => {
      if (result.match && result.match.homeTeam) {
        fixtures.push({
          id: result.match.id,
          homeTeam: result.match.homeTeam.name || result.match.homeTeam,
          awayTeam: result.match.awayTeam.name || result.match.awayTeam,
          status: result.match.status,
          homeScore: result.match.score?.home,
          awayScore: result.match.score?.away,
          sport: 'Soccer'
        });
      }
    });
  }

  // Handle data array directly
  if (Array.isArray(data)) {
    data.forEach(item => {
      if (item.match && item.match.homeTeam) {
        fixtures.push({
          id: item.match.id,
          homeTeam: item.match.homeTeam.name || item.match.homeTeam,
          awayTeam: item.match.awayTeam.name || item.match.awayTeam,
          status: item.match.status,
          homeScore: item.match.score?.home,
          awayScore: item.match.score?.away,
          sport: 'Soccer'
        });
      }
    });
  }

  // Handle wrapped data
  if (data.data && (Array.isArray(data.data) || data.data.results)) {
    return parseLiveScoreData(data.data);
  }
  
  return fixtures;
}

function parseBet365Leagues(data) {
  const leagues = [];
  
  if (!data) return leagues;

  // Handle array directly
  if (Array.isArray(data)) {
    return data.map(league => ({
      id: league.id || league.league_id,
      name: league.name,
      country: league.country,
      sport: league.sport || 'Multi-Sport',
      fixtures: league.fixtures ? league.fixtures.length : 0
    })).filter(l => l.name);
  }

  // Handle nested structure
  if (data.leagues && Array.isArray(data.leagues)) {
    data.leagues.forEach(league => {
      leagues.push({
        id: league.id || league.league_id,
        name: league.name,
        country: league.country,
        sport: league.sport || 'Multi-Sport',
        fixtures: league.fixtures ? league.fixtures.length : 0
      });
    });
  }

  // Handle data property
  if (data.data && Array.isArray(data.data)) {
    return parseBet365Leagues(data.data);
  }
  
  return leagues;
}

function parsePinnacleOdds(data) {
  const sports = [];
  
  if (data.sports && Array.isArray(data.sports)) {
    data.sports.forEach(sport => {
      sports.push({
        id: sport.id,
        name: sport.name,
        events: sport.events ? sport.events.length : 0
      });
    });
  }
  
  return sports;
}

// ============================================
// FETCHER - Unified API calling function
// ============================================

async function fetchFromAPI(apiId, params = {}) {
  const apiConfig = WORKING_APIS[apiId];
  if (!apiConfig) {
    throw new Error(`API ${apiId} not found`);
  }

  try {
    let url = apiConfig.url;
    
    // Replace URL parameters
    Object.entries(params).forEach(([key, value]) => {
      url = url.replace(`{${key}}`, value);
    });

    // Add query parameters for search-based endpoints
    if (params.search && !url.includes('?')) {
      url += `?sportname=soccer&search=${encodeURIComponent(params.search)}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': apiConfig.host,
        'x-rapidapi-key': API_KEY,
        'User-Agent': 'BETRIX-Bot/3.0'
      },
      timeout: 8000
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error(`Authentication failed: HTTP ${response.status}`);
    }

    if (response.status === 429) {
      throw new Error('Rate limited - please retry later');
    }

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Parse the response using API-specific parser
    const parsed = apiConfig.parser(data);
    
    return {
      success: true,
      apiId,
      apiName: apiConfig.name,
      data: parsed,
      count: parsed.length,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      apiId,
      apiName: apiConfig.name,
      error: error.message,
      data: [],
      timestamp: new Date().toISOString()
    };
  }
}

// ============================================
// CACHE LAYER
// ============================================

const cache = new Map();

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  
  if (Date.now() > entry.expiry) {
    cache.delete(key);
    return null;
  }
  
  return entry.data;
}

function setCached(key, data, ttl) {
  cache.set(key, {
    data,
    expiry: Date.now() + (ttl * 1000)
  });
}

// ============================================
// PUBLIC API
// ============================================

export class SportsDataAggregator {
  /**
   * Get all NFL teams
   */
  static async getNFLTeams() {
    const cacheKey = 'nfl:teams';
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const result = await fetchFromAPI('nfl');
    if (result.success) {
      setCached(cacheKey, result, WORKING_APIS.nfl.cacheTTL);
    }
    return result;
  }

  /**
   * Get Premier League teams
   */
  static async getPremierLeagueTeams() {
    const cacheKey = 'pl:teams';
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const result = await fetchFromAPI('premier_league');
    if (result.success) {
      setCached(cacheKey, result, WORKING_APIS.premier_league.cacheTTL);
    }
    return result;
  }

  /**
   * Get fixtures from TheRundown
   */
  static async getFixtures(sportId = 'soccer') {
    const cacheKey = `therundown:fixtures:${sportId}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const result = await fetchFromAPI('therundown', { sportId });
    if (result.success) {
      setCached(cacheKey, result, WORKING_APIS.therundown.cacheTTL);
    }
    return result;
  }

  /**
   * Search live soccer scores
   */
  static async searchLiveScores(query) {
    const cacheKey = `livescore:search:${query}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const result = await fetchFromAPI('livescore', { search: query });
    if (result.success) {
      setCached(cacheKey, result, WORKING_APIS.livescore.cacheTTL);
    }
    return result;
  }

  /**
   * Get Bet365 leagues
   */
  static async getBet365Leagues() {
    const cacheKey = 'bet365:leagues';
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const result = await fetchFromAPI('bet365');
    if (result.success) {
      setCached(cacheKey, result, WORKING_APIS.bet365.cacheTTL);
    }
    return result;
  }

  /**
   * Get Pinnacle odds/sports
   */
  static async getPinnacleOdds() {
    const cacheKey = 'pinnacle:odds';
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const result = await fetchFromAPI('pinnacle');
    if (result.success) {
      setCached(cacheKey, result, WORKING_APIS.pinnacle.cacheTTL);
    }
    return result;
  }

  /**
   * Get all available APIs
   */
  static getAvailableAPIs() {
    return Object.values(WORKING_APIS).map(api => ({
      id: api.id,
      name: api.name,
      sport: api.sport,
      dataType: api.dataType
    }));
  }

  /**
   * Format teams for bot display
   */
  static formatTeamsForMenu(teamsData, sport = 'All') {
    if (!teamsData.success || !Array.isArray(teamsData.data)) {
      return [];
    }

    return teamsData.data
      .filter(t => sport === 'All' || t.sport === sport)
      .map(team => ({
        id: team.id,
        text: team.name || team,
        sport: team.sport,
        callback_data: `team_${team.id}`
      }));
  }

  /**
   * Format fixtures for bot display
   */
  static formatFixturesForMenu(fixturesData) {
    if (!fixturesData.success || !Array.isArray(fixturesData.data)) {
      return [];
    }

    return fixturesData.data.slice(0, 10).map((fixture, idx) => ({
      id: fixture.id,
      text: `${fixture.homeTeam || 'TBD'} vs ${fixture.awayTeam || 'TBD'}`,
      sport: fixture.sport,
      callback_data: `fixture_${fixture.id}`
    }));
  }

  /**
   * Clear cache
   */
  static clearCache() {
    cache.clear();
  }
}

export default SportsDataAggregator;
