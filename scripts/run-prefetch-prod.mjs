#!/usr/bin/env node
import { getRedisAdapter } from '../src/lib/redis-factory.js';
import { startPrefetchScheduler } from '../src/tasks/prefetch-scheduler.js';

async function main() {
  console.log('[run-prefetch-prod] starting');
  const redis = getRedisAdapter();

  // Run scheduler with a short interval, wait for one iteration, then stop
  const handle = startPrefetchScheduler({ redis, intervalSeconds: 15 });

  // Wait 25s to allow one pass (endpoints vary in latency)
  await new Promise((r) => setTimeout(r, 25000));

  try {
    const keys = [
      'betrix:prefetch:upcoming:by-sport',
      'betrix:prefetch:live:by-sport',
      'rapidapi:fixtures:list',
      'rapidapi:fixtures:upcoming:total',
      'rapidapi:fixtures:live:total',
    ];
    for (const k of keys) {
      try {
        const v = await redis.get(k).catch(() => null);
        console.log(k + ' =', v ? v.substring(0, 200) + (v.length > 200 ? '...[truncated]' : '') : '<none>');
      } catch (e) {
        console.warn('key read failed', k, e && e.message);
      }
    }
  } catch (e) {
    console.error('[run-prefetch-prod] inspect keys failed', e && e.message);
  }

  try {
    handle.stop();
  } catch (e) {}
  // allow graceful shutdown
  await new Promise((r) => setTimeout(r, 500));
  process.exit(0);
}

main().catch((err) => {
  console.error('[run-prefetch-prod] error', err && err.stack ? err.stack : err);
  process.exit(1);
});
