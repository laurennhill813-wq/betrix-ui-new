#!/usr/bin/env node
// Purge Redis keys for raw fixtures and raw live caches (useful after deploy)
// Usage: ALLOW_INSECURE_TLS=1 node ./scripts/purge-fixtures.js

import Redis from 'ioredis';

const url = process.env.REDIS_URL;
if (!url) {
  console.error('REDIS_URL not set. Aborting.');
  process.exit(2);
}

const redis = new Redis(url);

async function purge() {
  try {
    console.log('Scanning for keys matching raw:fixtures:* and raw:live:*');
    const patterns = ['raw:fixtures:*', 'raw:live:*', 'betrix:prefetch:*'];
    for (const pattern of patterns) {
      console.log(`Scanning ${pattern} ...`);
      let cursor = '0';
      let total = 0;
      do {
        const res = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 1000);
        cursor = res[0];
        const keys = res[1] || [];
        if (keys.length) {
          total += keys.length;
          console.log(`  Deleting ${keys.length} keys...`);
          await redis.del(...keys);
        }
      } while (cursor !== '0');
      console.log(`Finished pattern ${pattern}`);
    }
    console.log('Purge complete.');
  } catch (e) {
    console.error('Error during purge:', e && e.message);
    process.exit(1);
  } finally {
    await redis.quit();
  }
}

purge();
