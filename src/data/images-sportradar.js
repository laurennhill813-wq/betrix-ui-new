import axios from "axios";

const BASE = process.env.SPORTRADAR_BASE || "https://api.sportradar.com";
const KEY =
  process.env.SPORTRADAR_API_KEY || process.env.IMAGE_SERVICE_KEY || null;

// Simple in-process rate limiter per manifest endpoint key.
const lastCall = new Map();
const MIN_INTERVAL_MS = Number(process.env.SPORTRADAR_MIN_INTERVAL_MS || 1100); // ~1 QPS safe default

function rateLimitKey(key) {
  const now = Date.now();
  const last = lastCall.get(key) || 0;
  if (now - last < MIN_INTERVAL_MS) return false;
  lastCall.set(key, now);
  return true;
}

function extractLinksFromXml(xml) {
  const out = [];
  const re = /<link[^>]+href=["']([^"']+\.(?:jpg|jpeg|png|svg))["'][^>]*>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    out.push(m[1]);
  }
  return out;
}

async function fetchManifestLinks(manifestUrl) {
  try {
    const key = manifestUrl;
    if (!rateLimitKey(key)) return [];
    const r = await axios.get(manifestUrl, { timeout: 10000 });
    const body = r.data || "";
    const links = extractLinksFromXml(body);
    return links.map((h) => {
      const href = h.startsWith("http") ? h : `${BASE.replace(/\/+$/, "")}${h}`;
      // Ensure API key appended when missing
      if (href.includes("api_key=") || !KEY) return href;
      return href.includes("?")
        ? `${href}&api_key=${KEY}`
        : `${href}?api_key=${KEY}`;
    });
  } catch (e) {
    return [];
  }
}

// Sportradar adapter: returns up to `limit` image candidates (best-effort).
async function getSportradarImages(ev = {}, limit = 5) {
  if (!KEY) return [];
  const results = [];
  try {
    // 1) Country flags manifest
    const flagsManifest = `${BASE.replace(/\/+$/, "")}/flags-images-t3/sr/country-flags/flags/manifest.xml?api_key=${KEY}`;
    const flagLinks = await fetchManifestLinks(flagsManifest);
    for (const l of flagLinks.slice(0, limit))
      results.push({ url: l, source: "sportradar-flags" });

    if (results.length >= limit) return results;

    // 2) Logos manifest for sport (try AP provider as common default)
    const sport = (ev.sport || "soccer").toLowerCase();
    const logosManifest = `${BASE.replace(/\/+$/, "")}/${sport}-images-t3/ap/logos/manifest.xml?api_key=${KEY}`;
    const logoLinks = await fetchManifestLinks(logosManifest);
    for (const l of logoLinks.slice(0, limit))
      results.push({ url: l, source: `sportradar-logos-${sport}` });

    if (results.length >= limit) return results;

    // 3) Action shots (if event id or date present)
    if (ev && (ev.id || ev.date)) {
      const provider = ev.provider || "getty";
      let manifest = null;
      if (ev.id) {
        manifest = `${BASE.replace(/\/+$/, "")}/${sport}-images-t3/${provider}/actionshots/events/game/${ev.id}/manifest.xml?api_key=${KEY}`;
      } else if (ev.date) {
        const d = new Date(ev.date);
        const yyyy = d.getUTCFullYear();
        const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
        const dd = String(d.getUTCDate()).padStart(2, "0");
        manifest = `${BASE.replace(/\/+$/, "")}/${sport}-images-t3/${provider}/actionshots/events/${yyyy}/${mm}/${dd}/manifest.xml?api_key=${KEY}`;
      }
      if (manifest) {
        const actLinks = await fetchManifestLinks(manifest);
        for (const l of actLinks.slice(0, limit))
          results.push({ url: l, source: `sportradar-action-${provider}` });
      }
    }
  } catch (err) {
    // best-effort — ignore errors and return what we have
  }

  // de-duplicate results preserving order
  const seen = new Set();
  const out = [];
  for (const r of results) {
    if (!r || !r.url) continue;
    if (seen.has(r.url)) continue;
    seen.add(r.url);
    out.push(r);
    if (out.length >= (Number(limit) || 3)) break;
  }
  return out;
}

export { getSportradarImages };
export default { getSportradarImages };
