// pragmatic Reuters adapter: best-effort search against Reuters Media API
import axios from "axios";

const REUTERS_KEY =
  process.env.REUTERS_API_KEY || process.env.REUTERS_KEY || null;
const REUTERS_BASE =
  process.env.REUTERS_BASE || "https://api.reuters.com/media/v1";

function guessQueryFromEvent(ev = {}) {
  if (!ev) return null;
  if (ev.query) return ev.query;
  if (ev.title) return ev.title;
  if (ev.name) return ev.name;
  if (ev.home_team && ev.away_team) return `${ev.home_team} vs ${ev.away_team}`;
  if (ev.team) return ev.team;
  if (Array.isArray(ev.teams) && ev.teams.length) return ev.teams.join(" ");
  if (ev.player) return ev.player;
  // fallback to sport/tournament
  if (ev.sport) return ev.sport;
  if (ev.tournament) return ev.tournament;
  return null;
}

function collectImageUrls(obj, out = new Set()) {
  if (!obj) return out;
  if (typeof obj === "string") {
    const s = obj;
    if (s.match(/\.(?:jpe?g|png|gif|bmp|webp|svg)(?:\?|$)/i)) out.add(s);
    return out;
  }
  if (Array.isArray(obj)) {
    for (const v of obj) collectImageUrls(v, out);
    return out;
  }
  if (typeof obj === "object") {
    for (const k of Object.keys(obj)) {
      try {
        collectImageUrls(obj[k], out);
      } catch (e) {}
    }
  }
  return out;
}

// Returns array of { url, source }
export async function getReutersImages(ev = {}, limit = 5) {
  if (!REUTERS_KEY) return [];
  const out = [];
  try {
    const q = guessQueryFromEvent(ev) || ev.key || ev.id || "sports";
    const url = `${REUTERS_BASE.replace(/\/+$/, "")}/search`;
    const params = { query: q, limit: limit || 10, api_key: REUTERS_KEY };
    const r = await axios.get(url, { params, timeout: 10000 });
    const data = r && r.data ? r.data : {};

    // collect candidate image urls from any predictable fields
    const found = collectImageUrls(data);
    for (const u of found) {
      if (out.length >= (limit || 3)) break;
      out.push({ url: u, source: "reuters" });
    }
  } catch (err) {
    // best-effort: ignore errors and return what we have
  }
  // dedupe and limit
  const seen = new Set();
  const final = [];
  for (const r of out) {
    if (!r || !r.url) continue;
    if (seen.has(r.url)) continue;
    seen.add(r.url);
    final.push(r);
    if (final.length >= (Number(limit) || 3)) break;
  }
  return final;
}

export default { getReutersImages };
