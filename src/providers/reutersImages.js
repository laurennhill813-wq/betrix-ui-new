// Reuters provider adapter that delegates to src/data/images-reuters.js
import * as reutersData from "../data/images-reuters.js";

export async function fetchReutersEventAssets(eventId) {
  try {
    if (reutersData && typeof reutersData.getReutersImages === "function") {
      const results = await reutersData
        .getReutersImages({ eventId }, 5)
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

export default { fetchReutersEventAssets };
