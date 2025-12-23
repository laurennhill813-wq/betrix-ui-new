import MockRedis from '../tests/helpers/mock-redis.js';
import { SportsAggregator } from '../src/services/sports-aggregator.js';

(async function run() {
  const redis = new MockRedis();

  // Sample aggregated rapidapi fixtures (mixed sports)
  const fixtures = [
    { id: 'b1', sport: 'basketball', homeTeam: 'Lakers', awayTeam: 'Warriors', startTime: new Date(Date.now()+3600*1000).toISOString(), type: 'upcoming' },
    { id: 'b2', sport: 'basketball', homeTeam: 'Bucks', awayTeam: 'Celtics', startTime: new Date(Date.now()+7200*1000).toISOString(), type: 'upcoming' },
    { id: 's1', sport: 'soccer', homeTeam: 'Arsenal', awayTeam: 'Chelsea', startTime: new Date(Date.now()+3600*1000).toISOString(), type: 'upcoming' },
  ];

  await redis.set('rapidapi:fixtures:list', JSON.stringify(fixtures));

  const agg = new SportsAggregator(redis, {});

  const res = await agg.getUpcomingBySport('basketball');
  console.log('Result length:', Array.isArray(res) ? res.length : 'not-array');
  console.log(JSON.stringify(res, null, 2));

  const resEmpty = await agg.getUpcomingBySport('baseball');
  console.log('Baseball result length:', Array.isArray(resEmpty) ? resEmpty.length : 'not-array');
})();