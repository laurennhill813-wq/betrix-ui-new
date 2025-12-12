import dotenv from 'dotenv';
import path from 'path';
import Redis from 'ioredis';

for (const f of ['.env.local.fixed', '.env.local', '.env']) {
  try { dotenv.config({ path: path.resolve(process.cwd(), f) }); } catch(_) {}
}

const redis = new Redis(process.env.REDIS_URL);

(async () => {
  try {
    const keys = await redis.keys('*:*:*');
    console.log('Prefetch keys count:', keys.length);
    const sample = keys.slice(0, 20);
    for (const k of sample) {
      try {
        const v = await redis.get(k);
        console.log('\nKEY:', k, 'LEN:', v ? v.length : 0);
        try { console.log('VALUE (truncated):', v ? v.substring(0, 800) : null); } catch(_) { console.log('VALUE (non-string)'); }
      } catch (e) { console.warn('Failed reading', k, e.message || e); }
    }
    process.exit(0);
  } catch (e) {
    console.error('inspect-prefetch failed', e.message || e);
    process.exit(2);
  }
})();
