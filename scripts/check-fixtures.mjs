import 'dotenv/config';
import { getRedis } from '../src/lib/redis-factory.js';
import { SportsAggregator } from '../src/services/sports-aggregator.js';

(async function () {
  try {
    const redis = getRedis();
    const agg = new SportsAggregator(redis);
    console.log('Fetching upcoming fixtures (sample)...');
    const fixtures = await agg.getFixtures();
    console.log(`Total fixtures returned: ${fixtures.length}`);
    for (let i = 0; i < Math.min(10, fixtures.length); i++) {
      const f = fixtures[i];
      console.log(`${i+1}. ${f.home} vs ${f.away} — kickoff: ${f.kickoff || f.time || f.utcDate || 'TBA'} | comp: ${f.league || f.competition || ''}`);
    }
    process.exit(0);
  } catch (e) {
    console.error('Error fetching fixtures:', e);
    process.exit(2);
  }
})();
