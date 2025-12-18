// Getty adapter wrapper that delegates to src/data/images-getty.js if present
import * as gettyData from "../data/images-getty.js";

export async function fetchGettyEventAssets(eventId) {
  try {
    if (gettyData && typeof gettyData.getGettyImages === "function") {
      const results = await gettyData
        .getGettyImages({ eventId }, 5)
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

export default { fetchGettyEventAssets };
