import { fetchSportradar } from "./providers/sportradar.js";
import { cacheGet, cacheSet, incrWithTTL } from "../lib/redis-cache.js";
import { Logger } from "../utils/logger.js";

const logger = new Logger("SportradarClient");

const DEFAULT_QPS = Number(process.env.SPORTRADAR_QPS_LIMIT || 5);

const SPORT_EMOJI = {
  soccer: "⚽",
  football: "⚽",
  nba: "🏀",
  basketball: "🏀",
  nfl: "🏈",
  americanfootball: "🏈",
  nhl: "🏒",
  hockey: "🏒",
  mlb: "⚾",
  baseball: "⚾",
  nascar: "🏁",
  motorsports: "🏁",
  tennis: "🎾",
};

function sportEmoji(sport) {
  return SPORT_EMOJI[String(sport || "").toLowerCase()] || "🏟️";
}

async function checkRateLimit(key = "sportradar:qps", limit = DEFAULT_QPS) {
  try {
    const val = await incrWithTTL(key, 1); // increment and set TTL=1s
    return Number(val) <= Number(limit);
  } catch (e) {
    // if Redis fails, allow (best-effort)
    return true;
  }
}

export async function getUpcomingFixtures(sport = "soccer", opts = {}) {
  const s = String(sport || "soccer").toLowerCase();
  const cacheKey = `sportradar:upcoming:${s}`;

  try {
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const allowed = await checkRateLimit();
    if (!allowed) {
      logger.warn("QPS limit reached, returning empty or cached payload");
      return [];
    }

    // delegate to unified fetch+normalize which returns items and meta
    const date = opts.date || new Date().toISOString().slice(0, 10);
    const res = await fetchAndNormalizeFixtures(s, { date }, opts);
    const normalized = Array.isArray(res.items) ? res.items : [];

    // Cache for short TTL to respect quotas
    try {
      await cacheSet(cacheKey, normalized, Number(process.env.SPORTRADAR_TTL_SEC || 120));
    } catch (e) {
      void e;
    }

    return normalized;
  } catch (e) {
    logger.error("getUpcomingFixtures failed", e?.message || String(e));
    return [];
  }
}

// Helpers: robust accessors and per-sport parsers
function pickId(r) {
  return r.id || r.event_id || r.game_id || r.match_id || (r._id && r._id.$oid) || null;
}

function pickStart(r) {
  return r.scheduled || r.start_time || r.start || r.scheduled_at || r.utcDate || r.date || r.startTime || null;
}

function pickTeams(r) {
  // try common shapes
  if (r.home && r.away) return { home: r.home.name || r.home, away: r.away.name || r.away };
  if (Array.isArray(r.competitors) && r.competitors.length >= 2)
    return { home: r.competitors[0].name || r.competitors[0].id, away: r.competitors[1].name || r.competitors[1].id };
  if (Array.isArray(r.teams) && r.teams.length >= 2)
    return { home: r.teams[0].name || r.teams[0].id, away: r.teams[1].name || r.teams[1].id };
  const home = r.home_team?.name || r.team_home || r.home_team || null;
  const away = r.away_team?.name || r.team_away || r.away_team || null;
  return { home, away };
}

function normalizeFixture(sport, r) {
  const teams = pickTeams(r);
  return {
    sport,
    league: r.competition?.name || r.league || r.tournament?.name || r.season || null,
    eventId: pickId(r),
    startTimeISO: pickStart(r),
    homeTeam: teams.home || null,
    awayTeam: teams.away || null,
    venue: r.venue?.name || r.location || r.venue || null,
    status: r.status || r.state || r.match_status || null,
  };
}

// Per-sport parsers to handle sport-specific schedule JSON shapes.
const SPORT_PARSERS = {
  nba: (it) => {
    // NBA schedule often uses `game` objects with `id`, `scheduled`, `home`/`away` competitors
    const teams = pickTeams(it);
    return {
      sport: "nba",
      league: it.tournament?.name || it.league || it.season || it.competition?.name || null,
      eventId: pickId(it) || it.game_id || it.id,
      startTimeISO: pickStart(it) || it.scheduled || it.start_time || null,
      homeTeam: teams.home || it.home_team?.name || null,
      awayTeam: teams.away || it.away_team?.name || null,
      venue: it.venue?.name || it.arena || null,
      status: it.status || it.boxscore_status || null,
    };
  },
  nfl: (it) => {
    const teams = pickTeams(it);
    return {
      sport: "nfl",
      league: it.tournament?.name || it.league || null,
      eventId: pickId(it) || it.game_id || it.id,
      startTimeISO: pickStart(it) || it.scheduled_at || null,
      homeTeam: teams.home || it.home_team?.name || null,
      awayTeam: teams.away || it.away_team?.name || null,
      venue: it.venue?.name || it.stadium || null,
      status: it.status || it.match_status || null,
    };
  },
  mlb: (it) => {
    const teams = pickTeams(it);
    return {
      sport: "mlb",
      league: it.tournament?.name || it.league || null,
      eventId: pickId(it) || it.game_id || it.id,
      startTimeISO: pickStart(it) || it.scheduled || null,
      homeTeam: teams.home || it.home_team?.name || null,
      awayTeam: teams.away || it.away_team?.name || null,
      venue: it.venue?.name || it.ballpark || null,
      status: it.status || it.match_status || null,
    };
  },
  nhl: (it) => {
    const teams = pickTeams(it);
    return {
      sport: "nhl",
      league: it.tournament?.name || it.league || null,
      eventId: pickId(it) || it.game_id || it.id,
      startTimeISO: pickStart(it) || it.scheduled || null,
      homeTeam: teams.home || it.home_team?.name || null,
      awayTeam: teams.away || it.away_team?.name || null,
      venue: it.venue?.name || it.arena || null,
      status: it.status || it.match_status || null,
    };
  },
  tennis: (it) => {
    // Tennis often has competitors array with players
    const teams = pickTeams(it);
    return {
      sport: "tennis",
      league: it.tournament?.name || it.tournament || null,
      eventId: pickId(it) || it.match_id || it.id,
      startTimeISO: pickStart(it) || it.scheduled || null,
      homeTeam: teams.home || (it.competitors && it.competitors[0] && it.competitors[0].name) || null,
      awayTeam: teams.away || (it.competitors && it.competitors[1] && it.competitors[1].name) || null,
      venue: it.venue?.name || it.court || null,
      status: it.status || it.state || null,
    };
  },
  nascar: (it) => {
    // NASCAR/motorsports events may have a name/title and participants
    const teams = pickTeams(it);
    return {
      sport: "nascar",
      league: it.series || it.category || it.tournament?.name || null,
      eventId: pickId(it) || it.event_id || it.id,
      startTimeISO: pickStart(it) || it.start_time || it.scheduled || null,
      homeTeam: teams.home || (it.participants && it.participants[0] && it.participants[0].name) || null,
      awayTeam: teams.away || null,
      venue: it.venue?.name || it.track || null,
      status: it.status || it.state || null,
    };
  },
};

function parseBySport(sport, r) {
  const s = String(sport || "").toLowerCase();
  if (SPORT_PARSERS[s]) return SPORT_PARSERS[s](r);
  return normalizeFixture(sport, r);
}

export async function fetchAndNormalizeFixtures(sport = "soccer", params = {}, opts = {}) {
  const date = params.date || new Date().toISOString().slice(0, 10);
  const res = await fetchSportradar(sport, "matches_by_date", { date }, opts);
  const meta = { httpStatus: res?.httpStatus || res?.status || null, pathUsed: res?.provider_path || null, errorReason: null };
  // Map HTTP status codes to friendly error reasons
  function mapStatusToReason(status, body) {
    if (!status) return null;
    const s = Number(status);
    if (s === 429) return "rate_limit";
    if (s === 403) {
      const b = String(body || "").toLowerCase();
      if (b.includes("auth") || b.includes("authentication") || b.includes("invalid") || b.includes("key")) return "invalid_key";
      return "permission_denied";
    }
    if (s === 404) return "not_found";
    if (s === 502) return "gateway_error";
    return "unknown_error";
  }

  if (!res || res.error || !res.ok) {
    const status = res?.httpStatus || res?.status || null;
    meta.errorReason = mapStatusToReason(status, res?.body || res?.bodyText) || res?.message || res?.bodyText || res?.error || "failed_fetch";
    return { items: [], ...meta };
  }
  const raw = res.data || {};
  let items = [];
  // possible containers
  if (Array.isArray(raw.games)) items = raw.games;
  else if (Array.isArray(raw.events)) items = raw.events;
  else if (Array.isArray(raw.matches)) items = raw.matches;
  else if (Array.isArray(raw.summaries)) items = raw.summaries;
  else if (raw.schedule && Array.isArray(raw.schedule.games)) items = raw.schedule.games;
  else if (raw.schedule && Array.isArray(raw.schedule.events)) items = raw.schedule.events;
  else if (Array.isArray(raw.items)) items = raw.items;
  else if (Array.isArray(raw)) items = raw;

  items = Array.isArray(items) ? items : [];
  let normalized = items.map((r) => parseBySport(sport, r));
  // Add compatibility aliases expected by callers/tests: `home`/`away`
  normalized = normalized.map((n) => ({
    ...n,
    home: n.homeTeam || n.home || null,
    away: n.awayTeam || n.away || null,
  }));
  return { items: normalized, ...meta };
}

export async function fetchAndNormalizeTeams(sport = "soccer", opts = {}) {
  const s = String(sport || "soccer").toLowerCase();
  const directCandidates = {
    nba: ["/nba/v3/en/teams.json", "/basketball/v4/en/teams.json", "/basketball/trial/v3/en/teams.json"],
    nfl: ["/nfl/v3/en/teams.json", "/americanfootball/v4/en/teams.json"],
    mlb: ["/mlb/v3/en/teams.json", "/baseball/v4/en/teams.json"],
    nhl: ["/nhl/v3/en/teams.json", "/icehockey/v4/en/teams.json"],
    tennis: ["/tennis/v2/en/players.json"],
    nascar: ["/nascar/trial/v2/en/schedules/{date}/schedule.json", "/motorsports/trial/v2/en/events/{date}/schedule.json"],
    soccer: ["/soccer/v4/en/teams.json"],
  };

  const meta = { httpStatus: null, pathUsed: null, errorReason: null };
  function mapStatusToReason(status, body) {
    if (!status) return null;
    const s = Number(status);
    if (s === 429) return "rate_limit";
    if (s === 403) {
      const b = String(body || "").toLowerCase();
      if (b.includes("auth") || b.includes("authentication") || b.includes("invalid") || b.includes("key")) return "invalid_key";
      return "permission_denied";
    }
    if (s === 404) return "not_found";
    if (s === 502) return "gateway_error";
    return "unknown_error";
  }
  // try direct fetch via provided fetcher
  const fetcher = opts.fetcher;
  if (fetcher && typeof fetcher === "function") {
    const paths = directCandidates[s] || [];
    for (const p of paths) {
      try {
      const r = await fetcher({ base: process.env.SPORTRADAR_BASE || "https://api.sportradar.us", path: p, auth: { method: "query", queryParam: "api_key" }, key: process.env.SPORTRADAR_KEY || process.env.SPORTRADAR_API_KEY }, opts);
      meta.httpStatus = r && (r.httpStatus || r.status);
      meta.pathUsed = p;
        const body = r && (r.body || r.data || r);
        if (body && Array.isArray(body.teams)) {
          const teams = body.teams.map((t) => ({ sport: s, teamId: t.id || t.team_id || null, name: t.name || t.full_name || null, market: t.market || null, alias: t.alias || t.short_name || null }));
          return { items: teams, ...meta };
        }
        if (Array.isArray(body) && body.length && body[0].name) {
          const teams = body.map((t) => ({ sport: s, teamId: t.id || null, name: t.name, market: t.market || null, alias: t.alias || t.short_name || null }));
          return { items: teams, ...meta };
        }
      } catch (e) {
        meta.errorReason = String(e?.message || e) || meta.errorReason;
      }
    }
  }

  // Fallback to adapter routes
  try {
    const res = await fetchSportradar(s, "competitions", {}, opts);
    meta.httpStatus = res?.httpStatus || res?.status || null;
    meta.pathUsed = res?.provider_path || null;
    if (!res || res.error || !res.ok) {
      meta.errorReason = mapStatusToReason(meta.httpStatus, res?.body || res?.bodyText) || res?.message || res?.bodyText || res?.error || "failed_fetch";
      return { items: [], ...meta };
    }
    const body = res.data || {};
    if (Array.isArray(body.teams)) {
      const teams = body.teams.map((t) => ({ sport: s, teamId: t.id || t.team_id || null, name: t.name || t.full_name || null, market: t.market || null, alias: t.alias || t.short_name || null }));
      return { items: teams, ...meta };
    }
  } catch (e) {
    meta.errorReason = String(e?.message || e) || "unknown_error";
    return { items: [], ...meta };
  }

  // Last resort: extract from fixtures
  try {
    const f = await fetchAndNormalizeFixtures(s, {}, opts);
    meta.httpStatus = meta.httpStatus || f.httpStatus || null;
    meta.pathUsed = meta.pathUsed || f.pathUsed || f.provider_path || null;
    const map = new Map();
    (f.items || []).forEach((it) => {
      if (it.homeTeam) map.set(it.homeTeam, { sport: s, teamId: null, name: it.homeTeam, market: null, alias: null });
      if (it.awayTeam) map.set(it.awayTeam, { sport: s, teamId: null, name: it.awayTeam, market: null, alias: null });
    });
    return { items: Array.from(map.values()), ...meta };
  } catch (e) {
    meta.errorReason = String(e?.message || e);
    return { items: [], ...meta };
  }
}


export async function getTeams(sport = "soccer", opts = {}) {
  const s = String(sport || "soccer").toLowerCase();
  const cacheKey = `sportradar:teams:${s}`;

  try {
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const allowed = await checkRateLimit();
    if (!allowed) {
      logger.warn("QPS limit reached for teams");
      return [];
    }

    // First: if a custom fetcher is supplied, try likely 'teams' endpoints directly
    const directCandidates = {
      nba: [
        "/nba/v3/en/teams.json",
        "/basketball/v4/en/teams.json",
        "/basketball/trial/v3/en/teams.json",
      ],
      nfl: ["/nfl/v3/en/teams.json", "/americanfootball/v4/en/teams.json"],
      mlb: ["/mlb/v3/en/teams.json", "/baseball/v4/en/teams.json"],
      nhl: ["/nhl/v3/en/teams.json", "/icehockey/v4/en/teams.json"],
      tennis: ["/tennis/v2/en/players.json"],
      nascar: ["/motorsports/v2/en/participants.json", "/motorsports/v2/en/teams.json"],
      soccer: ["/soccer/v4/en/teams.json", "/soccer/v4/en/competitions.json"],
    };

    let teams = [];
    const fetcher = opts.fetcher;
    if (fetcher && typeof fetcher === "function") {
      const paths = directCandidates[s] || [];
      for (const p of paths) {
        try {
          const r = await fetcher({ base: "https://api.sportradar.com", path: p, auth: { method: "query", queryParam: "api_key" }, key: process.env.SPORTRADAR_KEY || process.env.SPORTRADAR_API_KEY }, opts);
          const body = r && (r.body || r.data || r); // accept multiple shapes
          if (body && Array.isArray(body.teams)) {
            teams = body.teams.map((t) => ({ sport: s, teamId: t.id || t.team_id || null, name: t.name || t.full_name || t.title || t.display_name || null, market: t.market || null, alias: t.alias || t.short_name || null }));
            break;
          }
          // some responses return array directly
          if (Array.isArray(body) && body.length > 0 && body[0].name) {
            teams = body.map((t) => ({ sport: s, teamId: t.id || null, name: t.name, market: t.market || null, alias: t.alias || t.short_name || null }));
            break;
          }
        } catch (e) {
          void e;
        }
      }
    }

    // If direct fetch didn't find teams, try generic Sportradar adapter routes
    if (teams.length === 0) {
      // Try a few plausible endpoint types via the adapter
      const candidates = ["competitions", "seasons"];
      for (const c of candidates) {
        try {
          const res = await fetchSportradar(s, c, {}, opts);
          if (res && res.ok && res.data) {
            const body = res.data;
            if (Array.isArray(body.teams)) {
              teams = body.teams.map((t) => ({ sport: s, teamId: t.id || t.team_id || null, name: t.name || t.full_name || t.title || t.display_name || null, market: t.market || null, alias: t.alias || t.short_name || null }));
              break;
            }
          }
        } catch (e) {
          void e;
        }
      }
    }

    // If still empty, attempt to fetch today's fixtures and extract unique teams
    if (teams.length === 0) {
      // fall back to extracting from fixtures
      const fixtures = await getUpcomingFixtures(s, opts);
      const map = new Map();
      fixtures.forEach((f) => {
        if (f.homeTeam) map.set(f.homeTeam, { sport: s, teamId: null, name: f.homeTeam, market: null, alias: null });
        if (f.awayTeam) map.set(f.awayTeam, { sport: s, teamId: null, name: f.awayTeam, market: null, alias: null });
      });
      teams = Array.from(map.values());
    }

    try {
      await cacheSet(cacheKey, teams, Number(process.env.SPORTRADAR_TTL_SEC || 300));
    } catch (e) {
      void e;
    }

    return teams;
  } catch (e) {
    logger.error("getTeams failed", e?.message || String(e));
    return [];
  }
}

export { sportEmoji };
