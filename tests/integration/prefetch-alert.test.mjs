import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import Redis from 'ioredis';

// Integration test: verify that when provider health key indicates failures >= threshold,
// the scheduler will attempt to send an alert by setting prefetch:alert:sent:<type> key.
// This test runs only when REDIS_URL is provided and ALLOW_INTEGRATION=1 to prevent
// running in local dev.

if (!process.env.ALLOW_INTEGRATION || String(process.env.ALLOW_INTEGRATION) !== '1') {
  console.log('Skipping integration tests (ALLOW_INTEGRATION!=1)');
  process.exit(0);
}

if (!process.env.REDIS_URL) {
  console.error('REDIS_URL required for integration tests');
  process.exit(2);
}

const redis = new Redis(process.env.REDIS_URL);

test('prefetch alert triggers and throttle key set', async (t) => {
  const type = 'testprovider';
  // ensure clean state
  await redis.del(`prefetch:failures:${type}`);
  await redis.del(`prefetch:alert:sent:${type}`);
  await redis.del(`betrix:provider:health:${type}`);

  // simulate failures by incrementing failure counter to threshold
  const threshold = Number(process.env.PREFETCH_ALERT_THRESHOLD || 3);
  for (let i = 0; i < threshold; i++) await redis.incr(`prefetch:failures:${type}`);

  // write health key as failed
  const health = { ok: false, ts: Date.now(), fails: threshold, message: 'simulated' };
  await redis.set(`betrix:provider:health:${type}`, JSON.stringify(health));

  // start a short-lived node process that imports the scheduler job and invokes recordFailure simulation
  // We reuse the existing module by spawning a small script
  const script = `
    import('../src/tasks/prefetch-scheduler.js').catch(e=>{console.error(e);process.exit(2)});
    // wait a bit for side-effects
    setTimeout(()=>process.exit(0), 1200);
  `;

  const child = spawn(process.execPath, ['-e', script], { stdio: 'inherit' });

  await new Promise((res) => child.on('exit', res));

  // allow scheduler to set alert key if implemented
  await new Promise((r) => setTimeout(r, 2000));

  const alertKey = await redis.get(`prefetch:alert:sent:${type}`);
  assert(alertKey !== null, 'alert throttle key should be set');

  // cleanup
  await redis.del(`prefetch:failures:${type}`);
  await redis.del(`prefetch:alert:sent:${type}`);
  await redis.del(`betrix:provider:health:${type}`);

  await redis.quit();
});
