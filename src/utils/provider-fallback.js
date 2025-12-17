import logger from './logger.js';

// Try an array of provider call functions in sequence until one succeeds.
// Each provider is an async function that returns { ok: true, result } or throws.
export async function tryProviders(providers = [], timeoutMs = 10000) {
  for (const prov of providers) {
    try {
      const p = prov();
      const res = typeof p.then === 'function' ? await p : p;
      if (res && (res.ok || res !== null)) return { success: true, data: res };
    } catch (err) {
      logger.warn('Provider failed, trying next', err?.message || String(err));
      continue;
    }
  }
  return { success: false, error: 'All providers failed' };
}

export default { tryProviders };
