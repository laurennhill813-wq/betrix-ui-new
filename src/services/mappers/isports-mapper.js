import { normalizeOddsRecord } from '../../models/odds-model.js';

export function mapIsportsOdds(raw, { sport, league } = {}) {
  if (!raw?.data || !Array.isArray(raw.data)) return [];

  return raw.data.map(event => {
    const homeTeam = event.homeName || event.homeTeam || event.home;
    const awayTeam = event.awayName || event.awayTeam || event.away;
    const eventId = event.matchId || event.id;
    const startsAt = event.matchTime || event.time || event.startTime;

    return normalizeOddsRecord({
      provider: 'isports',
      sport,
      league,
      eventId,
      homeTeam,
      awayTeam,
      startsAt,
      bookmaker: 'iSports',
      moneylineHome: event.oddsHome,
      moneylineAway: event.oddsAway,
      spreadHome: event.spreadHome,
      spreadAway: event.spreadAway,
      spreadPoint: event.handicap || null,
      totalPoints: event.total || null,
      overOdds: event.over || null,
      underOdds: event.under || null,
      lastUpdated: event.updatedAt || new Date().toISOString(),
    });
  });
}
