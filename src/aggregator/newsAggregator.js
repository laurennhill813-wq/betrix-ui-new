// General news and content aggregator — fetches breaking news, transfer news, and general articles
import fetch from "../lib/fetch.js";
import * as cheerio from "cheerio";

const NEWSAPI_KEY = process.env.NEWSAPI_KEY || null;
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || null;
const NEWSDATA_KEY = process.env.NEWSDATA_KEY || null;

// Normalize news item to common format
function normalizeNewsItem(item, source) {
  return {
    id: item.id || item.url || `${Date.now()}-${Math.random()}`,
    type: "news",
    sport: "general",
    league: item.category || item.source?.name || "News",
    home: null,
    away: null,
    title: item.title || item.headline || "",
    description: item.description || item.content || item.summary || "",
    url: item.url || item.link || "",
    imageUrl: item.urlToImage || item.image || item.thumbnail || null,
    source,
    status: "published",
    time: item.publishedAt || item.pubDate || new Date().toISOString(),
    importance: item.category === "breaking" ? "high" : "medium",
  };
}

// NewsAPI (newsapi.org) — covers major news outlets globally
async function fetchFromNewsApi(keywords = []) {
  if (!NEWSAPI_KEY) return [];
  try {
    const q = keywords.slice(0, 3).join(" OR ");
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&sortBy=publishedAt&language=en&pageSize=10&apiKey=${NEWSAPI_KEY}`;
    const res = await fetch(url, { redirect: "follow", timeout: 8000 });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.articles) return [];
    return data.articles.map((a) => normalizeNewsItem(a, "newsapi"));
  } catch (e) {
    return [];
  }
}

// NewsData.io — includes sports transfer news, breaking sports news
async function fetchFromNewsData(keywords = []) {
  if (!NEWSDATA_KEY) return [];
  try {
    const q = keywords.slice(0, 3).join(" OR ");
    const url = `https://newsdata.io/api/1/news?q=${encodeURIComponent(q)}&language=en&size=10&apikey=${NEWSDATA_KEY}`;
    const res = await fetch(url, { redirect: "follow", timeout: 8000 });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.results) return [];
    return data.results.map((a) => normalizeNewsItem(a, "newsdata"));
  } catch (e) {
    return [];
  }
}

// RSS feed aggregation (general and sports news)
async function fetchFromRssFeeds(keywords = []) {
  const out = [];
  try {
    const feedsRaw = String(process.env.NEWS_RSS_FEEDS || "").trim();
    if (!feedsRaw) return out;
    const feeds = feedsRaw.split(",").map((s) => s.trim()).filter(Boolean);
    if (feeds.length === 0) return out;

    const keywords_lower = keywords.map((k) => String(k).toLowerCase());

    for (const feed of feeds) {
      try {
        const res = await fetch(feed, { redirect: "follow", timeout: 8000 });
        if (!res.ok) continue;
        const txt = await res.text();
        // Crude RSS parse
        const items = txt.split(/<item[\s>]/i).slice(1);
        for (const itm of items.slice(0, 10)) {
          const titleMatch = itm.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
          const descMatch = itm.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
          const linkMatch = itm.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
          const imageMatch = itm.match(/<image[^>]*>([\s\S]*?)<\/image>/i);
          const title = titleMatch ? titleMatch[1].trim().slice(0, 200) : "";
          const desc = descMatch ? descMatch[1].trim().slice(0, 400) : "";
          const link = linkMatch ? linkMatch[1].trim() : "";
          const image = imageMatch ? imageMatch[1].trim() : null;

          const hay = (title + " " + desc).toLowerCase();
          const matchScore = keywords_lower.filter((k) => k && hay.includes(k)).length;

          if (title && (matchScore > 0 || keywords_lower.length === 0)) {
            out.push(
              normalizeNewsItem(
                { title, description: desc, url: link, urlToImage: image },
                "rss",
              ),
            );
          }
        }
      } catch (e) {
        /* ignore feed errors */
      }
    }
  } catch (e) {}
  return out;
}

// Fetch latest news including transfer news, breaking sports, general news
export async function getLatestNews(keywords = []) {
  try {
    // Always include general news keywords
    const k = Array.isArray(keywords)
      ? [...keywords.filter(Boolean).map((s) => String(s).trim()), "breaking news", "world", "technology", "entertainment", "politics", "science", "health"]
      : ["breaking news", "world", "technology", "entertainment", "politics", "science", "health"];

    // Parallel fetch from multiple sources
    const [newsapi, newsdata, rss] = await Promise.all([
      fetchFromNewsApi(k).catch((err) => { console.warn('[Aggregator] fetchFromNewsApi error:', err); return []; }),
      fetchFromNewsData(k).catch((err) => { console.warn('[Aggregator] fetchFromNewsData error:', err); return []; }),
      fetchFromRssFeeds(k).catch((err) => { console.warn('[Aggregator] fetchFromRssFeeds error:', err); return []; }),
    ]);

    let allItems = [...newsapi, ...newsdata, ...rss];
    console.log('[Aggregator] NewsAPI:', newsapi.length, 'NewsData:', newsdata.length, 'RSS:', rss.length);

    // If no API keys and no RSS, scrape Google News and Bing News
    if (allItems.length === 0) {
      try {
        const q = k.join(" ");
        // Google News (2025 selectors)
        const urlGoogle = `https://news.google.com/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
        console.log('[Aggregator] Fetching Google News:', urlGoogle);
        const resGoogle = await fetch(urlGoogle);
        console.log('[Aggregator] Google News status:', resGoogle.status);
        const htmlGoogle = await resGoogle.text();
        const $g = cheerio.load(htmlGoogle);
        let googleCount = 0;
        $g('a').each((i, el) => {
          const href = $g(el).attr('href') || '';
          // Only consider article/read links
          if (href.startsWith('/articles/') || href.startsWith('/read/')) {
            const headline = $g(el).text().trim();
            // Try to find image in parent or next siblings
            let imageUrl = null;
            const parent = $g(el).parent();
            if (parent) {
              const img = parent.find('img').first();
              if (img && img.attr('src')) imageUrl = img.attr('src');
            }
            if (!imageUrl) {
              // Try next siblings
              const sibImg = $g(el).nextAll('img').first();
              if (sibImg && sibImg.attr('src')) imageUrl = sibImg.attr('src');
            }
            if (headline && href) {
              allItems.push({
                id: href,
                type: "news",
                sport: "general",
                league: "News",
                home: null,
                away: null,
                title: headline,
                description: "",
                url: href.startsWith('http') ? href : `https://news.google.com${href}`,
                imageUrl: imageUrl || null,
                videoUrl: null,
                source: "google-news",
                status: "published",
                time: new Date().toISOString(),
                importance: "medium",
              });
              googleCount++;
            }
          }
        });
        console.log('[Aggregator] Google News articles found:', googleCount);
        // Bing News (2025 selectors)
        const urlBing = `https://www.bing.com/news/search?q=${encodeURIComponent(q)}`;
        console.log('[Aggregator] Fetching Bing News:', urlBing);
        const resBing = await fetch(urlBing);
        console.log('[Aggregator] Bing News status:', resBing.status);
        const htmlBing = await resBing.text();
        const $b = cheerio.load(htmlBing);
        let bingCount = 0;
        $b('a').each((i, el) => {
          const href = $b(el).attr('href') || '';
          const title = $b(el).attr('title') || $b(el).attr('aria-label') || $b(el).text().trim();
          // Only consider links to news articles
          if (href.startsWith('http') && title.length > 10) {
            // Try to find image in parent or next siblings
            let imageUrl = null;
            const parent = $b(el).parent();
            if (parent) {
              const img = parent.find('img').first();
              if (img && img.attr('src')) imageUrl = img.attr('src');
            }
            if (!imageUrl) {
              const sibImg = $b(el).nextAll('img').first();
              if (sibImg && sibImg.attr('src')) imageUrl = sibImg.attr('src');
            }
            allItems.push({
              id: href,
              type: "news",
              sport: "general",
              league: "News",
              home: null,
              away: null,
              title: title,
              description: "",
              url: href,
              imageUrl: imageUrl || null,
              videoUrl: null,
              source: "bing-news",
              status: "published",
              time: new Date().toISOString(),
              importance: "medium",
            });
            bingCount++;
          }
        });
        console.log('[Aggregator] Bing News articles found:', bingCount);
      } catch (e) {
        console.warn("newsAggregator web scrape error", e?.message || e);
      }
    }

    // Deduplicate by URL and title
    const seen = new Set();
    const unique = [];
    for (const item of allItems) {
      const key = (item.url || item.title || "").toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(item);
      }
    }

    // Sort by time (most recent first)
    unique.sort((a, b) => {
      const timeA = new Date(a.time || 0).getTime();
      const timeB = new Date(b.time || 0).getTime();
      return timeB - timeA;
    });

    return unique.slice(0, 30); // Return top 30 deduplicated items
  } catch (e) {
    console.warn("newsAggregator error", e?.message || e);
    return [];
  }
}

export default { getLatestNews };
