// Central registry for supported Sportradar sports and endpoint hints
export const SPORTRADAR_SPORTS = [
  { id: "soccer", aliases: ["football"] },
  { id: "nba", aliases: ["basketball"] },
  { id: "nfl", aliases: ["americanfootball"] },
  { id: "mlb", aliases: ["baseball"] },
  { id: "nhl", aliases: ["hockey"] },
  { id: "tennis", aliases: [] },
  { id: "nascar", aliases: ["motorsports"] },
];

export function isSupportedSport(sport) {
  if (!sport) return false;
  const s = String(sport).toLowerCase();
  return SPORTRADAR_SPORTS.some((x) => x.id === s || (x.aliases || []).includes(s));
}

export function normalizeSport(sport) {
  if (!sport) return null;
  const s = String(sport).toLowerCase();
  const found = SPORTRADAR_SPORTS.find((x) => x.id === s || (x.aliases || []).includes(s));
  return found ? found.id : null;
}
