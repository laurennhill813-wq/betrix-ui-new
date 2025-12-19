import { getRedis } from "../lib/redis-factory.js";
import createRedisAdapter from "../utils/redis-adapter.js";
import { Pool } from "pg";
import fetch from "../lib/fetch.js";
import { getNewsHeadlines } from "./news-provider-enhanced.js";

// Minimal news service: fetch headlines from public RSS, cache in Redis,
// persist into Postgres `news` table when possible, and expose helper methods

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const REDIS_KEY = "news:latest";
const REDIS_TTL = 60 * 60; // 1 hour

export async function fetchAndStoreHeadlines({
  query = "football",
  max = 10,
} = {}) {
  const redis = createRedisAdapter(getRedis());
  const items = await getNewsHeadlines({ query, max });

  // Normalize items
  const normalized = items.map((it) => ({
    title: it.title || null,
    link: it.link || null,
    summary: it.description || null,
    published_at: it.pubDate || null,
    source: null,
    raw: it,
  }));

  // Store into Postgres (upsert by link) - best-effort
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS news (
        id SERIAL PRIMARY KEY,
        title TEXT,
        link TEXT UNIQUE,
        source TEXT,
        summary TEXT,
        published_at timestamptz,
        raw jsonb,
        inserted_at timestamptz DEFAULT now()
      )
    `);

    for (const n of normalized) {
      if (!n.link) continue;
      try {
        await pool.query(
          `INSERT INTO news(title,link,source,summary,published_at,raw) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT (link) DO UPDATE SET title = EXCLUDED.title, summary = EXCLUDED.summary, published_at = EXCLUDED.published_at, raw = EXCLUDED.raw`,
          [n.title, n.link, n.source, n.summary, n.published_at, n.raw],
        );
      } catch (e) {
        /* best-effort, continue */
      }
    }
  } catch (e) {
    // DB not critical for cached headlines
    // console.warn('news-service: db store failed', e?.message || String(e));
  }

  // Cache in Redis and publish a single notification if top headline changed
  try {
    if (redis) {
      await redis.setex(REDIS_KEY, REDIS_TTL, JSON.stringify(normalized));
      const top =
        normalized && normalized[0]
          ? normalized[0].link || normalized[0].title
          : null;
      if (top) {
        try {
          const last = await redis.get("news:last-pushed");
          if (String(last || "") !== String(top)) {
            const msg = {
              ts: new Date().toISOString(),
              type: "news_headline",
              title: normalized[0].title,
              link: normalized[0].link,
            };
            // push to outgoing telegram queue (bot consumes this)
            try {
              await redis.lpush("outgoing:telegram", JSON.stringify(msg));
            } catch (_) {
              /* ignore */
            }
            await redis.set("news:last-pushed", String(top));
          }
        } catch (e) {
          /* ignore publish failures */
        }
      }
    }
  } catch (e) {
    // ignore
  }

  return normalized;
}

export async function getCachedHeadlines({ max = 10 } = {}) {
  const redis = createRedisAdapter(getRedis());
  try {
    if (redis) {
      const txt = await redis.get(REDIS_KEY);
      if (txt) {
        const parsed = JSON.parse(txt);
        return parsed.slice(0, max);
      }
    }
  } catch (e) {
    // ignore and fallback
  }

  // Fallback to live fetch
  return await fetchAndStoreHeadlines({ max });
}

// Fetch remote article HTML, do light sanitization (strip <script> tags) and
// return minimal Betrix-branded HTML wrapper.
export async function fetchArticleHtmlByLink(link) {
  if (!link) throw new Error("link required");
  const res = await fetch(link, {
    timeout: 15000,
    headers: { "User-Agent": "BetrixBot/1.0 (+https://betrix.app)" },
  });
  if (!res.ok) throw new Error(`fetch failed: ${res.status} ${res.statusText}`);
  let html = await res.text();

  // Remove script tags and on* attributes to limit XSS risks
  html = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  html = html.replace(/on\w+\s*=\s*"[^"]*"/gi, "");
  html = html.replace(/on\w+\s*=\s*'[^']*'/gi, "");

  // Simple wrapper
  const wrapped = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Betrix - Article</title><style>body{font-family:Arial,Helvetica,sans-serif;line-height:1.5;margin:0;padding:0}header{background:#0b4b6f;color:#fff;padding:12px 16px}main{padding:18px}footer{padding:12px;color:#666;font-size:12px;border-top:1px solid #eee}</style></head><body><header><h1>BETRIX</h1></header><main>${html}</main><footer>Powered by Betrix — original article: <a href="${escapeHtml(link)}" target="_blank" rel="noopener">Open original</a></footer></body></html>`;

  return wrapped;
}

function escapeHtml(s) {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export default {
  fetchAndStoreHeadlines,
  getCachedHeadlines,
  fetchArticleHtmlByLink,
};
/**
 * Sports News Service - Free news integration
 * Uses NewsAPI free tier
 */

import { Logger } from "../utils/logger.js";

const logger = new Logger("NewsService");

class NewsService {
  constructor() {
    this.newsApi = "https://newsapi.org/v2";
  }

  /**
   * Get sports news without API key (uses public data)
   */
  async getSportsNews(query = "football") {
    try {
      const response = await fetch(
        `${this.newsApi}/everything?q=${query}&sortBy=publishedAt&language=en&pageSize=5`,
      );
      const data = await response.json();

      if (!data.articles) return [];

      return data.articles.map((a) => ({
        title: a.title,
        source: a.source.name,
        date: new Date(a.publishedAt).toLocaleDateString(),
        url: a.url,
      }));
    } catch (err) {
      logger.error("News fetch failed", err);
      return this.getFallbackNews(query);
    }
  }

  /**
   * Fallback news when API unavailable
   */
  getFallbackNews(query) {
    return [
      {
        title: `Recent ${query} news available`,
        source: "BETRIX",
        date: new Date().toLocaleDateString(),
      },
    ];
  }

  /**
   * Format news for display
   */
  formatNews(articles) {
    let text = `📰 <b>Latest ${articles.length > 0 ? "News" : "Updates"}</b>\n\n`;

    articles.slice(0, 5).forEach((a, i) => {
      text += `${i + 1}. ${a.title}\n   <i>${a.source} - ${a.date}</i>\n\n`;
    });

    return text;
  }
}

export { NewsService };
