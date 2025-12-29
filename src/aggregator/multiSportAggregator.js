// multiSportAggregator: gather interesting events across many sports
// Delegates to the real SportsAggregator instance (injected from worker-final.js)

let globalSportsAggregator = null;

// Allows worker-final.js to inject the real sportsAggregator instance
export function setSportsAggregator(agg) {
  globalSportsAggregator = agg;
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
  if (!globalSportsAggregator) {
    console.warn("[multiSportAggregator] No sportsAggregator instance set - returning empty");
    return [];
  }

  // Fetch live matches and upcoming fixtures (next X hours) from the real aggregator
  const [liveMatches, upcomingFixtures] = await Promise.all([
    safeFetch(globalSportsAggregator.getLiveMatches?.bind(globalSportsAggregator)),
    // pass 24 to get fixtures within next 24 hours (if implemented by aggregator)
    safeFetch(globalSportsAggregator.getUpcomingFixtures?.bind(globalSportsAggregator), 24),
  ]).catch(() => [[], []]);

  const all = [...(liveMatches || []), ...(upcomingFixtures || [])];

  const normalized = all.map((ev) => ({
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
  }));

  // Return all normalized events; scoring/filtering happens in interestScorer.js
  return normalized;
}

export default { getInterestingEvents, setSportsAggregator };
