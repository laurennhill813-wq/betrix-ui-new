import { getProvidersBySportAndType } from "./providers/helpers.js";
import { callProvider } from "./providers/fetcher.js";
import { cacheGet, cacheSet } from "./../lib/redis-cache.js";

// TTL fallback (seconds)
const DEFAULT_TTL = 60 * 60; // 1 hour for media items

export async function fetchRandomMediaItem({ sport }) {
  const cacheKey = `mediaItem:${sport}`;
  try {
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;
  } catch (e) {
    // continue if cache fails
  }

  const providers = getProvidersBySportAndType(sport, "media");

  for (const provider of providers) {
    try {
      const result = await fetchMediaFromProvider(provider, { sport });
      const item = pickRandomMedia(result, provider.id, sport);
      if (item) {
        try { await cacheSet(cacheKey, item, DEFAULT_TTL); } catch (e) {}
        return item;
      }
    } catch (err) {
      // provider failed; continue to next
      console.warn(`media provider ${provider.id} failed: ${err && err.message ? err.message : err}`);
      continue;
    }
  }

  return null;
}

async function fetchMediaFromProvider(provider, { sport }) {
  switch (provider.id) {
    case "reuters":
      return callProvider({ base: provider.baseUrl, path: `/search?query=${encodeURIComponent(sport)}`, auth: { method: 'query', queryParam: provider.auth.param }, key: process.env[provider.auth.keyEnv] });
    case "getty":
      return callProvider({ base: provider.baseUrl, path: `/search/images/editorial?phrase=${encodeURIComponent(sport)}`, auth: { method: 'header', headerName: provider.auth.headerName }, key: process.env[provider.auth.keyEnv] });
    case "ap_content":
    case "ap_images":
      return callProvider({ base: provider.baseUrl, path: `/images?sport=${encodeURIComponent(sport)}`, auth: { method: 'query', queryParam: provider.auth.param }, key: process.env[provider.auth.keyEnv] });
    case "imagn":
      return callProvider({ base: provider.baseUrl, path: `/images/search?sport=${encodeURIComponent(sport)}`, auth: { method: 'query', queryParam: provider.auth.param }, key: process.env[provider.auth.keyEnv] });
    case "sportradar_images":
      // Sportradar images often are specific endpoints; do a simple flags / logos attempt
      return callProvider({ base: provider.baseUrl, path: `/flags/${encodeURIComponent(sport)}`, auth: { method: 'query', queryParam: provider.auth.param }, key: process.env[provider.auth.keyEnv] });
    default:
      return null;
  }
}

function pickRandomMedia(res, providerId, fallbackSport) {
  if (!res) return null;

  // callProvider returns { ok, body, bodyText }
  const payload = res.body || null;
  if (!payload) return null;

  // common shapes
  const items = payload.items || payload.images || payload.results || (Array.isArray(payload) ? payload : null);
  if (!items || !items.length) return null;

  const raw = items[Math.floor(Math.random() * items.length)];
  const url = raw.url || raw.preview_url || raw.thumbnail_url || (raw.display_sizes && raw.display_sizes[0] && raw.display_sizes[0].uri);
  if (!url) return null;

  return {
    providerId,
    url,
    title: raw.title || raw.caption || raw.headline || null,
    sport: raw.sport || fallbackSport || null,
    league: raw.league || raw.competition || null,
  };
}

export default { fetchRandomMediaItem };
