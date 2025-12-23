#!/usr/bin/env node
import Redis from 'ioredis';

async function run() {
  const url = process.env.REDIS_URL || process.env.REDIS || '';
  if (!url) { console.error('Please set REDIS_URL'); process.exit(2); }
  const r = new Redis(url);
  const key = 'telegram:updates';
  try {
    const t = await r.type(key);
    console.log('key', key, 'type=', t);
    if (t === 'none') { console.log('Key does not exist, nothing to do'); return; }
    if (t === 'list') { console.log('Already a list, nothing to do'); return; }
    if (t !== 'string') {
      console.warn('Unexpected type, will not attempt migration:', t);
      return;
    }
    const v = await r.get(key);
    if (!v) { console.log('String value empty, deleting key and leaving list empty'); await r.del(key); return; }
    let items = null;
    try { items = JSON.parse(v); } catch(e) { items = null; }
    if (Array.isArray(items)) {
      console.log('Parsed JSON array with', items.length, 'items. Recreating list.');
      await r.del(key);
      if (items.length > 0) {
        // push items as-is (stringified)
        const strs = items.map(i => typeof i === 'string' ? i : JSON.stringify(i));
        await r.rpush(key, ...strs);
      }
      console.log('Migration complete');
      return;
    }
    // Not an array: treat as single entry
    console.log('Value is single item; migrating into single-element list');
    await r.del(key);
    await r.rpush(key, v);
    console.log('Migration complete');
  } catch (e) {
    console.error('Migration failed', e && e.message || e);
    process.exit(1);
  } finally {
    try { await r.quit(); } catch(e){ try{ r.disconnect() } catch{} }
  }
}

run();
