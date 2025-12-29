import { cacheGet, cacheSet, incrWithTTL, getRaw } from "./redis-cache.js";

// Set to 0 for disabled (allow unlimited), or set minimum minutes between posts
// For 1-minute interval posting, set MIN_MINUTES to 0 (disabled)
const MIN_MINUTES = Number(process.env.MIN_MINUTES_BETWEEN_POSTS || 0);
const MAX_PER_HOUR = Number(process.env.MAX_POSTS_PER_HOUR || 999);

function hourKey() {
  const d = new Date();
  return `liveliness:postsHour:${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}:${String(d.getUTCHours()).padStart(2, "0")}`;
}

export async function canPostNow() {
  try {
    const lastRaw = await cacheGet("liveliness:lastPostAt");
    const last = lastRaw ? Number(lastRaw) : 0;
    const now = Date.now();
    const minutesSince = (now - last) / 60000;
    if (minutesSince < MIN_MINUTES) return false;

    const hk = hourKey();
    const countRaw = await getRaw(hk);
    const count = countRaw ? Number(countRaw) : 0;
    if (count >= MAX_PER_HOUR) return false;

    return true;
  } catch (e) {
    // On error, be conservative and allow posting (fallback to in-memory elsewhere)
    return true;
  }
}

export async function markPosted() {
  try {
    const now = Date.now();
    await cacheSet("liveliness:lastPostAt", String(now), 60 * 60 * 24); // keep for a day
    const hk = hourKey();
    // increment hourly counter and set TTL to 2 hours to cover timezone drift
    await incrWithTTL(hk, 60 * 60 * 2);
  } catch (e) {
    // best-effort
  }
}

export default { canPostNow, markPosted };

export async function getMetrics() {
  try {
    const lastRaw = await cacheGet("liveliness:lastPostAt");
    const last = lastRaw ? Number(lastRaw) : null;
    // derive hour key similar to markPosted
    const d = new Date();
    const hk = `liveliness:postsHour:${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}:${String(d.getUTCHours()).padStart(2, "0")}`;
    const countRaw = await getRaw(hk);
    const count = countRaw ? Number(countRaw) : 0;
    return { lastPostAt: last, postsThisHour: count };
  } catch (e) {
    return { lastPostAt: null, postsThisHour: null };
  }
}
