import { normalizeOddsRecord } from '../../models/odds-model.js';

export function mapSgoOdds(raw, { sport, league } = {}) {
  if (!raw) return [];

  // some SGO payloads may have `events` or top-level `data` array
  const events = Array.isArray(raw.events) ? raw.events : (Array.isArray(raw.data) ? raw.data : []);
  if (!events.length) return [];

  return events.map(event => {
    const homeTeam = event.homeTeam?.name || event.home_team || event.home || null;
    const awayTeam = event.awayTeam?.name || event.away_team || event.away || null;
    const eventId = event.id || event.eventId || null;
    const startsAt = event.startTime || event.start_time || event.start || null;

    return normalizeOddsRecord({
      provider: 'sportsgameodds',
      sport,
      league,
      eventId,
      homeTeam,
      awayTeam,
      startsAt,
      bookmaker: event.bookmaker || event.book || 'SportsGameOdds',
      moneylineHome: event.moneyline?.home || event.ml?.home || null,
      moneylineAway: event.moneyline?.away || event.ml?.away || null,
      spreadHome: event.spread?.home || null,
      spreadAway: event.spread?.away || null,
      spreadPoint: event.spread?.point || null,
      totalPoints: event.total?.points || null,
      overOdds: event.total?.over || null,
      underOdds: event.total?.under || null,
      lastUpdated: event.updatedAt || event.lastUpdated || new Date().toISOString(),
    });
  });
}
