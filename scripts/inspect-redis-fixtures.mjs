import { getRedis } from '../src/lib/redis-factory.js';

(async function(){
  try {
    const redis = getRedis();
    console.log('Connected to redis client');
    // Use KEYS (ok for debugging)
    const keys = await redis.keys('raw:fixtures:*');
    console.log(`Found ${keys.length} raw fixtures keys`);
    for (const k of keys.slice(0, 10)) {
      console.log('---', k);
      const raw = await redis.get(k);
      try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.data && parsed.data.length) {
          console.log(`  entries: ${parsed.data.length}`);
          console.log('  sample[0]:', JSON.stringify(parsed.data[0], null, 2));
        } else {
          console.log('  no data or empty array');
        }
      } catch (e) {
        console.log('  raw value not JSON:', String(raw).slice(0,200));
      }
    }
    process.exit(0);
  } catch (e) {
    console.error('Inspect failed', e?.message || e);
    process.exit(1);
  }
})();