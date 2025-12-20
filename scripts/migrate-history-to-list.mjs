#!/usr/bin/env node
/*
 Migration script: converts Redis keys matching `context:*:history` that are stored as STRING (JSON array)
 into LIST type preserving order. Use with REDIS_URL env. Supports --dry-run to preview changes.
*/
import { createClient } from 'redis';
const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const dry = process.argv.includes('--dry-run');
(async function(){
  const c = createClient({ url });
  c.on('error', (e)=>console.error('redis', String(e)));
  await c.connect();
  console.log('Connected to', url, 'dryRun=', dry);
  const keys = await c.keys('context:*:history');
  console.log('Found', keys.length, 'context:*:history keys');
  for (const k of keys) {
    try {
      const t = await c.type(k);
      if (t === 'list') {
        console.log('SKIP (already list):', k);
        continue;
      }
      if (t !== 'string') {
        console.warn('UNHANDLED TYPE', k, t);
        continue;
      }
      const val = await c.get(k);
      if (!val) { console.log('EMPTY STRING, deleting', k); if (!dry) await c.del(k); continue; }
      let parsed;
      try { parsed = JSON.parse(val); } catch (e) { console.warn('NOT JSON, skipping', k); continue; }
      if (!Array.isArray(parsed)) { console.warn('NOT ARRAY, skipping', k); continue; }
      console.log(`CONVERT ${k} (len=${parsed.length})`);
      if (!dry) {
        // perform conversion: delete key then push items preserving order
        await c.del(k);
        if (parsed.length) {
          // LPUSH adds items left-to-right if we reverse to preserve original order
          for (let i = parsed.length - 1; i >= 0; i--) {
            const item = typeof parsed[i] === 'string' ? parsed[i] : JSON.stringify(parsed[i]);
            await c.lPush(k, item);
          }
        }
        console.log('Converted', k);
      }
    } catch (e) {
      console.error('Error processing', k, String(e));
    }
  }
  await c.quit();
  console.log('Done');
})();
