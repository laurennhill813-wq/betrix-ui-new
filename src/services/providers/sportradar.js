import { callProvider } from "./fetcher.js";
import { cacheGet, cacheSet } from "../../lib/redis-cache.js";

const DEFAULT_AUTH = { method: "query", queryParam: "api_key" };
const DEFAULT_BASE = process.env.SPORTRADAR_BASE || "https://api.sportradar.us";

// TTLs in seconds
const TTL = {
  competitions: 24 * 60 * 60,
  seasons: 24 * 60 * 60,
  matches_by_date: 120,
  match_summary: 60,
  odds: 30,
};

export async function fetchSportradar(sport, type, params = {}, opts = {}) {
  const key = process.env.SPORTRADAR_KEY || process.env.SPORTRADAR_API_KEY;
  // Allow tests to inject a fetcher and bypass the real API key requirement.
  if (!key && !opts.fetcher)
    return { error: true, message: "Missing SPORTRADAR_API_KEY" };

  // Map canonical types to Sportradar endpoint patterns. Support multiple
  // sports by composing likely endpoint candidates. Exact endpoints vary
  // by sport/version; we try several candidates and accept the first that works.
  const candidates = [];

  const addCandidates = (prefix, paths) => {
    for (const p of paths) candidates.push(`${prefix}${p}`);
  };

  // Generic date format
  const date = params.date || new Date().toISOString().slice(0, 10);

  switch ((sport || "").toLowerCase()) {
    case "soccer":
      if (type === "competitions")
        addCandidates("", [
          "/soccer/v4/en/competitions.json",
          "/soccer/trial/v4/en/competitions.json",
        ]);
      else if (type === "seasons")
        addCandidates("", [
          "/soccer/v4/en/seasons.json",
          "/soccer/trial/v4/en/seasons.json",
        ]);
      else if (type === "matches_by_date")
        addCandidates("", [
          `/soccer/v4/en/matches/${date}/summaries.json`,
          `/soccer/trial/v4/en/matches/${date}/summaries.json`,
          `/soccer/v4/en/matches/${date}/schedule.json`,
        ]);
      else if (type === "standings")
        addCandidates("", [
          "/soccer/v4/en/standings.json",
          "/soccer/trial/v4/en/standings.json",
        ]);
      else
        return {
          error: true,
          message: `Unsupported type ${type} for sport ${sport}`,
        };
      break;

    case "nba":
    case "basketball":
      if (type === "matches_by_date")
        addCandidates("", [
          `/nba/trial/v7/en/games/${date}/schedule.json`,
          `/basketball/trial/v3/en/games/${date}/schedule.json`,
          `/nba/v3/en/games/${date}/schedule.json`,
        ]);
      else
        return {
          error: true,
          message: `Unsupported type ${type} for sport ${sport}`,
        };
      break;

    case "nfl":
    case "americanfootball":
      if (type === "matches_by_date")
        addCandidates("", [
          `/nfl/trial/v7/en/games/${date}/schedule.json`,
          `/americanfootball/trial/v4/en/games/${date}/schedule.json`,
          `/nfl/v3/en/games/${date}/schedule.json`,
        ]);
      else
        return {
          error: true,
          message: `Unsupported type ${type} for sport ${sport}`,
        };
      break;

    case "mlb":
    case "baseball":
      if (type === "matches_by_date")
        addCandidates("", [
          `/mlb/trial/v7/en/games/${date}/schedule.json`,
          `/baseball/trial/v4/en/games/${date}/schedule.json`,
          `/mlb/v3/en/games/${date}/schedule.json`,
        ]);
      else
        return {
          error: true,
          message: `Unsupported type ${type} for sport ${sport}`,
        };
      break;

    case "nhl":
    case "hockey":
      if (type === "matches_by_date")
        addCandidates("", [
          `/nhl/trial/v7/en/games/${date}/schedule.json`,
          `/icehockey/trial/v4/en/games/${date}/schedule.json`,
          `/nhl/v3/en/games/${date}/schedule.json`,
        ]);
      else
        return {
          error: true,
          message: `Unsupported type ${type} for sport ${sport}`,
        };
      break;

    case "tennis":
      if (type === "matches_by_date")
        addCandidates("", [
          `/tennis/trial/v3/en/schedules/${date}/schedule.json`,
          `/tennis/trial/v2/en/games/${date}/schedule.json`,
          `/tennis/v2/en/games/${date}/schedule.json`,
        ]);
      else
        return {
          error: true,
          message: `Unsupported type ${type} for sport ${sport}`,
        };
      break;

    case "nascar":
      if (type === "matches_by_date")
        addCandidates("", [
          `/nascar/trial/v2/en/schedules/${date}/schedule.json`,
          `/motorsports/trial/v2/en/events/${date}/schedule.json`,
          `/motorsports/v2/en/events/${date}/schedule.json`,
        ]);
      else
        return {
          error: true,
          message: `Unsupported type ${type} for sport ${sport}`,
        };
      break;

    default:
      return { error: true, message: `Unsupported sport: ${sport}` };
  }

  // Cache key
  const cacheKey = `betrix:sportradar:${sport}:${type}${params.date ? `:${params.date}` : ""}`;

  // Try cache first
  try {
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return { ok: true, provider: "Sportradar", data: cached, cached: true };
    }
  } catch (e) {
    // If cache fails, just continue to fetch
  }

  // Allow tests to inject a fetcher to avoid network calls
  const fetcher = opts.fetcher || callProvider;

  // Try candidate paths in order until one returns ok
  let res = null;
  let lastErr = null;
  let pathUsed = null;
  for (const pathCandidate of candidates) {
    try {
      res = await fetcher(
        {
          base: DEFAULT_BASE,
          path: pathCandidate,
          auth: DEFAULT_AUTH,
          key,
        },
        opts,
      );
    } catch (e) {
      lastErr = e;
      res = null;
    }
    if (res && res.ok) {
      // found a working endpoint
      pathUsed = pathCandidate;
      break;
    }
  }
  if (!res || !res.ok) {
    // Prefer to return provider response details when available, otherwise propagate error
    if (res)
      return {
        error: true,
        provider: "Sportradar",
        status: res.status,
        headers: res.headers,
        bodyText: res.bodyText,
      };
    return {
      error: true,
      provider: "Sportradar",
      message: "Failed to reach any configured Sportradar endpoint for sport",
      cause: String(lastErr),
    };
  }

  // Very small normalization for competitions/seasons/matches
  if (type === "competitions") {
    const data = res.body;
    const competitions =
      data && data.competitions
        ? data.competitions.map((c) => ({
            id: c.id,
            name: c.name,
            country: c.category && c.category.country_code,
          }))
        : [];
    const payload = { generated_at: data.generated_at, competitions };
    try {
      await cacheSet(cacheKey, payload, TTL.competitions);
    } catch (e) {}
    return { ok: true, provider: "Sportradar", data: payload, provider_path: pathUsed, httpStatus: res && res.status };
  }

  if (type === "seasons") {
    const data = res.body;
    const seasons =
      data && data.seasons
        ? data.seasons.map((s) => ({
            id: s.id,
            name: s.name,
            start_date: s.start_date,
            end_date: s.end_date,
            competition_id: s.competition_id,
          }))
        : [];
    const payload = { generated_at: data.generated_at, seasons };
    try {
      await cacheSet(cacheKey, payload, TTL.seasons);
    } catch (e) {}
    return { ok: true, provider: "Sportradar", data: payload, provider_path: pathUsed, httpStatus: res && res.status };
  }

  if (type === "matches_by_date") {
    const data = res.body;
    const payload = data;
    try {
      await cacheSet(cacheKey, payload, TTL.matches_by_date);
    } catch (e) {}
    return { ok: true, provider: "Sportradar", data: payload, provider_path: pathUsed, httpStatus: res && res.status };
  }

  return { ok: true, provider: "Sportradar", data: res.body, provider_path: pathUsed, httpStatus: res && res.status };
}

/**
 * Probe available Sportradar endpoints for this key.
 * Returns an object describing which route families succeeded and details.
 */
export async function probeSportradarCapabilities(
  sport = "soccer",
  date = null,
  opts = {},
) {
  const key = process.env.SPORTRADAR_KEY;
  if (!key) return { error: true, message: "Missing SPORTRADAR_KEY" };

  const fetcher = opts.fetcher || callProvider;
  const base = opts.base || DEFAULT_BASE;
  const probeDate = date || new Date().toISOString().slice(0, 10);

  const probes = {};

  // reuse candidate logic for common types
  const candidateMap = {
    competitions: [
      `/soccer/v4/en/competitions.json`,
      `/soccer/trial/v4/en/competitions.json`,
    ],
    matches_by_date: [
      `/soccer/v4/en/matches/${probeDate}/schedule.json`,
      `/soccer/v4/en/matches/${probeDate}/matches.json`,
      `/soccer/trial/v4/en/matches/${probeDate}/schedule.json`,
      `/soccer/trial/v4/en/matches/${probeDate}/matches.json`,
      `/soccer/v4/en/matches_by_date/${probeDate}.json`,
      `/soccer/trial/v4/en/matches_by_date/${probeDate}.json`,
    ],
  };

  for (const [kind, candidates] of Object.entries(candidateMap)) {
    probes[kind] = [];
    for (const p of candidates) {
      try {
        const res = await fetcher(
          { base, path: p, auth: DEFAULT_AUTH, key },
          opts,
        );
        probes[kind].push({
          path: p,
          ok: !!(res && res.ok),
          status: res && res.status,
          statusText: res && res.statusText,
        });
      } catch (e) {
        probes[kind].push({ path: p, ok: false, error: String(e) });
      }
    }
  }

  // Summarize
  const summary = {};
  for (const k of Object.keys(probes)) {
    summary[k] = probes[k].some((r) => r.ok) ? "available" : "unavailable";
  }

  return { ok: true, provider: "Sportradar", summary, probes };
}
