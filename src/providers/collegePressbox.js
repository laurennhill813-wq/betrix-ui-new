// College Pressbox adapter skeleton
let cpData = null;
try {
  cpData = await import("../data/images-collegepressbox.js");
} catch (_) {
  /* optional */
}

export async function fetchCollegePressboxAssets(eventId) {
  try {
    if (cpData && typeof cpData.getCollegePressboxImages === "function") {
      const results = await cpData
        .getCollegePressboxImages({ eventId }, 5)
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

export default { fetchCollegePressboxAssets };
