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

    // fetch via provider adapter; use matches_by_date to fetch today's matches
    const date = opts.date || new Date().toISOString().slice(0, 10);
    const res = await fetchSportradar(s, "matches_by_date", { date }, opts);

    if (!res || res.error) {
      logger.warn("Sportradar upcoming fetch error", res?.message || res?.error || "unknown");
      return [];
    }

    let raw = res.data || {};
    // common shapes
    let items = raw.matches || raw.games || raw.events || raw.summaries || raw.items || [];
    if (!Array.isArray(items) && raw && raw.matches) items = raw.matches;
    items = Array.isArray(items) ? items : [];

    const normalized = items.map((r) => {
      const home = r.home?.name || r.home_team?.name || (r.teams && r.teams[0] && r.teams[0].name) || r.team_home || null;
      const away = r.away?.name || r.away_team?.name || (r.teams && r.teams[1] && r.teams[1].name) || r.team_away || null;
      const when = r.scheduled || r.start_time || r.start || r.scheduled_at || r.utcDate || r.date || null;
      return {
        sport: s,
        league: r.competition?.name || r.league || r.tournament?.name || null,
        home: home || "Home",
        away: away || "Away",
        startTime: when,
        venue: r.venue?.name || r.location || null,
        raw: r,
      };
    });

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
            teams = body.teams.map((t) => ({ id: t.id || t.team_id || null, name: t.name || t.full_name || t.title || t.display_name || null }));
            break;
          }
          // some responses return array directly
          if (Array.isArray(body) && body.length > 0 && body[0].name) {
            teams = body.map((t) => ({ id: t.id || null, name: t.name }));
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
              teams = body.teams.map((t) => ({ id: t.id || t.team_id || null, name: t.name || t.full_name || t.title || t.display_name || null }));
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
      const fixtures = await getUpcomingFixtures(s, opts);
      const map = new Map();
      fixtures.forEach((f) => {
        if (f.home) map.set(f.home, { id: null, name: f.home });
        if (f.away) map.set(f.away, { id: null, name: f.away });
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
