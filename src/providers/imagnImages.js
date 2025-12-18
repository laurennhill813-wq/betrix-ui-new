// Imagn adapter wrapper - best-effort skeleton
let imagnData = null;
try {
  imagnData = await import("../data/images-imagn.js");
} catch (_) {
  /* dynamic optional */
}

export async function fetchImagnEventAssets(eventId) {
  try {
    if (imagnData && typeof imagnData.getImagnImages === "function") {
      const results = await imagnData
        .getImagnImages({ eventId }, 5)
        .catch(() => []);
      const best = Array.isArray(results) && results.length ? results[0] : null;
      const bestUrl = (best && (best.url || best.imageUrl || best.src)) || null;
      return { eventId, bestUrl, raw: results };
    }
  } catch (e) {
    // ignore
  }
  return { eventId, bestUrl: null, raw: null };
}

export default { fetchImagnEventAssets };
