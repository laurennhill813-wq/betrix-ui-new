#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { MockRedis } from '../src/lib/redis-factory.js';
import { aggregateFixtures } from '../src/lib/fixtures-aggregator.js';

function ts() { return Date.now(); }

async function main() {
  console.log('Using MockRedis for aggregateFixtures validation');
  const mr = new MockRedis();

  // Ensure dump directory
  const dumpsDir = path.resolve('scripts/prefetch-dumps');
  if (!fs.existsSync(dumpsDir)) fs.mkdirSync(dumpsDir, { recursive: true });

  // Mock provider raw keys as requested
  const now = new Date().toISOString();

  const providerKeys = {
    'rapidapi:odds:upcoming:basketball': {
      provider: 'odds', sport: 'basketball', type: 'upcoming', fixtures: [
        { home_team: 'Bulls', away_team: 'Celtics', commence: '2025-12-23T15:36:00.374Z' },
        { home_team: 'Lakers', away_team: 'Heat', commence: '2025-12-24T18:00:00.000Z' }
      ]
    },
    'rapidapi:sportspage:upcoming:tennis': {
      provider: 'sportspage', sport: 'tennis', type: 'upcoming', fixtures: [
        { home_team: 'Serena', away_team: 'Osaka', commence: '2025-12-23T15:36:00.374Z' }
      ]
    },
    'rapidapi:heisenbug:upcoming:soccer': {
      provider: 'heisenbug', sport: 'soccer', type: 'upcoming', fixtures: [
        { home_team: 'Man City', away_team: 'Man U', commence: '2025-12-25T12:00:00.000Z' }
      ]
    },
    'rapidapi:therundown:upcoming:rugby': {
      provider: 'therundown', sport: 'rugby', type: 'upcoming', fixtures: [
        { home_team: 'Team A', away_team: 'Team B', commence: '2025-12-26T14:00:00.000Z' }
      ]
    }
  };

  // Pre-populate MockRedis with provider keys
  for (const [k, v] of Object.entries(providerKeys)) {
    await mr.set(k, JSON.stringify(v));
    console.log('WROTE', k);
  }

  // Dump stored provider values for debugging
  console.log('Provider key contents:');
  for (const k of Object.keys(providerKeys)) {
    const raw = await mr.get(k);
    try { console.log(' -', k, JSON.parse(raw)); } catch(e) { console.log(' -', k, raw); }
  }

  // Also write alternate provider key shapes that aggregator commonly scans
  // (some aggregators expect a ':fixtures:' segment)
  for (const [k, v] of Object.entries(providerKeys)) {
    // e.g. rapidapi:odds:upcoming:basketball -> rapidapi:odds:fixtures:basketball
    const alt = k.replace(':upcoming:', ':fixtures:');
    await mr.set(alt, JSON.stringify(v));
    console.log('WROTE alt', alt);
  }

  // Also write a couple of 'live' flavored keys to exercise live path (empty lists)
  await mr.set('rapidapi:odds:live:basketball', JSON.stringify({ provider: 'odds', sport: 'basketball', type: 'live', fixtures: [] }));

  // Run the aggregator
  console.log('Running aggregateFixtures against MockRedis...');
  try {
    await aggregateFixtures(mr);
  } catch (err) {
    console.error('aggregateFixtures threw:', err && err.stack ? err.stack : err);
    process.exitCode = 2;
    return;
  }

  // Helper for MockRedis keys() compatibility
  async function mrKeys(pattern) {
    if (typeof mr.keys === 'function') return mr.keys(pattern);
    // simple wildcard ending '*' handling
    if (!pattern.includes('*')) {
      return Array.from(mr.kv && mr.kv.keys ? mr.kv.keys() : []).filter(k => k === pattern);
    }
    const prefix = pattern.replace(/\*+$/, '');
    return Array.from(mr.kv && mr.kv.keys ? mr.kv.keys() : []).filter(k => k.startsWith(prefix));
  }

  // Inspect rapidapi:fixtures:* keys
  const fixtureKeys = await mrKeys('rapidapi:fixtures:*');
  console.log('Found rapidapi:fixtures keys:', fixtureKeys.length ? fixtureKeys.join(', ') : '<none>');

  const dumps = {};
  for (const fk of fixtureKeys) {
    const val = await mr.get(fk);
    try { dumps[fk] = JSON.parse(val); } catch (e) { dumps[fk] = val; }
  }

  // Save dump
  const outFile = path.join(dumpsDir, `mock-aggregate-dump-${ts()}.json`);
  fs.writeFileSync(outFile, JSON.stringify(dumps, null, 2), 'utf8');
  console.log('Wrote dump to', outFile);

  // Produce per-sport aggregation log lines
  const sports = ['basketball','tennis','soccer','rugby','americanfootball'];
  for (const sp of sports) {
    const upKey = `rapidapi:fixtures:upcoming:${sp}`;
    const liveKey = `rapidapi:fixtures:live:${sp}`;
    const upRaw = await mr.get(upKey);
    const liveRaw = await mr.get(liveKey);
    let upCount = 0, liveCount = 0;
    try {
      if (!upRaw) upCount = 0;
      else {
        const p = JSON.parse(upRaw);
        if (typeof p === 'number') upCount = p;
        else if (Array.isArray(p)) upCount = p.length;
        else if (p && Array.isArray(p.fixtures)) upCount = p.fixtures.length;
        else upCount = 0;
      }
    } catch (e) { upCount = 0; }
    try {
      if (!liveRaw) liveCount = 0;
      else {
        const p = JSON.parse(liveRaw);
        if (typeof p === 'number') liveCount = p;
        else if (Array.isArray(p)) liveCount = p.length;
        else if (p && Array.isArray(p.fixtures)) liveCount = p.fixtures.length;
        else liveCount = 0;
      }
    } catch (e) { liveCount = 0; }
    console.log(`[aggregateFixtures] ${sp} upcoming=${upCount} live=${liveCount}`);
  }

  console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
