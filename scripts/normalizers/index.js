export const normalizers = {
  'sportspage-feeds.p.rapidapi.com': (r) => ({
    provider: 'sportspage',
    type: 'teams',
    items: r.teams || []
  }),
  'therundown-therundown-v1.p.rapidapi.com': (r) => ({
    provider: 'therundown',
    type: 'conferences',
    items: r.teams || []
  }),
  'free-football-soccer-videos.p.rapidapi.com': (r) => ({
    provider: 'free-football-videos',
    type: 'teams',
    items: r.teams || []
  }),
  'os-sports-perform.p.rapidapi.com': (r) => ({
    provider: 'os-sports-perform',
    type: 'seasons',
    items: r.teams || []
  }),
  'horse-racing.p.rapidapi.com': (r) => ({
    provider: 'horse-racing',
    type: 'odds',
    items: [],
    metadata: { hasOdds: !!r.hasOdds }
  }),
  'sportscore1.p.rapidapi.com': (r) => ({ provider: 'sportscore1', type: 'unknown', items: [] }),
  'live-score-api.p.rapidapi.com': (r) => ({ provider: 'live-score-api', type: 'auth_error', items: [] })
};
