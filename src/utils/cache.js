// Simple in-memory cache with TTL. Use for small ephemeral caches.
const store = new Map();

function setCache(key, value, ttlMs = 60 * 1000) {
  const expires = Date.now() + ttlMs;
  store.set(key, { value, expires });
}

function getCache(key) {
  const rec = store.get(key);
  if (!rec) return null;
  if (rec.expires < Date.now()) { store.delete(key); return null; }
  return rec.value;
}

function delCache(key) { store.delete(key); }

function clearCache() { store.clear(); }

export { setCache, getCache, delCache, clearCache };
/**
 * Redis cache service
 */

import { Logger } from "./logger.js";

const logger = new Logger("Cache");

class CacheService {
  constructor(redis) {
    this.redis = redis;
  }

  /**
   * Get value from cache
   */
  async get(key) {
    try {
      const data = await this.redis.get(key);
      if (!data) return null;
      return JSON.parse(data);
    } catch (err) {
      logger.warn(`Cache miss for ${key}`, err.message);
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set(key, value, ttlSeconds) {
    try {
      const ttl = Math.max(10, ttlSeconds);
      await this.redis.set(key, JSON.stringify(value), "EX", ttl);
    } catch (err) {
      logger.warn(`Cache set failed for ${key}`, err.message);
    }
  }

  /**
   * Delete from cache
   */
  async delete(key) {
    try {
      await this.redis.del(key);
    } catch (err) {
      logger.warn(`Cache delete failed for ${key}`, err.message);
    }
  }

  /**
   * Clear all cache (be careful!)
   */
  async clear() {
    try {
      await this.redis.flushdb();
    } catch (err) {
      logger.error("Cache clear failed", err);
    }
  }
}

export { CacheService };
