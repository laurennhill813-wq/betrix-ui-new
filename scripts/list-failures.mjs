import dotenv from 'dotenv';
import path from 'path';
import Redis from 'ioredis';

for (const f of ['.env.local.fixed', '.env.local', '.env']) {
  try { dotenv.config({ path: path.resolve(process.cwd(), f) }); } catch(_) {}
}

const redis = new Redis(process.env.REDIS_URL);

(async () => {
  try {
    const keys = await redis.keys('prefetch:failures*');
    console.log('failure keys count:', keys.length);
    for (const k of keys) {
      const v = await redis.get(k);
      console.log('-', k, v ? v.substring(0, 1000) : null);
    }
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(2);
  }
})();
