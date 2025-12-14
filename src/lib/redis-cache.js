import { createClient } from 'redis';

let client = null;
let fallbackStore = new Map();

function getClient() {
  if (client) return client;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  client = createClient({ url });
  client.on('error', () => {
    // swallow errors; fall back to in-memory
  });
  try {
    // connect lazily
    client.connect().catch(()=>{});
  } catch (e) {}
  return client;
}

export async function cacheGet(key) {
  const c = getClient();
  if (!c) {
    const raw = fallbackStore.get(key);
    return raw === undefined ? null : raw;
  }
  try {
    const v = await c.get(key);
    if (!v) return null;
    return JSON.parse(v);
  } catch (e) {
    // on error fall back
    const raw = fallbackStore.get(key);
    return raw === undefined ? null : raw;
  }
}

export async function cacheSet(key, value, ttlSeconds = 60) {
  const c = getClient();
  const raw = JSON.stringify(value);
  if (!c) {
    try {
      fallbackStore.set(key, value);
      return true;
    } catch (e) { return false; }
  }
  try {
    if (ttlSeconds && ttlSeconds > 0) {
      await c.setEx(key, ttlSeconds, raw);
    } else {
      await c.set(key, raw);
    }
    return true;
  } catch (e) {
    // fall back
    fallbackStore.set(key, value);
    return false;
  }
}

export async function cacheDel(key) {
  const c = getClient();
  if (!c) return fallbackStore.delete(key);
  try { await c.del(key); return true; } catch (e) { return false; }
}

export function _clearFallback() { fallbackStore = new Map(); }
