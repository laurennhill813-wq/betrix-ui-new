import { normalizeOddsRecord } from "../../models/odds-model.js";

// Map OpenLigaDB matchdata -> canonical model
export function mapOpenLigaMatches(raw, { sport = "football", league } = {}) {
  if (!raw) return [];

  // raw may be an array or an object with recent key
  const arr = Array.isArray(raw) ? raw : raw.recent || raw.matches || [];

  return (arr || []).map((m) => {
    const eventId = m.matchID || m.matchId || m.id || null;
    const homeTeam = m.team1?.teamName || m.team1?.team || null;
    const awayTeam = m.team2?.teamName || m.team2?.team || null;
    const startsAt =
      m.matchDateTimeUTC || m.matchDateTime || m.matchDateTimeLocal || null;

    return normalizeOddsRecord({
      provider: "openligadb",
      sport,
      league,
      eventId,
      homeTeam,
      awayTeam,
      startsAt,
      bookmaker: "openligadb",
      moneylineHome: null,
      moneylineAway: null,
      spreadHome: null,
      spreadAway: null,
      spreadPoint: null,
      totalPoints: null,
      overOdds: null,
      underOdds: null,
      lastUpdated: m.lastUpdateDateTime || new Date().toISOString(),
    });
  });
}

export default { mapOpenLigaMatches };
