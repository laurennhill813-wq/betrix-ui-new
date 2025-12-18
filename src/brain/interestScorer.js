// Simple heuristic-based interest scorer for events
import { getEventVelocity } from "./trending.js";

export async function scoreEvent(event = {}) {
  try {
    let score = 0;
    if (!event) return 0;
    const status = String(event.status || "").toUpperCase();
    // LIVE events are highly interesting
    if (status === "LIVE") score += 50;
    // Newly started / just kicked off
    if (status === "STARTED" || status === "IN_PLAY") score += 20;
    // importance flag from aggregator
    if (event.importance === "high") score += 30;
    if (event.importance === "medium") score += 10;
    // close scorelines in later stages are interesting
    try {
      const s = event.score || {};
      const h = Number(s.home || s.homeScore || s.home_score || 0);
      const a = Number(s.away || s.awayScore || s.away_score || 0);
      if (!isNaN(h) && !isNaN(a)) {
        const diff = Math.abs(h - a);
        if (status === "LIVE" && diff <= 2) score += 15;
        if (status === "LIVE" && diff === 0) score += 10; // tie games are extra spicy
      }
    } catch (e) {}
    // competition/stage importance
    const comp = (event.league || "").toString().toLowerCase();
    if (
      comp.includes("final") ||
      comp.includes("champions") ||
      comp.includes("world cup") ||
      comp.includes("playoff")
    )
      score += 25;
    // trending / velocity: if many mentions in short window, boost
    try {
      const evtId =
        event.id || (event.raw && event.raw.id) || event._eventId || null;
      const vel = await getEventVelocity(evtId).catch(() => 0);
      if (vel && Number(vel) > 0) {
        // small multiplier: each recent mention adds 5 points, cap at 30
        score += Math.min(30, Number(vel) * 5);
      }
    } catch (e) {}

    // trending context flags
    if (event.context && event.context.trending) score += 20;
    // small boost for home team big clubs (if provided)
    if (event.context && event.context.home_rank && event.context.away_rank) {
      try {
        const hr = Number(event.context.home_rank);
        const ar = Number(event.context.away_rank);
        if (!isNaN(hr) && !isNaN(ar) && Math.abs(hr - ar) > 10) score += 5;
      } catch (e) {}
    }
    return Math.max(0, Math.floor(score));
  } catch (e) {
    return 0;
  }
}

export default { scoreEvent };
