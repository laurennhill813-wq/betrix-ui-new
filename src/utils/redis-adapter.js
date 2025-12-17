import logger from './logger.js';

function createRedisAdapter(redis) {
  if (!redis) {
    logger.warn('No redis provided to adapter; falling back to in-memory store');
    const mem = new Map();
    return {
      async get(k) { return mem.get(k) || null; },
      async set(k, v) { mem.set(k, v); return 'OK'; },
      async del(k) { mem.delete(k); return 1; },
      async hgetall(k) { try { const v = mem.get(k); return v ? JSON.parse(v) : {}; } catch (e) { return {}; } },
      async hset(k, obj) { mem.set(k, JSON.stringify(obj)); return Object.keys(obj).length; },
      async sadd(k, v) { const s = new Set(JSON.parse(mem.get(k) || '[]')); s.add(v); mem.set(k, JSON.stringify([...s])); return 1; },
      async srem(k, v) { const s = new Set(JSON.parse(mem.get(k) || '[]')); s.delete(v); mem.set(k, JSON.stringify([...s])); return 1; },
      async smembers(k) { return JSON.parse(mem.get(k) || '[]'); },
      async setex(k, ttl, v) { mem.set(k, v); return 'OK'; },
      async expire(k, ttl) { return 1; },
      async incr(k) { const v = Number(mem.get(k) || 0) + 1; mem.set(k, String(v)); return v; },
      async lpush(k, v) { const arr = JSON.parse(mem.get(k) || '[]'); arr.unshift(v); mem.set(k, JSON.stringify(arr)); return arr.length; },
        async lpop(k) { const arr = JSON.parse(mem.get(k) || '[]'); const v = arr.shift(); mem.set(k, JSON.stringify(arr)); return v === undefined ? null : v; },
        async ltrim(k, start, stop) { return 'OK'; },
        async rpush(k, v) { const arr = JSON.parse(mem.get(k) || '[]'); arr.push(v); mem.set(k, JSON.stringify(arr)); return arr.length; },
        async rPush(k, v) { const arr = JSON.parse(mem.get(k) || '[]'); arr.push(v); mem.set(k, JSON.stringify(arr)); return arr.length; },
        async keys(pattern) { try { const all = [...mem.keys()]; if (!pattern || pattern === '*') return all; const re = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$'); return all.filter(k => re.test(k)); } catch (e) { return []; } },
        async ttl(k) { return -1; }
    };
  }

  // If redis client uses node-redis, adapt common methods
  return {
    get: (k) => redis.get(k),
    set: (k, v) => redis.set(k, v),
    del: (k) => redis.del(k),
      type: (k) => (redis.type ? redis.type(k) : (async () => 'string')()),
      ping: () => (redis.ping ? redis.ping() : Promise.resolve('PONG')),
    hgetall: (k) => redis.hGetAll ? redis.hGetAll(k) : (async () => {
      const raw = await redis.get(k); return raw ? JSON.parse(raw) : {};
    })(),
    hset: (k, obj) => (redis.hSet ? redis.hSet(k, obj) : redis.set(k, JSON.stringify(obj))),
      zadd: async (k, score, member) => {
        if (redis.zAdd) return redis.zAdd(k, { score, value: member });
        if (redis.zadd) return redis.zadd(k, score, member);
        // fallback to simple list
        const raw = await redis.get(k); const arr = raw ? JSON.parse(raw) : []; arr.push({ member, score }); await redis.set(k, JSON.stringify(arr)); return 1;
      },
      zincrby: async (k, incr, member) => {
        if (redis.zIncrBy) return redis.zIncrBy(k, incr, member);
        if (redis.zincrby) return redis.zincrby(k, incr, member);
        // fallback: load, modify, save
        const raw = await redis.get(k); const arr = raw ? JSON.parse(raw) : []; const idx = arr.findIndex(x=>x.member===member); if (idx===-1) { arr.push({ member, score: Number(incr) }); } else { arr[idx].score = Number(arr[idx].score||0)+Number(incr); } await redis.set(k, JSON.stringify(arr)); return 1;
      },
      zrevrange: async (k, start, stop, withscores) => {
        if (redis.zRevRange) return redis.zRevRange(k, start, stop, withscores ? { WITHSCORES: true } : undefined);
        if (redis.zrevrange) return redis.zrevrange(k, start, stop, withscores ? 'WITHSCORES' : undefined);
        // fallback: parse stored array
        const raw = await redis.get(k); const arr = raw ? JSON.parse(raw) : []; // sort by score desc
        arr.sort((a,b)=>Number(b.score||0)-Number(a.score||0));
        if (withscores) {
          const slice = arr.slice(start, stop+1).flatMap(x => [x.member, String(x.score)]);
          return slice;
        }
        return arr.slice(start, stop+1).map(x=>x.member);
      },
    sadd: async (k, v) => {
      if (redis.sAdd) return redis.sAdd(k, v);
      const raw = await redis.get(k); const arr = raw ? JSON.parse(raw) : []; if (!arr.includes(v)) arr.push(v); return redis.set(k, JSON.stringify(arr));
    },
      zrevrank: async (k, member) => {
        if (redis.zRevRank) return redis.zRevRank(k, member);
        if (redis.zrevrank) return redis.zrevrank(k, member);
        // fallback: parse stored array
        const raw = await redis.get(k); const arr = raw ? JSON.parse(raw) : []; arr.sort((a,b)=>Number(b.score||0)-Number(a.score||0)); const idx = arr.findIndex(x=>x.member===member); return idx === -1 ? null : idx;
      },
      zscore: async (k, member) => {
        if (redis.zScore) return redis.zScore(k, member);
        if (redis.zscore) return redis.zscore(k, member);
        const raw = await redis.get(k); const arr = raw ? JSON.parse(raw) : []; const found = arr.find(x=>x.member===member); return found ? String(found.score) : null;
      },
      incrby: async (k, n) => {
        if (redis.incrBy) return redis.incrBy(k, n);
        if (redis.incrby) return redis.incrby(k, n);
        const v = Number(await redis.get(k) || 0) + Number(n); await redis.set(k, String(v)); return v;
      },
      hincrbyfloat: async (k, field, n) => {
        if (redis.hIncrByFloat) return redis.hIncrByFloat(k, field, n);
        if (redis.hincrbyfloat) return redis.hincrbyfloat(k, field, n);
        // fallback: load object, modify field, save
        const raw = await redis.get(k); const obj = raw ? JSON.parse(raw) : {}; obj[field] = (Number(obj[field] || 0) + Number(n)); await redis.set(k, JSON.stringify(obj)); return obj[field];
      },
      hget: async (k, field) => {
        if (redis.hGet) return redis.hGet(k, field);
        if (redis.hget) return redis.hget(k, field);
        const raw = await redis.get(k); const obj = raw ? JSON.parse(raw) : {}; return obj ? obj[field] : null;
      },
    srem: async (k, v) => {
      if (redis.sRem) return redis.sRem(k, v);
      const raw = await redis.get(k); const arr = raw ? JSON.parse(raw) : []; const out = arr.filter(x => x !== v); return redis.set(k, JSON.stringify(out));
    },
    smembers: async (k) => {
      if (redis.sMembers) return redis.sMembers(k);
      const raw = await redis.get(k); return raw ? JSON.parse(raw) : [];
    },
    setex: (k, ttl, v) => (redis.setEx ? redis.setEx(k, ttl, v) : redis.set(k, v)),
    expire: (k, ttl) => (redis.expire ? redis.expire(k, ttl) : Promise.resolve(1)),
    incr: (k) => (redis.incr ? redis.incr(k) : (async () => { const v = Number(await redis.get(k) || 0) + 1; await redis.set(k, String(v)); return v; })()),
    lpush: (k, v) => (redis.lPush ? redis.lPush(k, v) : (async () => { const raw = await redis.get(k); const arr = raw ? JSON.parse(raw) : []; arr.unshift(v); return redis.set(k, JSON.stringify(arr)); })()),
    lpop: (k) => (redis.lPop ? redis.lPop(k) : (redis.lpop ? redis.lpop(k) : (async () => { const raw = await redis.get(k); const arr = raw ? JSON.parse(raw) : []; const v = arr.shift(); await redis.set(k, JSON.stringify(arr)); return v === undefined ? null : v; })())),
    ltrim: (k, start, stop) => (redis.lTrim ? redis.lTrim(k, start, stop) : Promise.resolve('OK')),
    rpush: (k, v) => (redis.rPush ? redis.rPush(k, v) : (redis.rpush ? redis.rpush(k, v) : (async () => { const raw = await redis.get(k); const arr = raw ? JSON.parse(raw) : []; arr.push(v); return redis.set(k, JSON.stringify(arr)); })())),
    rPush: (k, v) => (redis.rPush ? redis.rPush(k, v) : (redis.rpush ? redis.rpush(k, v) : (async () => { const raw = await redis.get(k); const arr = raw ? JSON.parse(raw) : []; arr.push(v); return redis.set(k, JSON.stringify(arr)); })())),
    keys: (pattern) => (redis.keys ? redis.keys(pattern) : (async () => { try { const raw = await redis.get('*'); return []; } catch (e) { return []; } })()),
    ttl: (k) => (redis.ttl ? redis.ttl(k) : Promise.resolve(-1))
    ,
    // Blocking rpoplpush compatibility: try modern names then fall back to non-blocking emulation
    brpoplpush: async (source, dest, timeoutSec = 0) => {
      // node-redis v4 may expose brPopLPush or brpoplpush; try those first
      if (redis.brPopLPush) return redis.brPopLPush(source, dest, timeoutSec);
      if (redis.brpoplpush) return redis.brpoplpush(source, dest, timeoutSec);
      // Some clients expose brPop which returns { key, element }
      if (redis.brPop) {
        const res = await redis.brPop(source, timeoutSec);
        if (!res) return null;
        const value = res.element || (Array.isArray(res) ? res[1] : null);
        if (value == null) return null;
        if (redis.lPush) await redis.lPush(dest, value);
        else if (redis.rpush) await redis.rpush(dest, value);
        else await redis.set(dest, JSON.stringify([value]));
        return value;
      }

      // Best-effort non-blocking fallback: try rPop or rpop then lPush
      try {
        let val = null;
        if (redis.rPop) val = await redis.rPop(source);
        else if (redis.rpop) val = await redis.rpop(source);
        else {
          // emulate via get/parse
          const raw = await redis.get(source);
          const arr = raw ? JSON.parse(raw) : [];
          val = arr.pop();
          await redis.set(source, JSON.stringify(arr));
        }

        if (val == null) return null;
        if (redis.lPush) await redis.lPush(dest, val);
        else if (redis.rpush) await redis.rpush(dest, val);
        else {
          const rawDest = await redis.get(dest);
          const darr = rawDest ? JSON.parse(rawDest) : [];
          darr.push(val);
          await redis.set(dest, JSON.stringify(darr));
        }
        return val;
      } catch (e) {
        // last resort: return null but do not crash
        return null;
      }
    },
    // rpoplpush alias
    rpoplpush: async (source, dest) => {
      if (redis.rPopLPush) return redis.rPopLPush(source, dest);
      if (redis.rpoplpush) return redis.rpoplpush(source, dest);
      // non-blocking fallback using rPop + lPush
      try {
        let val = null;
        if (redis.rPop) val = await redis.rPop(source);
        else if (redis.rpop) val = await redis.rpop(source);
        else {
          const raw = await redis.get(source);
          const arr = raw ? JSON.parse(raw) : [];
          val = arr.pop();
          await redis.set(source, JSON.stringify(arr));
        }
        if (val == null) return null;
        if (redis.lPush) await redis.lPush(dest, val);
        else if (redis.rpush) await redis.rpush(dest, val);
        else {
          const rawDest = await redis.get(dest);
          const darr = rawDest ? JSON.parse(rawDest) : [];
          darr.push(val);
          await redis.set(dest, JSON.stringify(darr));
        }
        return val;
      } catch (e) {
        return null;
      }
    },
    // publish compatibility shim
    publish: async (channel, message) => {
      if (!redis) return 0;
      if (redis.publish) return redis.publish(channel, message);
      if (redis.PUBLISH) return redis.PUBLISH(channel, message);
      if (redis.pub) return redis.pub(channel, message);
      // best-effort: if client supports client.sendCommand, attempt PUBLISH
      try {
        if (typeof redis.sendCommand === 'function') {
          return await redis.sendCommand(['PUBLISH', channel, String(message)]);
        }
      } catch (e) { /* ignore */ }
      // no-op fallback
      try { logger && logger.warn && logger.warn('redis.publish not available; publish is a no-op'); } catch (e) { /* ignore */ }
      return 0;
    }
  };
}

export default createRedisAdapter;
