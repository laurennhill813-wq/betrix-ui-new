import resolveDirectImage from "./resolveDirectImage.js";
import ImageProvider from "../services/image-provider.js";

// Deterministic Sportradar asset selector: prefer original.jpg, then largest JPEG
export function selectBestSportradarAsset(assets = []) {
  if (!Array.isArray(assets) || assets.length === 0) return null;

  // Normalize to string URLs
  const cleaned = assets
    .map((a) =>
      typeof a === "string" ? a : a && (a.url || a.imageUrl || a.src || a.uri),
    )
    .filter(Boolean);

  // 1. Prefer exact original.jpg
  const original = cleaned.find(
    (url) => url.endsWith("/original.jpg") || url.includes("/original.jpg?"),
  );
  if (original) return original;

  // 2. Prefer largest JPEGs (exclude resized variants)
  const jpegCandidates = cleaned.filter(
    (url) =>
      url.toLowerCase().endsWith(".jpg") &&
      !url.includes("width=") &&
      !url.includes("/small/") &&
      !url.includes("/medium/") &&
      !url.includes("/large/"),
  );

  if (jpegCandidates.length > 0) {
    // Heuristic: longer path/filename often implies original / larger image
    return jpegCandidates.sort((a, b) => b.length - a.length)[0];
  }

  // 3. Avoid PNG flags unless absolutely nothing else exists
  const png = cleaned.find((url) => url.toLowerCase().endsWith(".png"));
  if (png) return png;

  // 4. Fallback to first available
  return cleaned[0] || null;
}
async function safeCall(fn, ...args) {
  try {
    if (!fn) return [];
    const out = await fn(...args);
    return Array.isArray(out) ? out : out ? [out] : [];
  } catch (e) {
    try {
      console.warn("imageSelector provider call failed", e?.message || e);
    } catch (_) {}
    return [];
  }
}

async function tryImport(modulePath) {
  try {
    // dynamic import - may fail in some environments; catch and return null
    const mod = await import(modulePath).catch(() => null);
    return mod || null;
  } catch (e) {
    return null;
  }
}

export async function selectBestImageForEvent(sportEvent = {}) {
  const candidates = [];

  // Try provider modules if they exist; each should return array of {url, source}
  const reuters = await tryImport("../data/images-reuters.js");
  if (reuters && typeof reuters.getReutersImages === "function") {
    candidates.push(...(await safeCall(reuters.getReutersImages, sportEvent)));
  }

  const getty = await tryImport("../data/images-getty.js");
  if (getty && typeof getty.getGettyImages === "function") {
    candidates.push(...(await safeCall(getty.getGettyImages, sportEvent)));
  }

  const ap = await tryImport("../data/images-ap.js");
  if (ap && typeof ap.getApImages === "function") {
    candidates.push(...(await safeCall(ap.getApImages, sportEvent)));
  }

  const imagn = await tryImport("../data/images-imagn.js");
  if (imagn && typeof imagn.getImagnImages === "function") {
    candidates.push(...(await safeCall(imagn.getImagnImages, sportEvent)));
  }

  // Sportradar adapter (trial/pro accounts with image collections)
  const sportradar = await tryImport("../data/images-sportradar.js");
  if (sportradar && typeof sportradar.getSportradarImages === "function") {
    candidates.push(
      ...(await safeCall(sportradar.getSportradarImages, sportEvent)),
    );
  }

  // Sportradar flag fallback
  const flags = await tryImport("../data/images-flags.js");
  if (flags && typeof flags.getSportradarFlag === "function") {
    const f = await safeCall(flags.getSportradarFlag, sportEvent);
    if (f && f.length)
      candidates.push(...f.map((u) => ({ url: u, source: "sportradar-flag" })));
  }

  // Prefer raster images first (jpg/png), then fall back to SVGs or others
  const rasterExtRe = /\.(jpe?g|png|gif)($|\?)/i;
  // If configured, deprioritize Sportradar candidates (they may require provider-side access).
  const sportradarAllow =
    String(process.env.SPORTRADAR_ALLOW || "false").toLowerCase() === "true";
  if (!sportradarAllow) {
    const preferred = [];
    const spor = [];
    for (const c of candidates) {
      const url = (c && (c.url || c.imageUrl || c.src || c.uri)) || "";
      if (
        String(c.source || url)
          .toLowerCase()
          .includes("sportradar") ||
        url.toLowerCase().includes("sportradar")
      ) {
        spor.push(c);
      } else {
        preferred.push(c);
      }
    }
    candidates.length = 0;
    candidates.push(...preferred, ...spor);
  }
  // Try raster candidates first
  // If there are Sportradar candidates, select deterministically first so we avoid
  // picking small/resized variants that cause 403s when fetched server-side.
  try {
    const sporCandidates = candidates.filter((c) => {
      const url = String(
        (c && (c.url || c.imageUrl || c.src || c.uri)) || "",
      ).toLowerCase();
      return (
        url.includes("sportradar") ||
        String(c.source || "")
          .toLowerCase()
          .includes("sportradar")
      );
    });
    if (sporCandidates && sporCandidates.length) {
      const urls = sporCandidates
        .map((c) => (c && (c.url || c.imageUrl || c.src || c.uri)) || "")
        .filter(Boolean);
      const selected = selectBestSportradarAsset(urls);
      if (selected) {
        const resolved = await resolveDirectImage(selected).catch(() => null);
        if (resolved)
          return { imageUrl: resolved, source: "sportradar", rawUrl: selected };
      }
    }
  } catch (e) {
    // ignore and fall back to normal raster iteration below
  }

  for (const cand of candidates) {
    try {
      const url = cand && (cand.url || cand.imageUrl || cand.src || cand.uri);
      if (!url) continue;
      if (!rasterExtRe.test(url)) continue;
      const resolved = await resolveDirectImage(url).catch(() => null);
      if (resolved)
        return {
          imageUrl: resolved,
          source: cand.source || "provider",
          rawUrl: url,
        };
    } catch (e) {
      /* continue */
    }
  }
  // Then try non-raster candidates (SVGs, etc.)
  for (const cand of candidates) {
    try {
      const url = cand && (cand.url || cand.imageUrl || cand.src || cand.uri);
      if (!url) continue;
      if (rasterExtRe.test(url)) continue; // already tried
      const resolved = await resolveDirectImage(url).catch(() => null);
      if (resolved)
        return {
          imageUrl: resolved,
          source: cand.source || "provider",
          rawUrl: url,
        };
    } catch (e) {
      /* continue */
    }
  }

  return null;
}

// If no providers returned candidates, try the generic ImageProvider configured via
// `IMAGE_SERVICE_BASE` / `IMAGE_SERVICE_KEY` env vars (Render secrets). This helps
// when a paid image subscription (Getty/Imagn/Reuters/etc.) is available via the
// generic provider endpoint.
export async function selectBestImageForEventFallback(sportEvent = {}) {
  try {
    if (!ImageProvider || typeof ImageProvider.findImage !== "function")
      return null;
    const q =
      `${sportEvent.home || ""} ${sportEvent.away || ""} ${sportEvent.league || ""}`.trim() ||
      "sports";
    const found = await ImageProvider.findImage({ q, limit: 1 });
    if (found) {
      const resolved = await resolveDirectImage(found).catch(() => null);
      if (resolved)
        return { imageUrl: resolved, source: "image-provider", rawUrl: found };
    }
  } catch (e) {
    /* ignore */
  }
  return null;
}

// Wikimedia fallback: try to find a pageimage for team/country names when ImageProvider is not configured.
async function wikiImageForName(name) {
  if (!name) return null;
  try {
    const titles = [name, `${name} F.C.`, `${name} FC`, `${name} Football Club`]
      .map(encodeURIComponent)
      .join("|");
    const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&piprop=original&titles=${titles}`;
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.query || !data.query.pages) return null;
    for (const pid of Object.keys(data.query.pages)) {
      const p = data.query.pages[pid];
      if (p && p.original && p.original.source) return p.original.source;
    }
  } catch (e) {
    // ignore
  }
  return null;
}

// Extend fallback to try Wikimedia when ImageProvider is not available or returns nothing
// Skip Wikimedia SVGs (they fail with Telegram) unless absolutely necessary
export async function selectBestImageForEventFallbackExtended(sportEvent = {}) {
  const direct = await selectBestImageForEventFallback(sportEvent).catch(
    () => null,
  );
  if (direct) return direct;
  // Try home team, away team, league for Wikimedia images
  // BUT: deprioritize SVGs as Telegram cannot fetch them directly
  const names = [sportEvent.home, sportEvent.away, sportEvent.league].filter(
    Boolean,
  );
  for (const n of names) {
    const w = await wikiImageForName(n);
    if (w) {
      // Skip SVG URLs (Telegram 400 error) unless it's the only option
      if (String(w || "").toLowerCase().includes(".svg")) {
        console.info("[imageSelector] Skipping SVG URL from Wikimedia:", w);
        continue;
      }
      const resolved = await resolveDirectImage(w).catch(() => null);
      if (resolved)
        return { imageUrl: resolved, source: "wikipedia", rawUrl: w };
    }
  }
  return null;
}

export default { selectBestImageForEvent };

// Export a combined selector that will try provider modules first and then
// the generic ImageProvider fallback when available.
export async function selectBestImageForEventCombined(ev) {
  // Parallel fetch: try both sources simultaneously for speed
  const [fallbackImg, providerImg] = await Promise.all([
    selectBestImageForEventFallbackExtended(ev).catch(() => null),
    selectBestImageForEvent(ev).catch(() => null),
  ]);
  
  // Prefer public raster (ImageProvider/Wikipedia) but only if not SVG
  // Otherwise use provider modules
  if (fallbackImg) return fallbackImg;
  if (providerImg) return providerImg;
  return null;
}

// Backwards-compat alias used by other modules: try extended fallback first (ImageProvider/Wikipedia)
export async function selectBestImageForEventCombinedExtended(ev) {
  const ext = await selectBestImageForEventFallbackExtended(ev).catch(
    () => null,
  );
  if (ext) return ext;
  return await selectBestImageForEventCombined(ev).catch(() => null);
}
