// Minimal AP Images adapter (stubbed)
// Uses existing `src/data/images-ap.js` if available, otherwise returns a placeholder.
import * as apData from '../data/images-ap.js';

export async function fetchApEventAssets(eventId) {
  // Try to call data layer if present
  try {
    if (apData && typeof apData.getApImages === 'function') {
      const results = await apData.getApImages({ eventId }, 5).catch(() => []);
      const best = Array.isArray(results) && results.length ? results[0] : null;
      const bestUrl = best && (best.url || best.imageUrl || best.src) || null;
      return { eventId, bestUrl, raw: results };
    }
  } catch (e) {
    // ignore
  }
  return { eventId, bestUrl: null, raw: null };
}

export default { fetchApEventAssets };
