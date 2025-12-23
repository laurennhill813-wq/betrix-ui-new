#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { getRedisAdapter } from '../src/lib/redis-factory.js';
import { incPrefetchBySport } from '../src/utils/metrics.js';

async function dumpKey(redis, key, outDir) {
  try {
    const v = await redis.get(key).catch(() => null);
    const out = v ? (typeof v === 'string' ? JSON.parse(v) : v) : null;
    const file = path.join(outDir, `${key.replace(/[:\\/]/g,'_')}.json`);
    fs.writeFileSync(file, JSON.stringify(out, null, 2));
    return out;
  } catch (e) {
    return null;
  }
}

async function main() {
  console.log('[inspect-prefetch-redis] connecting to redis');
  const redis = getRedisAdapter();
  const outDir = path.join(process.cwd(), 'scripts', 'prefetch-dumps');
  try { fs.mkdirSync(outDir, { recursive: true }); } catch (e) {}

  // list betrix consolidated keys
  const consolidated = [
    'betrix:prefetch:upcoming:by-sport',
    'betrix:prefetch:live:by-sport'
  ];
  const results = { consolidated: {}, rapidapi: {} };

  for (const k of consolidated) {
    const val = await redis.get(k).catch(() => null);
    results.consolidated[k] = val ? JSON.parse(val) : null;
    // save dump
    fs.writeFileSync(path.join(outDir, `${k.replace(/[:\\/]/g,'_')}.json`), JSON.stringify(results.consolidated[k], null, 2));
  }

  // scan rapidapi fixtures keys
  const upcomingKeys = await redis.keys('rapidapi:fixtures:upcoming:*').catch(() => []);
  const liveKeys = await redis.keys('rapidapi:fixtures:live:*').catch(() => []);
  const allKeys = Array.from(new Set([...(upcomingKeys||[]), ...(liveKeys||[])]));

  for (const k of allKeys) {
    try {
      const raw = await redis.get(k).catch(() => null);
      let parsed = null;
      try { parsed = raw ? JSON.parse(raw) : null; } catch (e) { parsed = raw; }
      // count entries: try array length or object fixtures length or 1
      let count = 0;
      if (Array.isArray(parsed)) count = parsed.length;
      else if (parsed && parsed.fixtures && Array.isArray(parsed.fixtures)) count = parsed.fixtures.length;
      else if (parsed && parsed.count) count = Number(parsed.count) || 0;
      else if (parsed && typeof parsed === 'object') count = Object.keys(parsed).length || 1;
      else if (parsed) count = 1;
      results.rapidapi[k] = { count, sample: parsed && (Array.isArray(parsed) ? parsed.slice(0,5) : (parsed.fixtures ? parsed.fixtures.slice(0,5) : parsed)) };
      // save dump
      fs.writeFileSync(path.join(outDir, `${k.replace(/[:\\/]/g,'_')}.json`), JSON.stringify(parsed, null, 2));
    } catch (e) {
      results.rapidapi[k] = { count: 0, sample: null, error: e && e.message };
    }
  }

  // Print report
  console.log('\n[inspect-prefetch-redis] consolidated keys:');
  for (const k of consolidated) console.log('-', k, results.consolidated[k] ? 'present' : '<none>');

  console.log('\n[inspect-prefetch-redis] rapidapi fixtures keys:');
  for (const k of Object.keys(results.rapidapi).sort()) {
    console.log('-', k, 'count=', results.rapidapi[k].count);
  }

  // derive sports list from consolidated upcoming
  const sports = Object.keys(results.consolidated['betrix:prefetch:upcoming:by-sport']?.sports || {});
  console.log('\n[inspect-prefetch-redis] sports in consolidated upcoming:', sports.join(', ') || '<none>');

  // Increment per-sport metrics for discovered sports
  for (const s of sports) {
    try { incPrefetchBySport(s, 1); } catch (e) {}
  }

  // highlight anomalies (sports with zero upcoming)
  const anomalies = [];
  for (const s of sports) {
    const up = results.consolidated['betrix:prefetch:upcoming:by-sport'].sports[s];
    const live = results.consolidated['betrix:prefetch:live:by-sport']?.sports?.[s];
    if (!up || (up.count === 0)) anomalies.push({ sport: s, upcoming: up ? up.count : 0, live: live ? live.count : 0 });
  }
  if (anomalies.length) {
    console.log('\n[inspect-prefetch-redis] anomalies: sports with zero upcoming fixtures:');
    for (const a of anomalies) console.log('-', a.sport, 'upcoming=', a.upcoming, 'live=', a.live);
  } else {
    console.log('\n[inspect-prefetch-redis] no anomalies found for consolidated sports');
  }

  // Save full report
  fs.writeFileSync(path.join(outDir, 'prefetch-inspect-report.json'), JSON.stringify(results, null, 2));
  console.log('\n[inspect-prefetch-redis] dumps saved to', outDir);
  process.exit(0);
}

main().catch((err)=>{ console.error('[inspect-prefetch-redis] error', err && err.stack||err); process.exit(1); });
