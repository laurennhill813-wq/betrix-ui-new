#!/usr/bin/env node
/**
 * Payment Router Tests
 * Validates Safaricom Till order creation and verification using MockRedis
 */

import assert from "assert";
import {
  createPaymentOrder,
  getPaymentInstructions,
  verifyAndActivatePayment,
} from "../src/handlers/payment-router.js";

// Minimal MockRedis used by payment-router
class MockRedis {
  constructor() {
    this.data = {};
  }

  async hgetall(key) {
    const raw = this.data[key];
    try {
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return raw || {};
    }
  }

  async hset(key, field, value) {
    // support both object and field/value usage
    if (typeof field === "object") {
      this.data[key] = JSON.stringify(field);
    } else {
      const cur = this.data[key] ? (typeof this.data[key] === 'string' ? JSON.parse(this.data[key]) : this.data[key]) : {};
      cur[field] = value;
      this.data[key] = JSON.stringify(cur);
    }
    return 1;
  }

  async get(key) {
    const v = this.data[key];
    return v === undefined ? null : v;
  }

  async setex(key, exp, val) {
    this.data[key] = typeof val === "string" ? val : JSON.stringify(val);
    return "OK";
  }

  async set(key, val) {
    this.data[key] = typeof val === "string" ? val : JSON.stringify(val);
    return "OK";
  }
}

async function run() {
  console.log("\n🧪 Payment Router Tests\n");

  const redis = new MockRedis();
  const userId = 424242;

  // Test: create Safaricom Till order
  console.log("📌 Test: createPaymentOrder with SAFARICOM_TILL");
  const order = await createPaymentOrder(
    redis,
    userId,
    "PLUS",
    "SAFARICOM_TILL",
    "KE",
    { phone: "+254712345678" },
  );
  assert(order && order.orderId, "Order should be returned with orderId");
  assert(order.providerRef, "Order should have providerRef for till");
  assert(
    order.instructions && order.instructions.tillNumber,
    "Instructions should include tillNumber",
  );
  console.log("✅ PASS: Safaricom Till order created with instructions\n");

  // Test: getPaymentInstructions returns same till instructions
  console.log("📌 Test: getPaymentInstructions for till");
  const instr = await getPaymentInstructions(
    redis,
    order.orderId,
    "SAFARICOM_TILL",
  );
  assert(
    instr && instr.tillNumber,
    "getPaymentInstructions should return till instructions",
  );
  console.log("✅ PASS: getPaymentInstructions returned till data\n");

  // Test: verify and activate
  console.log("📌 Test: verifyAndActivatePayment");
  const tx = `TILL_TX_${Date.now()}`;
  const result = await verifyAndActivatePayment(redis, order.orderId, tx);
  assert(
    result && result.success,
    "verifyAndActivatePayment should return success",
  );

  const userRecord = await redis.hgetall(`user:${userId}`);
  assert(
    userRecord && userRecord.tier,
    "User record should be updated with tier",
  );
  assert(
    userRecord && userRecord.subscriptionExpiry,
    "User should have subscriptionExpiry",
  );
  console.log("✅ PASS: verifyAndActivatePayment activated subscription\n");

  console.log("All Payment Router tests passed!");
  process.exit(0);
}

const _isMain =
  typeof require !== "undefined"
    ? require.main === module
    : typeof import.meta !== "undefined" &&
      import.meta.url === `file://${process.argv[1]}`;
if (_isMain) {
  run().catch((err) => {
    console.error("❌ Payment Router tests failed", err);
    process.exit(1);
  });
}
