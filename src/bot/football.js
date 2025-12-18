import fs from "fs/promises";
import path from "path";
import safeName from "../utils/safe-name.js";

const ROOT = process.cwd();
const MATCHES_FILE = path.join(ROOT, "FOOTBALL_DATA_MATCHES.json");
let aggregator = null;

export function setAggregator(agg) {
  aggregator = agg;
}

async function loadMatches() {
  try {
    const raw = await fs.readFile(MATCHES_FILE, "utf8");
    let data;
    try {
      data = JSON.parse(raw);
    } catch (parseErr) {
      // Attempt to recover from badly-formed JSON by trimming leading/trailing
      // content and parsing the most likely JSON object/array fragment.
      try {
        const firstBrace = raw.indexOf("{");
        const firstBracket = raw.indexOf("[");
        const start =
          firstBrace === -1
            ? firstBracket
            : firstBracket === -1
              ? firstBrace
              : Math.min(firstBrace, firstBracket);
        const lastBrace = raw.lastIndexOf("}");
        const lastBracket = raw.lastIndexOf("]");
        const end = Math.max(lastBrace, lastBracket);
        if (start !== -1 && end !== -1 && end > start) {
          const candidate = raw.slice(start, end + 1);
          try {
            data = JSON.parse(candidate);
            console.warn(
              "football.js: recovered corrupted matches file by trimming non-JSON prefix/suffix",
            );
          } catch (e2) {
            // give up recovery
            throw parseErr;
          }
        } else {
          throw parseErr;
        }
      } catch (e) {
        throw parseErr;
      }
    }
    // Expect an array; if object, try common keys
    let list = [];
    if (Array.isArray(data)) list = data;
    else if (Array.isArray(data.matches)) list = data.matches;
    else if (Array.isArray(data.data)) list = data.data;

    // Filter out obviously stale/demo data: keep fixtures that have a kickoff/date
    // within a reasonable window (past 7 days to next 90 days). This prevents
    // old archived datasets (eg. 2005/2006) from being shown to users.
    const now = Date.now();
    const minTs = now - 7 * 24 * 60 * 60 * 1000; // 7 days in past
    const maxTs = now + 90 * 24 * 60 * 60 * 1000; // 90 days in future

    const filtered = list.filter((m) => {
      try {
        const candidates = [
          m.kickoff,
          m.kickoff_at,
          m.utcDate,
          m.utc_date,
          m.date,
          m.time,
          m.starting_at,
          m.timestamp,
          m.ts,
          m.start,
          m.match_time,
          m.datetime,
        ];
        for (const c of candidates) {
          if (!c && c !== 0) continue;
          let ts = null;
          if (typeof c === "number") {
            ts = c < 1e12 ? c * 1000 : c;
          } else if (typeof c === "string") {
            if (/^\d{10}$/.test(c)) ts = Number(c) * 1000;
            else if (/^\d{13}$/.test(c)) ts = Number(c);
            else {
              const d = new Date(c);
              if (!isNaN(d.getTime())) ts = d.getTime();
            }
          }
          if (ts && ts >= minTs && ts <= maxTs) return true;
        }
      } catch (e) {
        // ignore parsing problems for a single item
      }
      return false;
    });

    return filtered || [];
  } catch (err) {
    console.warn("Could not load matches file", MATCHES_FILE, err?.message);
    return [];
  }
}

function isLiveMatch(m) {
  // Heuristics for common providers
  if (m.status) {
    const s = String(m.status).toLowerCase();
    if (s.includes("live") || s.includes("in play") || s.includes("started"))
      return true;
  }
  if (m.time_status) {
    const s = String(m.time_status).toLowerCase();
    if (s.includes("live") || s.includes("playing")) return true;
  }
  if (typeof m.is_live === "boolean") return m.is_live === true;
  // fallback: check for current_score or minute
  if (m.score || m.home_score != null || m.away_score != null) return true;
  return false;
}

function formatTime(ts) {
  try {
    const d = new Date(ts);
    return d.toLocaleString("en-GB", { timeZone: "UTC", hour12: false });
  } catch (e) {
    return String(ts);
  }
}

// Use shared safeName helper from utils to coerce provider objects to readable strings

export async function getLiveMatches() {
  // Prefer live data from injected SportsAggregator if available
  try {
    if (aggregator && typeof aggregator.getAllLiveMatches === "function") {
      const all = await aggregator.getAllLiveMatches();
      if (Array.isArray(all) && all.length > 0) return all;
    }
  } catch (e) {
    console.warn(
      "football.js: sportsAggregator getAllLiveMatches failed",
      e?.message || e,
    );
  }
  const matches = await loadMatches();
  return matches.filter(isLiveMatch);
}

export async function getUpcomingFixtures({ page = 1, perPage = 10 } = {}) {
  // Prefer fixtures from injected SportsAggregator if available
  try {
    if (aggregator && typeof aggregator.getFixtures === "function") {
      const fixtures = await aggregator.getFixtures();
      if (Array.isArray(fixtures) && fixtures.length > 0) {
        const start = (page - 1) * perPage;
        return {
          items: fixtures.slice(start, start + perPage),
          total: fixtures.length,
        };
      }
    }
  } catch (e) {
    console.warn(
      "football.js: sportsAggregator getFixtures failed",
      e?.message || e,
    );
  }

  const matches = await loadMatches();
  // Heuristic: treat non-live as upcoming; attempt to sort by kickoff if available
  const upcoming = matches.filter((m) => !isLiveMatch(m));
  upcoming.sort((a, b) => {
    const ta = new Date(
      a.kickoff || a.date || a.match_time || a.datetime || a.timestamp || 0,
    ).getTime();
    const tb = new Date(
      b.kickoff || b.date || b.match_time || b.datetime || b.timestamp || 0,
    ).getTime();
    return (ta || 0) - (tb || 0);
  });
  const start = (page - 1) * perPage;
  return {
    items: upcoming.slice(start, start + perPage),
    total: upcoming.length,
  };
}

export function formatMatchShort(m) {
  // Best-effort formatting using common fields
  const home = safeName(
    m.home?.name ||
      m.home ||
      m.home_team ||
      m.home_team_name ||
      m.team_home ||
      (m.teams && m.teams.home && m.teams.home.name) ||
      m.homeName,
    "Home",
  );
  const away = safeName(
    m.away?.name ||
      m.away ||
      m.away_team ||
      m.away_team_name ||
      m.team_away ||
      (m.teams && m.teams.away && m.teams.away.name) ||
      m.awayName,
    "Away",
  );
  const comp = safeName(
    (m.competition && (m.competition.name || m.competition)) ||
      m.league ||
      m.tournament ||
      "",
    "",
  );
  // Build readable score if available
  let score = "";
  if (m.score && typeof m.score === "object") {
    if (
      m.score.fullTime &&
      (m.score.fullTime.home != null || m.score.fullTime.away != null)
    ) {
      score = `${m.score.fullTime.home ?? "-"} - ${m.score.fullTime.away ?? "-"}`;
    } else if (
      m.score.current &&
      (m.score.current.home != null || m.score.current.away != null)
    ) {
      score = `${m.score.current.home ?? "-"} - ${m.score.current.away ?? "-"}`;
    }
  }
  if (!score && (m.home_score != null || m.away_score != null)) {
    score = `${m.home_score ?? "-"} - ${m.away_score ?? "-"}`;
  }
  const time =
    m.minute ||
    m.status ||
    m.time ||
    m.time_status ||
    (m.kickoff ? formatTime(m.kickoff) : "TBD");
  const scoreStr =
    score && String(score) !== "undefined" && String(score) !== ""
      ? ` • Score: ${score}`
      : "";
  return `${home} vs ${away}${scoreStr} • ${time}${comp ? " • " + comp : ""}`;
}

export function formatMatchDetail(m) {
  const home = safeName(
    m.home?.name || m.home || m.home_team || m.home_team_name,
    "Home",
  );
  const away = safeName(
    m.away?.name || m.away || m.away_team || m.away_team_name,
    "Away",
  );
  const comp = safeName(
    (m.competition && (m.competition.name || m.competition)) || m.league || "",
    "",
  );
  const kickoff = m.kickoff || m.date || m.datetime || m.match_time || "";
  const time = kickoff ? formatTime(kickoff) : m.minute || m.status || "TBD";
  // Build readable score
  let score = "";
  if (m.score && typeof m.score === "object") {
    if (
      m.score.fullTime &&
      (m.score.fullTime.home != null || m.score.fullTime.away != null)
    ) {
      score = `${m.score.fullTime.home ?? "-"} - ${m.score.fullTime.away ?? "-"}`;
    } else if (
      m.score.current &&
      (m.score.current.home != null || m.score.current.away != null)
    ) {
      score = `${m.score.current.home ?? "-"} - ${m.score.current.away ?? "-"}`;
    }
  }
  if (!score) score = `${m.home_score ?? "-"} - ${m.away_score ?? "-"}`;
  const venue = m.venue || m.location || "";
  const refs = m.referee || "";
  const lines = [];
  lines.push(`⚽ BETRIX • Match Detail`);
  if (comp) lines.push(`Competition: ${comp}`);
  lines.push(`${home}  ${score}  ${away}`);
  lines.push(`Time: ${time}`);
  if (venue) lines.push(`Venue: ${venue}`);
  if (refs) lines.push(`Referee: ${refs}`);
  if (m.events && Array.isArray(m.events) && m.events.length) {
    lines.push("\nKey events:");
    for (const e of m.events.slice(0, 6)) {
      lines.push(
        `- ${e.minute || e.time || ""} ${e.team || ""} ${e.type || ""} ${e.player || ""}`.trim(),
      );
    }
  }
  return lines.join("\n");
}

export default {
  loadMatches,
  getLiveMatches,
  getUpcomingFixtures,
  formatMatchShort,
  formatMatchDetail,
};
