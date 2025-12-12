import { normalizeOddsRecord } from '../../models/odds-model.js';

// Map football-data.org fixtures -> canonical model
export function mapFootballDataFixtures(raw, { sport = 'football', league } = {}) {
  if (!raw?.data || !Array.isArray(raw.data)) return [];

  return raw.data.map(ev => {
    const eventId = ev.id || ev.match_id || null;
    const homeTeam = ev.homeTeam?.name || ev.homeTeam?.shortName || ev.homeTeam?.tla || (ev.home || null);
    const awayTeam = ev.awayTeam?.name || ev.awayTeam?.shortName || ev.awayTeam?.tla || (ev.away || null);
    const startsAt = ev.utcDate || ev.date || ev.kickoff || null;

    return normalizeOddsRecord({
      provider: 'footballdata',
      sport,
      league,
      eventId,
      homeTeam,
      awayTeam,
      startsAt,
      bookmaker: 'football-data',
      moneylineHome: null,
      moneylineAway: null,
      spreadHome: null,
      spreadAway: null,
      spreadPoint: null,
      totalPoints: null,
      overOdds: null,
      underOdds: null,
      lastUpdated: ev.lastUpdated || new Date().toISOString(),
    });
  });
}

export default { mapFootballDataFixtures };
