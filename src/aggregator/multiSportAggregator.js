// multiSportAggregator: gather interesting events across many sports
// Defensive imports: if specific sport data modules don't exist, return empty arrays
async function tryImport(path) {
  try {
    const mod = await import(path).catch(() => null);
    return mod || null;
  } catch (e) {
    return null;
  }
}

async function safeFetch(fn, ...args) {
  try {
    if (!fn) return [];
    const out = await fn(...args);
    return Array.isArray(out) ? out : out ? [out] : [];
  } catch (e) {
    try {
      console.warn("multiSportAggregator source failed", e?.message || e);
    } catch (_) {}
    return [];
  }
}

export async function getInterestingEvents() {
  const soccerMod = await tryImport("../data/soccer.js");
  const nbaMod = await tryImport("../data/nba.js");
  const nflMod = await tryImport("../data/nfl.js");
  const mlbMod = await tryImport("../data/mlb.js");
  const nhlMod = await tryImport("../data/nhl.js");
  const nascarMod = await tryImport("../data/nascar.js");
  const tennisMod = await tryImport("../data/tennis.js");

  const [soccer, nba, nfl, mlb, nhl, nascar, tennis] = await Promise.all([
    safeFetch(soccerMod && soccerMod.getLiveSoccerEvents),
    safeFetch(nbaMod && nbaMod.getLiveNbaEvents),
    safeFetch(nflMod && nflMod.getLiveNflEvents),
    safeFetch(mlbMod && mlbMod.getLiveMlbEvents),
    safeFetch(nhlMod && nhlMod.getLiveNhlEvents),
    safeFetch(nascarMod && nascarMod.getLiveNascarEvents),
    safeFetch(tennisMod && tennisMod.getLiveTennisEvents),
  ]).catch(() => [[], [], [], [], [], [], []]);

  // flatten
  const all = [
    ...(soccer || []),
    ...(nba || []),
    ...(nfl || []),
    ...(mlb || []),
    ...(nhl || []),
    ...(nascar || []),
    ...(tennis || []),
  ];

  // attach basic normalization if missing
  const normalized = all.map((ev) => {
    return {
      sport: ev.sport || ev.sport_name || ev.sportId || "sport",
      league: ev.league || ev.competition || ev.competitionName || null,
      home: ev.home || ev.team_home || ev.home_name || ev.homeTeam || null,
      away: ev.away || ev.team_away || ev.away_name || ev.awayTeam || null,
      status: ev.status || ev.state || ev.match_status || "UPCOMING",
      score: ev.score || ev.result || null,
      time: ev.time || ev.minute || null,
      importance: ev.importance || ev.importanceLevel || "medium",
      context: ev.context || {},
      raw: ev,
    };
  });

  // Filter by isInteresting: live or high importance upcoming
  return normalized.filter((ev) => {
    if (!ev) return false;
    if (String(ev.status).toUpperCase() === "LIVE") return true;
    if (
      String(ev.status).toUpperCase() === "UPCOMING" &&
      ev.importance === "high"
    )
      return true;
    return false;
  });
}

export default { getInterestingEvents };
