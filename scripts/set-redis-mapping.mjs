import Redis from 'ioredis';

async function main() {
  const [,, redisUrl, providerRef, orderIdRaw, userId = 'admin', amountRaw = '150'] = process.argv;
  if (!redisUrl || !providerRef) {
    console.error('Usage: node scripts/set-redis-mapping.mjs <REDIS_URL> <PROVIDER_REF> [ORDER_ID] [USER_ID] [AMOUNT]');
    process.exit(2);
  }
  const orderId = orderIdRaw || `SIMORD-${Date.now()}`;
  const amount = Number(amountRaw || 150);

  const redis = new Redis(redisUrl);
  try {
    console.log('Connecting to Redis...');
    await redis.ping();
    console.log('Connected. Writing keys...');

    const orderData = {
      orderId,
      userId,
      tier: 'SIGNUP',
      paymentMethod: 'MPESA',
      baseAmount: amount,
      fee: 0,
      totalAmount: amount,
      currency: 'KES',
      status: 'pending',
      createdAt: new Date().toISOString(),
      metadata: { simulated: true }
    };

    await redis.setex(`payment:order:${orderId}`, 900, JSON.stringify(orderData));
    await redis.setex(`payment:by_provider_ref:MPESA:${providerRef}`, 900, orderId);

    console.log('Wrote keys:');
    console.log(`  payment:order:${orderId}`);
    console.log(`  payment:by_provider_ref:MPESA:${providerRef}`);
    console.log('Done.');
    await redis.quit();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    try { await redis.quit(); } catch(e){/*ignore*/}
    process.exit(3);
  }
}

main();
