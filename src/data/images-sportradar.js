import axios from 'axios';

const BASE = process.env.SPORTRADAR_BASE || 'https://api.sportradar.com';
const KEY = process.env.SPORTRADAR_API_KEY || process.env.IMAGE_SERVICE_KEY || null;

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
    const body = r.data || '';
    const links = extractLinksFromXml(body);
    return links.map(h => h.startsWith('http') ? h : `${BASE.replace(/\/+$/,'')}${h}`);
  } catch (e) {
    return [];
  }
}

// Simple Sportradar adapter: return a list of image candidate objects {url, source}
async function getSportradarImages(ev = {}, limit = 5) {
  if (!KEY) return [];
  const results = [];
  try {
    // 1) Country flags manifest
    const flagsManifest = `${BASE.replace(/\/+$/,'')}/flags-images-t3/sr/country-flags/flags/manifest.xml?api_key=${KEY}`;
    const flagLinks = await fetchManifestLinks(flagsManifest);
    for (const l of flagLinks.slice(0, limit)) results.push({ url: l, source: 'sportradar-flags' });

    // 2) Logos manifest for sport (try AP provider as common default)
    const sport = (ev.sport || 'soccer').toLowerCase();
    const logosManifest = `${BASE.replace(/\/+$/,'')}/${sport}-images-t3/ap/logos/manifest.xml?api_key=${KEY}`;
    const logoLinks = await fetchManifestLinks(logosManifest);
    for (const l of logoLinks.slice(0, limit)) results.push({ url: l, source: `sportradar-logos-${sport}` });

    // 3) Action shots (if event id or date present)
    if (ev && (ev.id || ev.date)) {
      const provider = ev.provider || 'getty';
      let manifest = null;
      if (ev.id) {
        manifest = `${BASE.replace(/\/+$/,'')}/${sport}-images-t3/${provider}/actionshots/events/game/${ev.id}/manifest.xml?api_key=${KEY}`;
      } else if (ev.date) {
        const d = new Date(ev.date);
        const yyyy = d.getUTCFullYear();
        const mm = String(d.getUTCMonth()+1).padStart(2,'0');
        const dd = String(d.getUTCDate()).padStart(2,'0');
        manifest = `${BASE.replace(/\/+$/,'')}/${sport}-images-t3/${provider}/actionshots/events/${yyyy}/${mm}/${dd}/manifest.xml?api_key=${KEY}`;
      }
      if (manifest) {
        const actLinks = await fetchManifestLinks(manifest);
        for (const l of actLinks.slice(0, limit)) results.push({ url: l, source: `sportradar-action-${provider}` });
      }
    }
  } catch (err) {
    import axios from 'axios';

    const BASE = process.env.SPORTRADAR_BASE || 'https://api.sportradar.com';
    const KEY = process.env.SPORTRADAR_API_KEY || process.env.IMAGE_SERVICE_KEY || null;

    // Simple in-process token-bucket rate limiter per-endpoint key
    const _buckets = new Map();
    function allowCall(key = 'default', ratePerSec = 1) {
      const now = Date.now() / 1000;
      let bucket = _buckets.get(key);
      if (!bucket) {
        bucket = { tokens: ratePerSec, last: now };
        _buckets.set(key, bucket);
      }
      const elapsed = Math.max(0, now - bucket.last);
      bucket.last = now;
      bucket.tokens = Math.min(ratePerSec, bucket.tokens + elapsed * ratePerSec);
      if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        return true;
      }
      return false;
    }

    // Sportradar adapter: returns up to `limit` image candidates (best-effort).
    // Adds lightweight rate-limiting (ratePerSec) to avoid exceeding trial QPS.
    async function getSportradarImages(ev = {}, { limit = 3, ratePerSec = 1 } = {}) {
      if (!KEY) return [];
      const results = [];
      try {
        // helper to attempt a manifest and push first found link
        async function tryManifest(manifestUrl, sourceTag) {
          if (!allowCall(manifestUrl, ratePerSec)) return;
          try {
            const r = await axios.get(manifestUrl, { timeout: 10_000 });
            const body = r.data || '';
            const matches = [...body.matchAll(/<link[^>]+href=["']([^"']+\.(?:jpg|jpeg|png|svg))["']/ig)];
            for (const m of matches) {
              if (!m || !m[1]) continue;
              const href = m[1].startsWith('http') ? m[1] : `${BASE.replace(/\/+$/,'')}${m[1]}`;
              results.push({ url: href, source: sourceTag });
              if (results.length >= limit) return;
            }
          } catch (e) {
            // ignore manifest errors
          }
        }

        // 1) Country flags manifest
        const flagsManifest = `${BASE.replace(/\/+$/,'')}/flags-images-t3/sr/country-flags/flags/manifest.xml?api_key=${KEY}`;
        await tryManifest(flagsManifest, 'sportradar-flags');
        if (results.length >= limit) return results;

        // 2) Logos manifest for a sport (if sport present)
        try {
          const sport = (ev.sport || 'soccer').toLowerCase();
          const logosManifest = `${BASE.replace(/\/+$/,'')}/${sport}-images-t3/ap/logos/manifest.xml?api_key=${KEY}`;
          await tryManifest(logosManifest, `sportradar-logos-${sport}`);
        } catch (e) {}
        if (results.length >= limit) return results;

        // 3) Action shots: prefer by event id, then by date
        try {
          const sport = (ev.sport || 'nba').toLowerCase();
          const provider = ev.provider || 'getty';
          let manifest;
          if (ev && ev.id) {
            manifest = `${BASE.replace(/\/+$/,'')}/${sport}-images-t3/${provider}/actionshots/events/game/${ev.id}/manifest.xml?api_key=${KEY}`;
            await tryManifest(manifest, `sportradar-action-${provider}`);
          }
          if (results.length < limit && ev && ev.date) {
            const d = new Date(ev.date);
            const yyyy = d.getUTCFullYear();
            const mm = String(d.getUTCMonth()+1).padStart(2,'0');
            const dd = String(d.getUTCDate()).padStart(2,'0');
            manifest = `${BASE.replace(/\/+$/,'')}/${sport}-images-t3/${provider}/actionshots/events/${yyyy}/${mm}/${dd}/manifest.xml?api_key=${KEY}`;
            await tryManifest(manifest, `sportradar-action-${provider}`);
          }
        } catch (e) { /* ignore */ }

      } catch (err) {
        // best-effort
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
