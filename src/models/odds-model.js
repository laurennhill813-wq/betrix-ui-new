export function normalizeOddsRecord({
  provider,
  league,
  sport,
  eventId,
  homeTeam,
  awayTeam,
  startsAt,
  bookmaker,
  moneylineHome,
  moneylineAway,
  spreadHome,
  spreadAway,
  spreadPoint,
  totalPoints,
  overOdds,
  underOdds,
  lastUpdated,
}) {
  return {
    provider,
    sport,
    league,
    eventId,
    homeTeam,
    awayTeam,
    startsAt,
    bookmaker,
    markets: {
      moneyline: {
        home: moneylineHome,
        away: moneylineAway,
      },
      spread: {
        home: spreadHome,
        away: spreadAway,
        point: spreadPoint,
      },
      total: {
        points: totalPoints,
        over: overOdds,
        under: underOdds,
      },
    },
    lastUpdated,
  };
}
