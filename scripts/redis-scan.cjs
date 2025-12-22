#!/usr/bin/env node
import('redis').then(async ({ createClient }) => {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: node scripts/redis-scan.cjs <REDIS_URL>');
    process.exit(2);
  }
  const c = createClient({ url });
  c.on('error', (e) => {
    // ignore
  });
  try {
    await c.connect();
    const patterns = ['rapidapi:startup:*', 'rapidapi:fixtures:*'];
    const results = {};
    for (const p of patterns) {
      results[p] = [];
      for await (const key of c.scanIterator({ MATCH: p, COUNT: 1000 })) {
        try {
          const type = await c.type(key);
          let val = null;
          try {
            if (type === 'string') val = await c.get(key);
            else if (type === 'list') val = await c.lRange(key, 0, -1);
            else if (type === 'hash') val = await c.hGetAll(key);
            else val = await c.get(key).catch(() => null);
          } catch (e) {
            val = String(e && e.message ? e.message : e);
          }
          const ttl = await c.ttl(key);
          results[p].push({ key, type, ttl, value: val });
        } catch (e) {
          // continue
        }
      }
    }
    console.log(JSON.stringify(results, null, 2));
    await c.quit();
  } catch (e) {
    console.error('Redis scan failed', e && e.message ? e.message : e);
    try { await c.quit(); } catch {}
    process.exit(1);
  }
}).catch((e)=>{ console.error('redis import failed', e && e.message ? e.message : e); process.exit(1)});
