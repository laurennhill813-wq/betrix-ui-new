import { cacheGet, cacheSet } from "../lib/redis-cache.js";

// Memory helpers for posted events to avoid duplicates
const POSTED_TTL_SECONDS = Number(
  process.env.BETRIX_POSTED_TTL_SECONDS || 60 * 60 * 24,
); // 24 hours

export async function hasPostedEvent(eventId) {
  if (!eventId) return false;
  try {
    const key = `betrix:posted:${eventId}`;
    const v = await cacheGet(key);
    return !!v;
  } catch (e) {
    return false;
  }
}

export async function markEventPosted(eventId, meta = {}) {
  if (!eventId) return false;
  try {
    const key = `betrix:posted:${eventId}`;
    await cacheSet(key, { postedAt: Date.now(), meta }, POSTED_TTL_SECONDS);
    return true;
  } catch (e) {
    return false;
  }
}

// Build a stable event id when provider id not provided
export function buildEventId(event = {}) {
  try {
    if (!event) return null;
    if (event.id) return String(event.id);
    if (event.raw && event.raw.id) return String(event.raw.id);
    // fallback: hash of sport+home+away+time
    const s =
      String(event.sport || "") +
      "|" +
      String(event.home || "") +
      "|" +
      String(event.away || "") +
      "|" +
      String(event.time || "");
    // simple stable base64-ish id
    let b = Buffer.from(s).toString("base64");
    // trim padding
    b = b.replace(/=+$/, "");
    return b;
  } catch (e) {
    return null;
  }
}

export default { hasPostedEvent, markEventPosted, buildEventId };
