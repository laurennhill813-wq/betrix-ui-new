import resolveDirectImage from './resolveDirectImage.js';

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

export default { selectBestImageForEvent };
