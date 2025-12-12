import dotenv from 'dotenv';
import path from 'path';
import Redis from 'ioredis';

for (const f of ['.env.local.fixed', '.env.local', '.env']) {
  try { dotenv.config({ path: path.resolve(process.cwd(), f) }); } catch(_) {}
}

const redis = new Redis(process.env.REDIS_URL);

const keys = [
  'prefetch:failures:sgo:football',
  'prefetch:failures:sgo:nba',
  'prefetch:failures:sgo:mlb',
  'prefetch:failures:sgo:nhl',
];

(async () => {
  for (const k of keys) {
    const v = await redis.get(k);
    console.log(k, v ? v.substring(0, 1000) : null);
  }
  process.exit(0);
})();
