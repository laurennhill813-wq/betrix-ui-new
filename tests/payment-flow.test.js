import { test } from 'node:test';
import assert from 'node:assert/strict';
import createRedisAdapter from '../src/utils/redis-adapter.js';
import { createPaymentOrder, createCustomPaymentOrder } from '../src/handlers/payment-router.js';

test('payment flow: createPaymentOrder returns orderId', async () => {
  const redis = createRedisAdapter(null);
  const order = await createPaymentOrder(redis, 5555, 'PRO', 'SAFARICOM_TILL', 'KE', { phone: '+254700000000' });
  assert.ok(order && order.orderId, 'orderId should be present');
});

test('payment flow: createCustomPaymentOrder returns orderId', async () => {
  const redis = createRedisAdapter(null);
  const order = await createCustomPaymentOrder(redis, 6666, 150, 'PAYPAL', 'KE', {});
  assert.ok(order && order.orderId, 'custom orderId should be present');
});
