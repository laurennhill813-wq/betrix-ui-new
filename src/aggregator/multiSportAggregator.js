// multiSportAggregator: gather interesting events across many sports
// Defensive imports: if specific sport data modules don't exist, return empty arrays
async function tryImport(path) {

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
  // Use the real sportsAggregator if injected by worker
  if (!globalSportsAggregator) {
    console.warn("[multiSportAggregator] No sportsAggregator instance set - returning empty");
    return [];
  }

  // Get BOTH live and upcoming events (within 24 hours)
  const [liveMatches, upcomingFixtures] = await Promise.all([
    safeFetch(globalSportsAggregator.getLiveMatches?.bind(globalSportsAggregator)),
    safeFetch(globalSportsAggregator.getUpcomingFixtures?.bind(globalSportsAggregator), 24),
  ]).catch(() => [[], []]);

  // Combine all events
  const all = [...(liveMatches || []), ...(upcomingFixtures || [])];

  // Normalize
  const normalized = all.map((ev) => {
    return {
      sport: ev.sport || ev.sport_name || ev.sportId || "soccer",
      league: ev.league || ev.competition || ev.competitionName || null,
      home: ev.home || ev.team_home || ev.home_name || ev.homeTeam || null,
      away: ev.away || ev.team_away || ev.away_name || ev.awayTeam || null,
      status: ev.status || ev.state || ev.match_status || "UPCOMING",
      score: ev.score || ev.result || null,
      time: ev.time || ev.minute || null,
      importance: ev.importance || ev.importanceLevel || "medium",
      context: ev.context || {},
        id: ev.id || ev._id || `${ev.home}-vs-${ev.away}`,
      raw: ev,
    };
  });

  // Return ALL events (both live and upcoming) for mediaAiTicker to score
  // Previously filtered to only LIVE or HIGH importance upcoming
  // Now we let the interestScorer.js handle the scoring/filtering
  return normalized.length > 0 ? normalized : [];
}

let globalSportsAggregator = null;

// Called by worker-final.js to inject the real sportsAggregator instance
export function setSportsAggregator(agg) {
  globalSportsAggregator = agg;
}

export default { getInterestingEvents };
export default { getInterestingEvents, setSportsAggregator };
