export async function ensureFetch() {
  if (typeof globalThis.fetch === "function") return globalThis.fetch;
  try {
    const mod = await import("node-fetch");
    // node-fetch v3 exports default
    const f = mod.default || mod;
    globalThis.fetch = f;
    return globalThis.fetch;
  } catch (e) {
    // If node-fetch not available, throw with informative message
    throw new Error("fetch is not available and node-fetch could not be loaded: " + (e && e.message ? e.message : e));
  }
}

export function getFetch() {
  if (typeof globalThis.fetch === "function") return globalThis.fetch;
  throw new Error("fetch is not initialized; call ensureFetch() first");
}
