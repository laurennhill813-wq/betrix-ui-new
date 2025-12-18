import { incrWithTTL, getRaw } from "../lib/redis-cache.js";

// Event mention counters used to compute short-term velocity/trending
// Each bump increments a counter with a short TTL so counts decay automatically.
const DEFAULT_TTL = Number(process.env.BETRIX_TREND_TTL_SECONDS || 15 * 60); // 15 minutes

export async function bumpEventMention(eventId, ttlSeconds = DEFAULT_TTL) {
  if (!eventId) return 0;
  try {
    const key = `betrix:mentions:${eventId}`;
    const val = await incrWithTTL(key, ttlSeconds);
    return Number(val || 0);
  } catch (e) {
    return 0;
  }
}

export async function getEventVelocity(eventId) {
  if (!eventId) return 0;
  try {
    const key = `betrix:mentions:${eventId}`;
    const raw = await getRaw(key);
    return raw ? Number(raw) : 0;
  } catch (e) {
    return 0;
  }
}

export default { bumpEventMention, getEventVelocity };
