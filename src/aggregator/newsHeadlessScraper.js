// Headless news scraper using Puppeteer for Google and Bing News
import puppeteer from "puppeteer";

async function scrapeGoogleNewsHeadless(query, maxArticles = 10) {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  const url = `https://news.google.com/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });
  await page.waitForTimeout(2000);
  const articles = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll("article").forEach((art) => {
      const a = art.querySelector("a[href*='/articles/'],a[href*='/read/']");
      if (!a) return;
      const href = a.getAttribute("href");
      const title = a.textContent.trim();
      let imageUrl = null;
      const img = art.querySelector("img");
      if (img && img.src) imageUrl = img.src;
      let articleUrl = href.startsWith("http") ? href : `https://news.google.com${href}`;
      if (href && title.length > 10) {
        out.push({
          id: href,
          title,
          url: articleUrl,
          imageUrl: imageUrl || null,
        });
      }
    });
    return out;
  });
  await browser.close();
  return articles.slice(0, maxArticles);
}

async function scrapeBingNewsHeadless(query, maxArticles = 10) {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  const url = `https://www.bing.com/news/search?q=${encodeURIComponent(query)}`;
  await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });
  await page.waitForTimeout(2000);
  const articles = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll("div.news-card,div.newsitem,div.cardcommon,div.t_s").forEach((card) => {
      let a = card.querySelector("a");
      if (!a && card.tagName === "A") a = card;
      if (!a) return;
      const href = a.getAttribute("href");
      const title = a.getAttribute("title") || a.getAttribute("aria-label") || a.textContent.trim();
      let imageUrl = null;
      const img = card.querySelector("img");
      if (img && img.src) imageUrl = img.src;
      if (
        href &&
        href.startsWith("http") &&
        title.length > 10 &&
        (href.includes("/news/") || href.includes("/articles/") || href.match(/\d{4}\//))
      ) {
        out.push({
          id: href,
          title,
          url: href,
          imageUrl: imageUrl || null,
        });
      }
    });
    return out;
  });
  await browser.close();
  return articles.slice(0, maxArticles);
}
export { scrapeGoogleNewsHeadless, scrapeBingNewsHeadless };
