import resolveDirectImage from './resolveDirectImage.js';
import ImageProvider from '../services/image-provider.js';

async function safeCall(fn, ...args) {
  try {
    if (!fn) return [];
    const out = await fn(...args);
    return Array.isArray(out) ? out : (out ? [out] : []);
  } catch (e) {
    try { console.warn('imageSelector provider call failed', e?.message || e); } catch(_){}
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
  const reuters = await tryImport('../data/images-reuters.js');
  if (reuters && typeof reuters.getReutersImages === 'function') {
    candidates.push(...(await safeCall(reuters.getReutersImages, sportEvent)));
  }

  const getty = await tryImport('../data/images-getty.js');
  if (getty && typeof getty.getGettyImages === 'function') {
    candidates.push(...(await safeCall(getty.getGettyImages, sportEvent)));
  }

  const ap = await tryImport('../data/images-ap.js');
  if (ap && typeof ap.getApImages === 'function') {
    candidates.push(...(await safeCall(ap.getApImages, sportEvent)));
  }

  const imagn = await tryImport('../data/images-imagn.js');
  if (imagn && typeof imagn.getImagnImages === 'function') {
    candidates.push(...(await safeCall(imagn.getImagnImages, sportEvent)));
  }

  // Sportradar adapter (trial/pro accounts with image collections)
  const sportradar = await tryImport('../data/images-sportradar.js');
  if (sportradar && typeof sportradar.getSportradarImages === 'function') {
    candidates.push(...(await safeCall(sportradar.getSportradarImages, sportEvent)));
  }

  // Sportradar flag fallback
  const flags = await tryImport('../data/images-flags.js');
  if (flags && typeof flags.getSportradarFlag === 'function') {
    const f = await safeCall(flags.getSportradarFlag, sportEvent);
    if (f && f.length) candidates.push(...f.map(u => ({ url: u, source: 'sportradar-flag' })));
  }

  // Finally, try any candidate resolved to a direct image
  for (const cand of candidates) {
    try {
      const url = cand && (cand.url || cand.imageUrl || cand.src || cand.uri);
      if (!url) continue;
      const resolved = await resolveDirectImage(url).catch(() => null);
      if (resolved) return { imageUrl: resolved, source: cand.source || 'provider', rawUrl: url };
    } catch (e) { /* continue */ }
  }

  return null;
}

// If no providers returned candidates, try the generic ImageProvider configured via
// `IMAGE_SERVICE_BASE` / `IMAGE_SERVICE_KEY` env vars (Render secrets). This helps
// when a paid image subscription (Getty/Imagn/Reuters/etc.) is available via the
// generic provider endpoint.
export async function selectBestImageForEventFallback(sportEvent = {}) {
  try {
    if (!ImageProvider || typeof ImageProvider.findImage !== 'function') return null;
    const q = `${sportEvent.home || ''} ${sportEvent.away || ''} ${sportEvent.league || ''}`.trim() || 'sports';
    const found = await ImageProvider.findImage({ q, limit: 1 });
    if (found) {
      const resolved = await resolveDirectImage(found).catch(() => null);
      if (resolved) return { imageUrl: resolved, source: 'image-provider', rawUrl: found };
    }
  } catch (e) {
    /* ignore */
  }
  return null;
}

export default { selectBestImageForEvent };

// Export a combined selector that will try provider modules first and then
// the generic ImageProvider fallback when available.
export async function selectBestImageForEventCombined(ev) {
  const primary = await selectBestImageForEvent(ev).catch(() => null);
  if (primary) return primary;
  return await selectBestImageForEventFallback(ev).catch(() => null);
}
