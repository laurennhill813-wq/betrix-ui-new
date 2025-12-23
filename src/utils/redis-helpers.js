export async function ensureRedisKeyType(redis, key, expectedType = 'string') {
  if (!redis || !key) return true;
  try {
    if (typeof redis.type === 'function') {
      const t = await redis.type(key).catch(() => null);
      if (!t || t === 'none') return true;
      if (String(t) === String(expectedType)) return true;
      // For cache/ephemeral keys it's safe to remove mismatched types and recreate
      try {
        await redis.del(key).catch(() => null);
        console.warn(`[redis-helpers] deleted key=${key} of type=${t} to enforce expectedType=${expectedType}`);
        return true;
      } catch (e) {
        console.error('[redis-helpers] failed to delete key', key, e && e.message ? e.message : String(e));
        return false;
      }
    }
    // Fallback: attempt a GET and treat missing as ok
    if (typeof redis.get === 'function') {
      try {
        await redis.get(key).catch(() => null);
        return true;
      } catch (e) {
        return true;
      }
    }
    return true;
  } catch (e) {
    console.error('[redis-helpers] ensureRedisKeyType error', e && e.message ? e.message : String(e));
    return false;
  }
}

export default { ensureRedisKeyType };
