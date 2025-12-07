import Redis from 'ioredis';

let _instance = null;

// Fuse configuration: if Redis emits many writeable-stream errors in a short
// window, flip to an in-memory MockRedis to protect request handlers from
// raising immediate errors during provider flaps.
let _errorCount = 0;
let _firstErrorTs = 0;
let _fuseTriggered = false;
const ERROR_THRESHOLD = 10; // number of errors
const ERROR_WINDOW_MS = 60_000; // window in ms
// Reconnect churn fuse: if Redis is reconnecting too frequently, flip to MockRedis
let _reconnectCount = 0;
let _firstReconnectTs = 0;
const RECONNECT_THRESHOLD = 20; // reconnect events
const RECONNECT_WINDOW_MS = 60_000; // window in ms

class MockRedis {
  constructor() {
    this.kv = new Map();
    this.zsets = new Map();
  }

  async get(key) { return this.kv.has(key) ? this.kv.get(key) : null; }
  async set(key, value) { this.kv.set(key, value); return 'OK'; }
  async del(key) { this.kv.delete(key); return 1; }

  // Hash helpers to emulate Redis hashes used by the app (hset/hgetall/hget/hdel)
  async hset(key, ...args) {
    // Support: hset(key, object) OR hset(key, field, value) OR hset(key, field1, val1, field2, val2...)
    const table = this.kv.get(key) || new Map();
    let setCount = 0;
    if (args.length === 1 && typeof args[0] === 'object') {
      const obj = args[0];
      for (const [f, v] of Object.entries(obj)) {
        table.set(String(f), String(v));
        setCount++;
      }
    } else if (args.length === 2) {
      table.set(String(args[0]), String(args[1]));
      setCount = 1;
    } else if (args.length > 1 && args.length % 2 === 0) {
      for (let i = 0; i < args.length; i += 2) {
        table.set(String(args[i]), String(args[i + 1]));
        setCount++;
      }
    }
    this.kv.set(key, table);
    return setCount;
  }

  async hgetall(key) {
    const table = this.kv.get(key) || new Map();
    const out = {};
    for (const [k, v] of table.entries()) out[k] = v;
    return out;
  }

  async hget(key, field) {
    const table = this.kv.get(key) || new Map();
    return table.has(String(field)) ? table.get(String(field)) : null;
  }

  async hdel(key, field) {
    const table = this.kv.get(key) || new Map();
    const existed = table.delete(String(field));
    this.kv.set(key, table);
    return existed ? 1 : 0;
  }

  async lpop(key) {
    const arr = this.kv.get(key) || [];
    const v = arr.shift();
    this.kv.set(key, arr);
    return v || null;
  }

  async rpush(key, value) {
    const arr = this.kv.get(key) || [];
    arr.push(value);
    this.kv.set(key, arr);
    return arr.length;
  }

  async lrange(key, start, stop) {
    const arr = this.kv.get(key) || [];
    return arr.slice(start, stop + 1);
  }

  async zadd(key, score, member) {
    const set = this.zsets.get(key) || new Map();
    set.set(String(member), Number(score));
    this.zsets.set(key, set);
    return 1;
  }

  async zincrby(key, inc, member) {
    const set = this.zsets.get(key) || new Map();
    const cur = Number(set.get(String(member)) || 0);
    const next = cur + Number(inc);
    set.set(String(member), next);
    this.zsets.set(key, set);
    return next;
  }

  async zrevrange(key, start, stop, withscores) {
    const set = this.zsets.get(key) || new Map();
    const items = Array.from(set.entries()).map(([member, score]) => ({ member, score }));
    items.sort((a, b) => b.score - a.score);
    const slice = items.slice(start, stop === -1 ? undefined : stop + 1);
    if (withscores === 'WITHSCORES') {
      const out = [];
      for (const it of slice) { out.push(it.member, String(it.score)); }
      return out;
    }
    return slice.map(i => i.member);
  }

  async zcard(key) {
    const set = this.zsets.get(key) || new Map();
    return set.size;
  }

  async zrange(key, start, stop) {
    const set = this.zsets.get(key) || new Map();
    const items = Array.from(set.entries()).map(([member, score]) => ({ member, score }));
    items.sort((a, b) => a.score - b.score);
    const slice = items.slice(start, stop === -1 ? undefined : stop + 1);
    return slice.map(i => i.member);
  }

  async incr(key) {
    const cur = Number(this.kv.get(key) || 0) + 1;
    this.kv.set(key, String(cur));
    return cur;
  }

  async setex(key, seconds, value) {
    this.kv.set(key, value);
    return 'OK';
  }

  async ping() { return 'PONG'; }

  // Provide expiry semantics used by worker (best-effort; no real timer eviction)
  async expire(key, _seconds) {
    // noop for in-memory mock; return 1 to indicate key exists/was set for TTL
    return this.kv.has(key) ? 1 : 0;
  }

  async ttl(_key) {
    // no TTL tracking in this simple mock
    return -1;
  }

  // Pop from (right) source and push to left of destination (non-blocking)
  async rpoplpush(source, dest) {
    const src = this.kv.get(source) || [];
    if (!src.length) return null;
    const v = src.pop();
    this.kv.set(source, src);
    const dst = this.kv.get(dest) || [];
    dst.unshift(v);
    this.kv.set(dest, dst);
    return v;
  }

  // Blocking variant used in worker; here we implement a non-blocking best-effort
  // signature: brpoplpush(source, dest, timeoutSeconds)
  async brpoplpush(source, dest, timeoutSeconds = 0) {
    // Try immediate rpoplpush; if nothing, wait up to timeout in 100ms intervals
    const attempt = () => {
      const src = this.kv.get(source) || [];
      if (src.length) {
        const v = src.pop();
        this.kv.set(source, src);
        const dst = this.kv.get(dest) || [];
        dst.unshift(v);
        this.kv.set(dest, dst);
        return v;
      }
      return null;
    };

    let elapsed = 0;
    const interval = 100;
    const max = Math.max(0, Number(timeoutSeconds) * 1000);
    let res = attempt();
    while (res === null && elapsed < max) {
      // sleep synchronously via Promise
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, interval));
      elapsed += interval;
      res = attempt();
    }
    return res;
  }

  // Pub/sub noop: return 0 subscribers
  async publish(_channel, _message) {
    // No real pub/sub in mock — noop
    return 0;
  }

}

export function getRedis(opts = {}) {
  if (_instance) return _instance;

  const redisUrl = process.env.REDIS_URL;
  const useMock = process.env.USE_MOCK_REDIS === '1' || !redisUrl;
  
  if (useMock) {
    console.log('[redis-factory] ⚠️  Using MockRedis (no REDIS_URL or USE_MOCK_REDIS=1)');
    _instance = new MockRedis();
    return _instance;
  }

  // Parse Redis URL for logging (safe, never logs password)
  try {
    const url = new URL(redisUrl);
    console.log(`[redis-factory] 🔗 Connecting to Redis: ${url.protocol}//${url.hostname}:${url.port} (${url.pathname})`);
  } catch (e) {
    console.log('[redis-factory] 🔗 Connecting to Redis with provided URL');
  }

  // Create ioredis instance with proper configuration
  // Track last log time so reconnect spam is throttled
  let _lastReconnectLog = 0;
  const throttleMs = 30 * 1000; // at most one reconnect log every 30s

  _instance = new Redis(redisUrl, {
    // Connection options
    connectTimeout: 10000,
    // Re-enable offline queue so transient blips are buffered instead of
    // surfacing immediate `Stream isn't writeable` errors to request handlers.
    enableOfflineQueue: true,
    enableReadyCheck: true,
    lazyConnect: false,
    // Allow ioredis to manage retries per request (null = default behavior)
    maxRetriesPerRequest: null,

    // Merge with provided options
    ...(opts || {}),

    // Improved retry strategy: exponential backoff with cap + jitter
    retryStrategy: opts.retryStrategy || ((times) => {
      const base = 100;
      const exp = Math.min(Math.pow(2, Math.min(times, 10)) * base, 5000);
      const jitter = Math.floor(Math.random() * 300);
      const delay = Math.min(exp + jitter, 5000);

      const now = Date.now();
      if (now - _lastReconnectLog > throttleMs) {
        if (times === 1) {
          console.log('[redis-factory] 🔄 Redis connection failed, attempting reconnect...');
        }
        console.log(`[redis-factory] 🔄 Retry attempt ${times}, waiting ${delay}ms (throttled logs)`);
        _lastReconnectLog = now;
      }

      return delay;
    })
  });

  // Connection event handlers
  _instance.on('error', (err) => {
    const msg = err && err.message ? err.message : String(err);
    if (msg.includes('NOAUTH')) {
      console.error('[redis-factory] ❌ NOAUTH: Invalid Redis password/auth');
    } else if (msg.includes('ECONNREFUSED')) {
      console.error('[redis-factory] ❌ ECONNREFUSED: Cannot connect to Redis host');
    } else if (msg.includes('ETIMEDOUT')) {
      console.error('[redis-factory] ❌ ETIMEDOUT: Redis connection timeout');
    } else {
      console.error(`[redis-factory] ❌ Redis error: ${msg}`);
    }

    // Fuse counting: track writeable-stream-like errors and flip to MockRedis
    try {
      const now = Date.now();
      if (!_firstErrorTs || now - _firstErrorTs > ERROR_WINDOW_MS) {
        _firstErrorTs = now;
        _errorCount = 0;
      }
      _errorCount++;

      // Only trigger the fuse once to avoid flip-flopping
      if (!_fuseTriggered && _errorCount >= ERROR_THRESHOLD && /writeable/i.test(msg)) {
        _fuseTriggered = true;
        console.error('[redis-factory] 🔥 Redis fuse triggered: switching to MockRedis to protect handlers');
        try {
          // gracefully disconnect the old client
          if (_instance && typeof _instance.disconnect === 'function') {
            _instance.disconnect();
          } else if (_instance && typeof _instance.quit === 'function') {
            _instance.quit();
          }
        } catch (e) {
          // ignore errors from trying to disconnect
        }

        _instance = new MockRedis();
      }
    } catch (countErr) {
      console.error('[redis-factory] ❌ Error while evaluating Redis fuse:', countErr);
    }
  });

  _instance.on('connect', () => {
    console.log('[redis-factory] ✅ Connected to Redis successfully');
  });

  _instance.on('ready', () => {
    console.log('[redis-factory] ✅ Redis client is ready for operations');
  });

  _instance.on('reconnecting', () => {
    console.log('[redis-factory] 🔄 Redis reconnecting...');
    try {
      const now = Date.now();
      if (!_firstReconnectTs || now - _firstReconnectTs > RECONNECT_WINDOW_MS) {
        _firstReconnectTs = now;
        _reconnectCount = 0;
      }
      _reconnectCount++;
      if (!_fuseTriggered && _reconnectCount >= RECONNECT_THRESHOLD) {
        _fuseTriggered = true;
        console.error('[redis-factory] 🔥 Reconnect churn fuse triggered: switching to MockRedis to protect handlers');
        try {
          if (_instance && typeof _instance.disconnect === 'function') _instance.disconnect();
          else if (_instance && typeof _instance.quit === 'function') _instance.quit();
        } catch (e) { /* ignore */ }
        _instance = new MockRedis();
      }
    } catch (e) { console.error('[redis-factory] Error evaluating reconnect fuse', e); }
  });

  _instance.on('end', () => {
    console.log('[redis-factory] ⚠️  Redis connection ended');
  });


  return _instance;
}

// Export MockRedis so callers can explicitly create an in-memory fallback
export { MockRedis };
