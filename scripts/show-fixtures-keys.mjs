import dotenv from 'dotenv';
import path from 'path';
import Redis from 'ioredis';

for (const f of ['.env.local.fixed', '.env.local', '.env']) {
  try { dotenv.config({ path: path.resolve(process.cwd(), f) }); } catch(_) {}
}

const redis = new Redis(process.env.REDIS_URL);

(async () => {
  const keys = ['football:fixtures:sportmonks', 'basketball:fixtures:sportmonks'];
  for (const k of keys) {
    const v = await redis.get(k);
    console.log(k, v ? `LEN:${v.length}` : 'MISSING');
    if (v) console.log('SAMPLE:', v.substring(0, 1000));
  }
  process.exit(0);
})();
