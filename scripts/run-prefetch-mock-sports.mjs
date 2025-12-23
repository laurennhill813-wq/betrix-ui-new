#!/usr/bin/env node
import { MockRedis } from "../src/lib/redis-factory.js";
import { startPrefetchScheduler } from "../src/tasks/prefetch-scheduler.js";
import { aggregateFixtures } from '../src/lib/fixtures-aggregator.js';

function wrapMock(m) {
  return Object.assign(m, {
    publish: async (channel, message) => {
      const key = `pub:${channel}`;
      const arr = m.kv.get(key) || [];
      arr.push(message);
      m.kv.set(key, arr);
      return arr.length;
    },
  });
}

// Pre-populate MockRedis with rapidapi provider raw keys that include fixtures for basketball and tennis
const basketballFixtures = [
  { sport: 'basketball', home_team: 'MockBulls', away_team: 'MockCeltics', commence: new Date(Date.now()+24*3600*1000).toISOString() }
];
const tennisFixtures = [
  { sport: 'tennis', home_team: 'MockNadal', away_team: 'MockFederer', commence: new Date(Date.now()+24*3600*1000).toISOString() }
];

(async ()=>{
  const mr = wrapMock(new MockRedis());
  // Add simple keys(pattern) implementation to MockRedis so aggregator can discover keys
  mr.keys = async (pattern) => {
    try {
      if (!pattern || pattern === '*') return Array.from(mr.kv.keys());
      const re = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return Array.from(mr.kv.keys()).filter((k) => re.test(k));
    } catch (e) { return []; }
  };
  console.log('[mock-sports] Using MockRedis and pre-populating provider keys');

  // Simulate two rapidapi provider keys that the aggregator will pick up
  await mr.set('rapidapi:MockBasketballAPI:fixtures_sample', JSON.stringify({ apiName: 'MockBasketballAPI', fixtures: basketballFixtures, fetchedAt: Date.now() }));
  await mr.set('rapidapi:MockTennisAPI:fixtures_sample', JSON.stringify({ apiName: 'MockTennisAPI', fixtures: tennisFixtures, fetchedAt: Date.now() }));

  // Also include a soccer provider to keep parity
  await mr.set('rapidapi:MockSoccerAPI:fixtures_sample', JSON.stringify({ apiName: 'MockSoccerAPI', fixtures: [{ sport: 'soccer', home_team: 'MockSocA', away_team: 'MockSocB', commence: new Date(Date.now()+24*3600*1000).toISOString() }], fetchedAt: Date.now() }));

  // Show provider key contents for debugging
  console.log('[mock-sports] provider key sample (basketball)=', await mr.get('rapidapi:MockBasketballAPI:fixtures_sample'));
  console.log('[mock-sports] provider key sample (tennis)=', await mr.get('rapidapi:MockTennisAPI:fixtures_sample'));

  // Run aggregation directly to validate aggregator behavior
  const aggDirect = await aggregateFixtures(mr).catch((e)=>{ console.error('[mock-sports] aggregate failed', e && e.message); return null; });
  console.log('[mock-sports] aggregate direct result=', aggDirect && { totalLive: aggDirect.totalLiveMatches, totalUpcoming: aggDirect.totalUpcomingFixtures, bySport: aggDirect.bySport } || '<none>');

  // Start scheduler with only the mock redis (no sportsAggregator needed)
  const handle = startPrefetchScheduler({ redis: mr, intervalSeconds: 5 });

  // Wait for one aggregation pass
  await new Promise((r)=>setTimeout(r, 6000));

  // Inspect rapidapi fixtures keys
  const sports = ['basketball','tennis','soccer','rugby','americanfootball'];
  for (const s of sports) {
    const up = await mr.get(`rapidapi:fixtures:upcoming:${s}`);
    const lv = await mr.get(`rapidapi:fixtures:live:${s}`);
    console.log(`rapidapi:fixtures:upcoming:${s} =>`, up || '<none>');
    console.log(`rapidapi:fixtures:live:${s} =>`, lv || '<none>');
  }

  console.log('MockRedis keys:', Array.from(mr.kv.keys()));

  try { handle.stop(); } catch (e) {}
  process.exit(0);
})();
