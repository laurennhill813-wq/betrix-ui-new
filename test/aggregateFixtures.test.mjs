import assert from 'assert';
import { MockRedis } from '../src/lib/redis-factory.js';
import { aggregateFixtures } from '../src/lib/fixtures-aggregator.js';

async function run() {
  console.log('Running unit test: aggregateFixtures multi-sport');
  const mr = new MockRedis();

  const providerKeys = {
    'rapidapi:odds:fixtures:basketball': { provider: 'odds', sport: 'basketball', fixtures: [ { home_team: 'Bulls', away_team: 'Celtics', commence: '2025-12-23T15:36:00.374Z' }, { home_team: 'Lakers', away_team: 'Heat', commence: '2025-12-24T18:00:00.000Z' } ] },
    'rapidapi:sportspage:fixtures:tennis': { provider: 'sportspage', sport: 'tennis', fixtures: [ { home_team: 'Serena', away_team: 'Osaka', commence: '2025-12-23T15:36:00.374Z' } ] },
    'rapidapi:heisenbug:fixtures:soccer': { provider: 'heisenbug', sport: 'soccer', fixtures: [ { home_team: 'Man City', away_team: 'Man U', commence: '2025-12-25T12:00:00.000Z' } ] },
    'rapidapi:therundown:fixtures:rugby': { provider: 'therundown', sport: 'rugby', fixtures: [ { home_team: 'Team A', away_team: 'Team B', commence: '2025-12-26T14:00:00.000Z' } ] }
  };

  for (const [k, v] of Object.entries(providerKeys)) {
    await mr.set(k, JSON.stringify(v));
  }

  // run aggregator
  const res = await aggregateFixtures(mr);

  // Assert per-sport keys exist and counts match
  const sports = {
    basketball: 2,
    tennis: 1,
    soccer: 1,
    rugby: 1
  };

  for (const [sp, expected] of Object.entries(sports)) {
    const upKey = `rapidapi:fixtures:upcoming:${sp}`;
    const raw = await mr.get(upKey);
    assert(raw !== null, `expected key ${upKey} to exist`);
    const val = JSON.parse(raw);
    // aggregator writes counts as strings
    const count = typeof val === 'number' ? val : Number(val);
    assert.strictEqual(count, expected, `expected ${upKey}=${expected} but got ${count}`);
  }

  console.log('PASS: aggregateFixtures produced per-sport upcoming keys with expected counts');
}

run().catch(err => {
  console.error('TEST FAILED', err && err.stack ? err.stack : err);
  process.exit(1);
});
