import fetch from 'node-fetch';

const DEFAULT_LIMIT = 3;
// Hardcoded SerpApi key (Option A) — replace if rotating key
const HARDCODED_SERPAPI_KEY = 'b279670c15a9ca71c47e1415ec19715e0bde735e09dab05eba817978fa061d7b';

function getKey() {
  return HARDCODED_SERPAPI_KEY || process.env.SERPAPI_KEY || null;
}

// Simple in-memory cache with TTL to avoid hitting SerpApi rate limits
const cache = new Map();
function cacheSet(key, value, ttlMs = 60 * 1000) {
  const expires = Date.now() + ttlMs;
  cache.set(key, { value, expires });
}
function cacheGet(key) {
  const rec = cache.get(key);
  if (!rec) return null;
  if (rec.expires < Date.now()) { cache.delete(key); return null; }
  return rec.value;
}

async function fetchTeamNews(team, limit = DEFAULT_LIMIT) {
  const key = getKey();
  if (!key) return { error: 'Missing SERPAPI_KEY' };
  const cacheKey = `team:${team}:limit:${limit}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;
  const q = `${team} football news`;
  const url = `https://serpapi.com/search.json?q=${encodeURIComponent(q)}&tbm=nws&api_key=${key}`;
  try {
    const res = await fetch(url, { timeout: 10000 });
    const data = await res.json();
    const articles = data.news_results || [];
    const out = articles.slice(0, limit).map(a => ({ title: a.title, link: a.link, source: a.source, published: a.date }));
    cacheSet(cacheKey, out, 60 * 1000);
    return out;
  } catch (err) {
    return { error: String(err.message || err) };
  }
}

async function fetchFavoritesNews(favorites = [], perTeam = DEFAULT_LIMIT) {
  if (!Array.isArray(favorites) || favorites.length === 0) {
    return { text: 'You have no favorite teams yet. Add some using /favorites.' };
  }

  const parts = [];
  for (const team of favorites.slice(0, 10)) {
    try {
      const r = await fetchTeamNews(team, perTeam);
      if (r && r.error) {
        parts.push(`⚽ ${team}\n⚠️ Unable to fetch news: ${r.error}`);
        continue;
      }
      const lines = (r || []).map((a, i) => `📰 ${i + 1}. ${a.title}\n${a.link}`);
      if (lines.length === 0) parts.push(`⚽ ${team}\n_No recent news found._`);
      else parts.push(`⚽ ${team}\n${lines.join('\n\n')}`);
    } catch (e) {
      parts.push(`⚽ ${team}\n⚠️ Error fetching news`);
    }
  }

  return { text: `🔥 Your Personalized BETRIX News Feed:\n\n${parts.join('\n\n')}` };
}

export { fetchTeamNews, fetchFavoritesNews };
