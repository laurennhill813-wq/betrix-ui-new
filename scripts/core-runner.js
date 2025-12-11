#!/usr/bin/env node
import dotenv from 'dotenv'; dotenv.config();
import app from '../src/app_clean.js';
import { getRedis, MockRedis } from '../src/lib/redis-factory.js';
import { Logger } from '../src/utils/logger.js';

const logger = new Logger('core-runner');

async function start() {
  // Redis
  let redis;
  try {
    redis = getRedis();
    try { if (typeof redis.ping === 'function') await redis.ping(); logger.info('Redis connected (core-runner)'); } catch(e){ logger.warn('Redis ping failed, using MockRedis'); redis = new MockRedis(); }
  } catch(e) { logger.warn('Redis init failed, using MockRedis'); redis = new MockRedis(); }

  // Heartbeat
  setInterval(async () => {
    try { await redis.set('worker:heartbeat', Date.now()); await redis.expire('worker:heartbeat', 30); } catch (e) { logger.warn('Heartbeat write failed', e && e.message ? e.message : e); }
  }, 10 * 1000);

  // Prefetch subscriber
  try {
    const sub = getRedis();
    if (typeof sub.subscribe !== 'function') {
      logger.warn('Prefetch subscriber skipped: redis client has no subscribe()');
    } else {
      await sub.subscribe('prefetch:updates');
      sub.on('message', (_ch, message) => {
        logger.info('prefetch event (core-runner):', message);
      });
    }
  } catch (e) { logger.warn('Prefetch subscriber failed', e && e.message ? e.message : e); }

  // Start HTTP server
  const PORT = Number(process.env.PORT || 5000);
  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`core-runner HTTP server listening on 0.0.0.0:${PORT}`);
    console.log(`core-runner HTTP server listening on 0.0.0.0:${PORT}`);
  });
}

start().catch((e)=>{ console.error('core-runner failed', e); process.exit(1); });
