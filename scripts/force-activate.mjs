#!/usr/bin/env node
import { getRedis } from '../src/lib/redis-factory.js';
import { verifyAndActivatePayment } from '../src/handlers/payment-router.js';

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.error('Usage: node scripts/force-activate.mjs <providerRef> [txId]');
    process.exit(2);
  }
  // If the first arg looks like a redis URL (redis:// or rediss://), allow passing it
  let redisUrl = null;
  let providerRef = null;
  let txId = null;
  if (args[0] && (args[0].startsWith('redis://') || args[0].startsWith('rediss://'))) {
    redisUrl = args[0];
    providerRef = args[1];
    txId = args[2] || `MANUAL_${Date.now()}`;
  } else {
    providerRef = args[0];
    txId = args[1] || `MANUAL_${Date.now()}`;
  }

  try {
    if (redisUrl) {
      process.env.REDIS_URL = redisUrl;
      console.log('Temporarily using provided REDIS_URL argument');
    }
    const redis = getRedis();
    console.log('Using REDIS_URL=', process.env.REDIS_URL ? '[SET]' : '[NOT SET]');

    // Try to find mapping by providerRef
    const keysToTry = [`payment:by_provider_ref:MPESA:${providerRef}`, `payment:by_provider_ref:MPESA:${providerRef}`];
    let orderId = null;
    for (const k of keysToTry) {
      try {
        const v = await redis.get(k);
        if (v) { orderId = v; console.log('Found mapping', k, '->', v); break; }
      } catch (e) { console.error('Redis get failed for', k, e?.message || e); }
    }

    if (!orderId) {
      console.error('No orderId mapping found for providerRef', providerRef);
      process.exit(3);
    }

    // Call verifyAndActivatePayment
    try {
      const res = await verifyAndActivatePayment(redis, orderId, txId);
      console.log('Activation result:', res);
    } catch (e) {
      console.error('Activation failed:', e?.message || e);
      process.exit(4);
    }
  } catch (err) {
    console.error('Error:', err?.message || err);
    process.exit(1);
  }
}

main();
