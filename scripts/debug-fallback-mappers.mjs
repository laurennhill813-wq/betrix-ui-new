import dotenv from 'dotenv';
import path from 'path';
import Redis from 'ioredis';
import { mapFootballDataFixtures } from '../src/services/mappers/footballdata-mapper.js';
import { mapOpenLigaMatches } from '../src/services/mappers/openligadb-mapper.js';

for (const f of ['.env.local.fixed', '.env.local', '.env']) {
  try { dotenv.config({ path: path.resolve(process.cwd(), f) }); } catch(_) {}
}

const redis = new Redis(process.env.REDIS_URL);

(async () => {
  const fdKeys = await redis.keys('raw:fixtures:footballdata:*');
  console.log('football-data keys:', fdKeys.length);
  for (const k of fdKeys.slice(0,3)) {
    const v = await redis.get(k);
    console.log('KEY:', k, 'LEN:', v ? v.length : 0);
    try {
      const parsed = JSON.parse(v);
      const mapped = mapFootballDataFixtures(parsed, { sport: 'football' });
      console.log('mapped count:', mapped.length, 'sample:', mapped.slice(0,1));
    } catch (e) { console.error('parse error', e.message); }
  }

  const olKeys = await redis.keys('openligadb:matchdata:*');
  console.log('openliga keys:', olKeys.length);
  for (const k of olKeys.slice(0,3)) {
    const v = await redis.get(k);
    console.log('KEY:', k, 'LEN:', v ? v.length : 0);
    try {
      const parsed = JSON.parse(v);
      const mapped = mapOpenLigaMatches(parsed, { sport: 'football' });
      console.log('mapped count:', mapped.length, 'sample:', mapped.slice(0,1));
    } catch (e) { console.error('parse error', e.message); }
  }

  process.exit(0);
})();
