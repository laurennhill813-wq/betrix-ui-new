// multiSportAggregator: gather interesting events across many sports AND general news
// Delegates to the real SportsAggregator instance (injected from worker-final.js)
// Also optionally blends in news items if NEWS_BLEND_MODE enabled

import { getLatestNews } from "./newsAggregator.js";
import rapidApi from "./rapidApiAggregator.js";

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
    // Use the real aggregator's `getFixtures` to fetch upcoming fixtures
    // When called without a leagueId it returns upcoming fixtures across major competitions
    safeFetch(globalSportsAggregator.getFixtures?.bind(globalSportsAggregator), null, {}),
  ]).catch(() => [[], []]);

  const all = [...(liveMatches || []), ...(upcomingFixtures || [])];

  // Attempt to augment with RapidAPI-sourced events when available
  try {
    const rapid = await safeFetch(rapidApi.getExtraEvents?.bind(rapidApi));
    if (Array.isArray(rapid) && rapid.length > 0) {
      all.push(...rapid);
    }
  } catch (e) {
    // ignore rapidapi errors
  }

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

  // Optionally blend in news if enabled
  let blended = [...normalized];
  const newsBlendMode = String(process.env.NEWS_BLEND_MODE || "").toLowerCase();
  if (newsBlendMode === "always" || newsBlendMode === "true" || newsBlendMode === "1") {
    try {
      // Include transfer news and breaking sports news keywords
      const keywords = ["transfer news", "breaking", "Fabrizio Romano", "David Ornstein", "football news"];
      const newsItems = await getLatestNews(keywords).catch(() => []);
      if (Array.isArray(newsItems)) {
        // Weight news lower than fixtures for scoring, but include them
        const newsNormalized = newsItems.map((n) => ({
          ...n,
          type: "news",
          importance: n.importance || "low",
          sport: "news",
        }));
        blended.push(...newsNormalized.slice(0, 20)); // Limit to top 20 news items
      }
    } catch (e) {
      // ignore news blend errors
    }
  }

  // Return all normalized events; scoring/filtering happens in interestScorer.js
  return blended;
}

export default { getInterestingEvents, setSportsAggregator };

