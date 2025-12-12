import dotenv from 'dotenv';
import path from 'path';
import Redis from 'ioredis';

for (const f of ['.env.local.fixed', '.env.local', '.env']) {
  try { dotenv.config({ path: path.resolve(process.cwd(), f) }); } catch(_) {}
}

const redis = new Redis(process.env.REDIS_URL);

(async () => {
  try {
    const patterns = ['*odds*', '*sgo*', '*sportsgame*', '*sportsgameodds*', '*odds:*'];
    for (const p of patterns) {
      const keys = await redis.keys(p);
      console.log('PATTERN:', p, 'COUNT:', keys.length);
      for (const k of keys) {
        const v = await redis.get(k);
        console.log('-', k, 'LEN:', v ? v.length : 0);
      }
    }
    process.exit(0);
  } catch (e) {
    console.error('inspect-odds-keys failed', e.message || e);
    process.exit(2);
  }
})();
