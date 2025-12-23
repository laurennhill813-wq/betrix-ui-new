export function normalizeSportspage(data) {
  // data.items expected to be an array of team/entry names
  return {
    provider: 'sportspage',
    kind: 'team-list',
    teams: Array.isArray(data.items) ? data.items : [],
    meta: { sourceHost: data._host }
  };
}

export function normalizeTheRundown(data) {
  return {
    provider: 'therundown',
    kind: 'conference-list',
    conferences: Array.isArray(data.items) ? data.items : [],
    meta: { sourceHost: data._host }
  };
}

export function normalizeFreeFootballVideos(data) {
  return {
    provider: 'free-football-videos',
    kind: 'team-list',
    teams: Array.isArray(data.items) ? data.items : [],
    meta: { sourceHost: data._host }
  };
}

export function normalizeOsSportsPerform(data) {
  return {
    provider: 'os-sports-perform',
    kind: 'season-list',
    seasons: Array.isArray(data.items) ? data.items : [],
    meta: { sourceHost: data._host }
  };
}

export function normalizeHorseRacing(data) {
  return {
    provider: 'horse-racing',
    kind: 'odds-market',
    markets: data.metadata && data.metadata.hasOdds ? [{ note: 'odds present in response' }] : [],
    meta: { sourceHost: data._host }
  };
}

export function normalizeSoccersAPI(data) {
  if (!data || !data.items) {
    return {
      provider: 'soccersapi',
      kind: 'league-list',
      leagues: [],
      meta: { sourceHost: data._host || 'api.soccersapi.com' }
    };
  }
  const leagues = Array.isArray(data.items) ? data.items.map(l => l.name || l).filter(Boolean) : [];
  return {
    provider: 'soccersapi',
    kind: 'league-list',
    leagues,
    meta: { sourceHost: data._host || 'api.soccersapi.com', count: leagues.length }
  };
}

export const dispatch = {
  'sportspage-feeds.p.rapidapi.com': normalizeSportspage,
  'therundown-therundown-v1.p.rapidapi.com': normalizeTheRundown,
  'free-football-soccer-videos.p.rapidapi.com': normalizeFreeFootballVideos,
  'os-sports-perform.p.rapidapi.com': normalizeOsSportsPerform,
  'horse-racing.p.rapidapi.com': normalizeHorseRacing,
  'soccersapi.com': normalizeSoccersAPI
};
