#!/usr/bin/env node
// Ensure the simulation uses the provided DATABASE_URL if available
// Force the provided DATABASE_URL for this simulation run (overrides existing env)
process.env.DATABASE_URL = 'postgresql://betrix_postgrls_exgh_user:ntkPapptqddXzMno5kCfG3VBiHWyXr71@dpg-d4op2oqdbo4c73f9c3j0-a.frankfurt-postgres.render.com/betrix_postgrls_exgh';

import { verifyAndActivatePayment } from '../src/handlers/payment-router.js';

// Minimal in-memory Redis-like adapter for testing
const store = new Map();
const redisMock = {
  async get(key) {
    const v = store.get(key);
    return v === undefined ? null : v;
  },
  async setex(key, ttl, val) {
    // ignore ttl in mock
    store.set(key, val);
    return true;
  },
  async set(key, val) {
    store.set(key, val);
    return true;
  },
  async hset(key, field, value) {
    const curr = store.get(key) || {};
    curr[field] = value;
    store.set(key, curr);
    return 1;
  },
};

async function run() {
  const orderId = `ORD_SIM_${Date.now()}`;
  const orderData = {
    orderId,
    userId: 'simuser',
    tier: 'PRO',
    paymentMethod: 'NOWPAYMENTS',
    baseAmount: 8.99,
    fee: 0.45,
    totalAmount: 9.44,
    currency: 'USD',
    status: 'pending',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    metadata: { nowpayments: { invoice: 'SIMINV' } },
  };

  await redisMock.setex(`payment:order:${orderId}`, 900, JSON.stringify(orderData));
  console.log('Inserted mock order:', orderId);

  try {
    const result = await verifyAndActivatePayment(redisMock, orderId, `SIMTX-${Date.now()}`);
    console.log('Activation result:', result);
    const stored = store.get(`payment:order:${orderId}`);
    console.log('Stored order after activation:', stored);
  } catch (e) {
    console.error('Error during activation simulation:', e?.message || e);
    process.exit(1);
  }
}

run();
