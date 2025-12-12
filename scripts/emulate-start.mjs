import { getRedis } from '../src/lib/redis-factory.js';
import safeName from '../src/utils/safe-name.js';
import premiumUI from '../src/utils/premium-ui-builder.js';

(async function(){
  const redis = getRedis();
  const key = process.argv[2] || 'raw:fixtures:footballdata:39';
  try {
    const raw = await redis.get(key);
    if (!raw) {
      console.log('No data for', key);
      process.exit(0);
    }
    const payload = JSON.parse(raw);
    const items = payload.data || payload;
    const normalized = items.map(i => ({
      id: i.id || i.match_id,
      home: safeName(i.homeTeam || i.home || (i.teams && i.teams.home)),
      away: safeName(i.awayTeam || i.away || (i.teams && i.teams.away)),
      date: i.utcDate || i.kickoff || i.date || null,
      time: i.utcDate || i.kickoff || i.time || null,
      league: safeName(i.competition || i.league || (i.raw && i.raw.competition)),
      raw: i
    }));

    const display = premiumUI.buildUpcomingFixtures(normalized.slice(0,10), normalized[0]?.league || 'League');
    console.log('--- Rendered Upcoming Fixtures ---\n');
    console.log(display);
    process.exit(0);
  } catch (e) {
    console.error('Error emulating start', e && e.message || e);
    process.exit(2);
  }
})();
