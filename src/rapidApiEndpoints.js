// src/rapidApiEndpoints.js
const axios = require('axios');

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || 'd04027f383msh0b0565415dfbe6dp1fc23bjsn22d9d050080e';

const rapidApiRequest = async ({ method, url, host, data = {}, params = {} }) => {
  try {
    const response = await axios({
      method,
      url,
      headers: {
        'x-rapidapi-host': host,
        'x-rapidapi-key': RAPIDAPI_KEY,
        'Content-Type': 'application/json',
      },
      data,
      params,
    });
    return response.data;
  } catch (error) {
    console.error(`[RapidAPI] Error for ${host} ${url}:`, error.response?.data || error.message);
    return null;
  }
};

// 1. sportscore1.p.rapidapi.com (POST)
async function searchSportscore1Events(params = {}) {
  const url = 'https://sportscore1.p.rapidapi.com/events/search';
  return rapidApiRequest({
    method: 'POST',
    url,
    host: 'sportscore1.p.rapidapi.com',
    data: {},
    params,
  });
}

// 2. live-score-api.p.rapidapi.com (GET)
async function getLiveScoreEvent(id) {
  const url = `https://live-score-api.p.rapidapi.com/scores/events.json`;
  return rapidApiRequest({
    method: 'GET',
    url,
    host: 'live-score-api.p.rapidapi.com',
    params: { id },
  });
}

// 3. sportspage-feeds.p.rapidapi.com (GET)
async function getSportspageRankings(league) {
  const url = `https://sportspage-feeds.p.rapidapi.com/rankings`;
  return rapidApiRequest({
    method: 'GET',
    url,
    host: 'sportspage-feeds.p.rapidapi.com',
    params: { league },
  });
}

// 4. therundown-therundown-v1.p.rapidapi.com (GET)
async function getRundownConferences(sportId = 1) {
  const url = `https://therundown-therundown-v1.p.rapidapi.com/sports/${sportId}/conferences`;
  return rapidApiRequest({
    method: 'GET',
    url,
    host: 'therundown-therundown-v1.p.rapidapi.com',
  });
}

// 5. free-football-soccer-videos.p.rapidapi.com (GET)
async function getFreeFootballSoccerVideos() {
  const url = `https://free-football-soccer-videos.p.rapidapi.com/`;
  return rapidApiRequest({
    method: 'GET',
    url,
    host: 'free-football-soccer-videos.p.rapidapi.com',
  });
}

// 6. horse-racing.p.rapidapi.com (GET)
async function getHorseRacingRace(raceId) {
  const url = `https://horse-racing.p.rapidapi.com/race/${raceId}`;
  return rapidApiRequest({
    method: 'GET',
    url,
    host: 'horse-racing.p.rapidapi.com',
  });
}

// 7. os-sports-perform.p.rapidapi.com (GET)
async function getOsSportsPerformTournamentsSeasons(tournament_id) {
  const url = `https://os-sports-perform.p.rapidapi.com/v1/tournaments/seasons`;
  return rapidApiRequest({
    method: 'GET',
    url,
    host: 'os-sports-perform.p.rapidapi.com',
    params: { tournament_id },
  });
}

module.exports = {
  searchSportscore1Events,
  getLiveScoreEvent,
  getSportspageRankings,
  getRundownConferences,
  getFreeFootballSoccerVideos,
  getHorseRacingRace,
  getOsSportsPerformTournamentsSeasons,
};
