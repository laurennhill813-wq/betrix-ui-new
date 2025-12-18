import fetch from "node-fetch";
import { getEnv } from "../utils/env.js";
import { getCache, setCache } from "../utils/cache.js";
import logger from "../utils/logger.js";
import createRateLimiter from "../utils/rate-limiter.js";
import { tryProviders } from "../utils/provider-fallback.js";

const rateLimiter = createRateLimiter(null);

const DEFAULT_LIMIT = 3;

function getKey() {
  const key = getEnv("SERPAPI_KEY", { required: false });
  return key || null;
}

async function fetchTeamNews(team, limit = DEFAULT_LIMIT) {
  const key = getKey();
  if (!key) return { error: "Missing SERPAPI_KEY" };
  // Rate limit per team to avoid provider quota abuse
  const allowed = await rateLimiter.allow(`serpapi:team:${team}`, 5, 60);
  if (!allowed) return { error: "Rate limit exceeded, try again later" };
  const cacheKey = `serpapi:team:${team}:limit:${limit}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;
  const q = `${team} football news`;
  const url = `https://serpapi.com/search.json?q=${encodeURIComponent(q)}&tbm=nws&api_key=${key}`;

  // Use provider-fallback: primary is SerpApi; future providers can be added
  const providers = [
    async () => {
      const res = await fetch(url, { timeout: 10000 });
      const data = await res.json();
      const articles = data.news_results || [];
      const out = articles.slice(0, limit).map((a) => ({
        title: a.title,
        link: a.link,
        source: a.source,
        published: a.date,
      }));
      return out;
    },
  ];

  try {
    const pf = await tryProviders(providers, 10000);
    if (!pf.success) return { error: pf.error };
    const out = pf.data;
    setCache(cacheKey, out, 60 * 1000);
    return out;
  } catch (err) {
    logger.warn("SerpApi fetchTeamNews error", err?.message || String(err));
    return { error: String(err.message || err) };
  }
}

async function fetchFavoritesNews(favorites = [], perTeam = DEFAULT_LIMIT) {
  if (!Array.isArray(favorites) || favorites.length === 0) {
    return {
      text: "You have no favorite teams yet. Add some using /favorites.",
    };
  }

  const parts = [];
  for (const team of favorites.slice(0, 10)) {
    try {
      const r = await fetchTeamNews(team, perTeam);
      if (r && r.error) {
        parts.push(`⚽ ${team}\n⚠️ Unable to fetch news: ${r.error}`);
        continue;
      }
      const lines = (r || []).map(
        (a, i) => `📰 ${i + 1}. ${a.title}\n${a.link}`,
      );
      if (lines.length === 0) parts.push(`⚽ ${team}\n_No recent news found._`);
      else parts.push(`⚽ ${team}\n${lines.join("\n\n")}`);
    } catch (e) {
      parts.push(`⚽ ${team}\n⚠️ Error fetching news`);
    }
  }

  return {
    text: `🔥 Your Personalized BETRIX News Feed:\n\n${parts.join("\n\n")}`,
  };
}

export { fetchTeamNews, fetchFavoritesNews };
