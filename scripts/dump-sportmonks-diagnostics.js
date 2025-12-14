#!/usr/bin/env node
// Dump SportMonks-related env and Redis diagnostics for operators to copy into support tickets
import Redis from 'ioredis';

function print(k, v) { console.log(`${k}: ${v}`); }

async function main() {
  try {
    console.log('SportMonks diagnostics');
    print('SPORTSMONKS_BASE', process.env.SPORTSMONKS_BASE || '(unset)');
    print('CONFIG.SPORTSMONKS_BASE (env)', process.env.SPORTSMONKS_BASE || '(unset)');
    print('SPORTSMONKS_API_KEY present', process.env.SPORTSMONKS_API_KEY ? 'yes' : 'no');
    print('SPORTSMONKS_INSECURE', process.env.SPORTSMONKS_INSECURE || 'false');
    print('SPORTSMONKS_TLS_PAUSE_SECONDS', process.env.SPORTSMONKS_TLS_PAUSE_SECONDS || '(unset)');

    if (!process.env.REDIS_URL && !process.env.REDIS) {
      console.log('\nNo Redis URL found in env (REDIS_URL or REDIS). Skipping Redis checks.');
      return;
    }

    const url = process.env.REDIS_URL || process.env.REDIS;
    console.log('\nConnecting to Redis...');
    const redis = new Redis(url);
    redis.on('error', (e) => console.error('Redis error', e && e.message ? e.message : e));

    const keys = ['prefetch:next:sportsmonks', 'betrix:provider:strategy:sportsmonks'];
    for (const k of keys) {
      try {
        const v = await redis.get(k);
        console.log(`${k}: ${v === null ? '(not set)' : v}`);
      } catch (e) {
        console.error(`Failed to read ${k}:`, e && e.message ? e.message : e);
      }
    }

    await redis.quit();
  } catch (err) {
    console.error('Diagnostics failed:', err && err.message ? err.message : err);
    process.exit(2);
  }
}

main();
