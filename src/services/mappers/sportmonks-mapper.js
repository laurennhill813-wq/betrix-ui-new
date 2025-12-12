import { normalizeOddsRecord } from '../../models/odds-model.js';

export function mapSportmonksOdds(raw, { sport, league } = {}) {
  if (!raw?.data) return [];

  return raw.data.map(event => {
    const homeTeam = event.localTeam?.name || null;
    const awayTeam = event.visitorTeam?.name || null;

    return normalizeOddsRecord({
      provider: 'sportmonks',
      sport,
      league,
      eventId: event.id,
      homeTeam,
      awayTeam,
      startsAt: event.starting_at,
      bookmaker: 'SportMonks',
      moneylineHome: null,
      moneylineAway: null,
      spreadHome: null,
      spreadAway: null,
      spreadPoint: null,
      totalPoints: null,
      overOdds: null,
      underOdds: null,
      lastUpdated: new Date().toISOString(),
    });
  });
}
