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
        // 2025: Google News now uses <article> tags with nested <a> for each news item
        const googleArticles = [];
        const articleEls = $g('article');
        console.log(`[Aggregator][Google] Found ${articleEls.length} <article> tags`);
        articleEls.each((i, artEl) => {
          // Find the first <a> with an href containing /articles/ or /read/
          const a = $g(artEl).find('a[href*="/articles/"],a[href*="/read/"]').first();
          const href = a.attr('href') || '';
          const headline = a.text().trim();
          let imageUrl = null;
          // Try to find an <img> inside the article
          const img = $g(artEl).find('img').first();
          if (img && img.attr('src')) imageUrl = img.attr('src');
          let articleUrl = href.startsWith('http') ? href : `https://news.google.com${href}`;
          if (href && headline.length > 10) {
            googleArticles.push({
              id: href,
              title: headline,
              url: articleUrl,
              imageUrl: imageUrl || null
            });
          }
        });
        // Debug: print sample of found articles
        console.log('[Aggregator][Google] Sample articles:', googleArticles.slice(0, 3));
        // Now fetch/process each article asynchronously
        await Promise.all(googleArticles.map(async (art) => {
          let description = "";
          try {
            const res = await fetch(art.url, { redirect: "follow", timeout: 7000 });
            if (res.ok) {
              const html = await res.text();
              let match = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
              if (!match) match = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
              description = match ? match[1] : "";
              if (!description) {
                const pMatch = html.match(/<p[^>]*>(.*?)<\/p>/i);
                if (pMatch) description = pMatch[1].replace(/<[^>]+>/g, '').trim();
              }
              if (description && description.length > 400) description = description.slice(0, 400);
            }
          } catch (e) {}
          allItems.push({
            id: art.id,
            type: "news",
            sport: "general",
            league: "News",
            home: null,
            away: null,
            title: art.title,
            description: description || "",
            url: art.url,
            imageUrl: art.imageUrl,
            videoUrl: null, // will be filled below if found
            source: "google-news",
            status: "published",
            time: new Date().toISOString(),
            importance: "medium",
          });
        }));
        googleCount = googleArticles.length;
        // Try to extract video URLs for Google News articles (async, after initial scrape)
        await Promise.all(
          allItems.filter(item => item.source === "google-news").map(async (item) => {
            try {
              const res = await fetch(item.url, { redirect: "follow", timeout: 7000 });
              if (!res.ok) return;
              const html = await res.text();
              // Try Open Graph video
              let match = html.match(/<meta[^>]+property=["']og:video["'][^>]+content=["']([^"']+)["']/i);
              if (!match) match = html.match(/<meta[^>]+name=["']twitter:player["'][^>]+content=["']([^"']+)["']/i);
              let foundUrl = match ? match[1] : null;
              if (!foundUrl) {
                // Try <video src="...">
                const videoTag = html.match(/<video[^>]+src=["']([^"']+)["']/i);
                if (videoTag) foundUrl = videoTag[1];
              }
              if (!foundUrl) {
                // Try <iframe src="...">
                const iframeTag = html.match(/<iframe[^>]+src=["']([^"']+\.(mp4|webm|mov|avi|m3u8|mpd)[^"']*)["']/i);
                if (iframeTag) foundUrl = iframeTag[1];
              }
              if (foundUrl) {
                // Resolve relative URLs
                try {
                  foundUrl = new URL(foundUrl, item.url).href;
                } catch (e) {}
                item.videoUrl = foundUrl;
              }
            } catch (e) {}
          })
        );
        console.log('[Aggregator] Google News articles found:', googleCount);
        // Bing News (2025 selectors)
        const urlBing = `https://www.bing.com/news/search?q=${encodeURIComponent(q)}`;
        console.log('[Aggregator] Fetching Bing News:', urlBing);
        const resBing = await fetch(urlBing);
        console.log('[Aggregator] Bing News status:', resBing.status);
        const htmlBing = await resBing.text();
        const $b = cheerio.load(htmlBing);
        let bingCount = 0;
        // 2025: Bing News now uses <news-card> or <div class="news-card newsitem cardcommon b_cards2"> for each article
        const bingArticles = [];
        const cardEls = $b('div.news-card,div.newsitem,div.cardcommon,div.t_s').length > 0 ? $b('div.news-card,div.newsitem,div.cardcommon,div.t_s') : $b('a');
        console.log(`[Aggregator][Bing] Found ${cardEls.length} candidate news cards/links`);
        cardEls.each((i, card) => {
          // Try to find the main <a> inside the card
          let a = $b(card).find('a').first();
          if (!a.length && $b(card).is('a')) a = $b(card);
          const href = a.attr('href') || '';
          const title = a.attr('title') || a.attr('aria-label') || a.text().trim();
          let imageUrl = null;
          const img = $b(card).find('img').first();
          if (img && img.attr('src')) imageUrl = img.attr('src');
          if (
            href.startsWith('http') &&
            title.length > 10 &&
            !href.includes('bing.com/ck/a') &&
            !href.includes('bing.com/translator') &&
            !href.includes('bing.com/search') &&
            !href.includes('privacy') &&
            !href.includes('terms') &&
            !href.includes('support.microsoft.com') &&
            !href.includes('microsoft.com/en-us/ai') &&
            (href.includes('/news/') || href.includes('/articles/') || href.match(/\d{4}\//))
          ) {
            bingArticles.push({
              id: href,
              title,
              url: href,
              imageUrl: imageUrl || null
            });
          }
        });
        // Debug: print sample of found Bing articles
        console.log('[Aggregator][Bing] Sample articles:', bingArticles.slice(0, 3));
        await Promise.all(bingArticles.map(async (art) => {
          let description = "";
          try {
            const res = await fetch(art.url, { redirect: "follow", timeout: 7000 });
            if (res.ok) {
              const html = await res.text();
              let match = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
              if (!match) match = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
              description = match ? match[1] : "";
              if (!description) {
                const pMatch = html.match(/<p[^>]*>(.*?)<\/p>/i);
                if (pMatch) description = pMatch[1].replace(/<[^>]+>/g, '').trim();
              }
              if (description && description.length > 400) description = description.slice(0, 400);
            }
          } catch (e) {}
          // Fallback: if description is missing or too short, use title as description
          if (!description || description.length < 5) {
            description = art.title || "";
            console.log('[Aggregator][Bing] Fallback to title for description:', description);
          } else {
            console.log('[Aggregator][Bing] Extracted description:', description);
          }
          allItems.push({
            id: art.id,
            type: "news",
            sport: "general",
            league: "News",
            home: null,
            away: null,
            title: art.title,
            description: description || "",
            url: art.url,
            imageUrl: art.imageUrl,
            videoUrl: null, // will be filled below if found
            source: "bing-news",
            status: "published",
            time: new Date().toISOString(),
            importance: "medium",
          });
        }));
        // If allItems has no valid news after filtering, force-push at least one Bing article (with fallback description)
        if (allItems.filter(item => item.source === "bing-news").length === 0 && bingArticles.length > 0) {
          const fallbackArt = bingArticles[0];
          allItems.push({
            id: fallbackArt.id,
            type: "news",
            sport: "general",
            league: "News",
            home: null,
            away: null,
            title: fallbackArt.title,
            description: fallbackArt.title || "News Article",
            url: fallbackArt.url,
            imageUrl: fallbackArt.imageUrl,
            videoUrl: null,
            source: "bing-news",
            status: "published",
            time: new Date().toISOString(),
            importance: "medium",
          });
          console.log('[Aggregator][Bing] Forced fallback news article posted:', fallbackArt.title);
        }
        bingCount = bingArticles.length;
        // Try to extract video URLs for Bing News articles (async, after initial scrape)
        await Promise.all(
          allItems.filter(item => item.source === "bing-news").map(async (item) => {
            try {
              const res = await fetch(item.url, { redirect: "follow", timeout: 7000 });
              if (!res.ok) return;
              const html = await res.text();
              // Try Open Graph video
              let match = html.match(/<meta[^>]+property=["']og:video["'][^>]+content=["']([^"']+)["']/i);
              if (!match) match = html.match(/<meta[^>]+name=["']twitter:player["'][^>]+content=["']([^"']+)["']/i);
              let foundUrl = match ? match[1] : null;
              if (!foundUrl) {
                // Try <video src="...">
                const videoTag = html.match(/<video[^>]+src=["']([^"']+)["']/i);
                if (videoTag) foundUrl = videoTag[1];
              }
              if (!foundUrl) {
                // Try <iframe src="...">
                const iframeTag = html.match(/<iframe[^>]+src=["']([^"']+\.(mp4|webm|mov|avi|m3u8|mpd)[^"']*)["']/i);
                if (iframeTag) foundUrl = iframeTag[1];
              }
              if (foundUrl) {
                try {
                  foundUrl = new URL(foundUrl, item.url).href;
                } catch (e) {}
                item.videoUrl = foundUrl;
              }
            } catch (e) {}
          })
        );
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
