import assert from "assert";
import crypto from "crypto";

console.log("\n🧪 nowpayments.test.js\n");

// Helper to reset env and reload module
function loadNowSvcWithEnv(env = {}) {
  // apply env
  const oldEnv = {};
  for (const k of Object.keys(env)) {
    oldEnv[k] = process.env[k];
    process.env[k] = env[k];
  }
  // clear module from cache
  const p = new URL("../src/payments/nowpayments_v2.js", import.meta.url).pathname.replace(/^\//, "");
  try {
    // dynamic import to ensure env is applied
    const modPromise = import("../src/payments/nowpayments_v2.js");
    return { modPromise, restore: () => {
      for (const k of Object.keys(env)) {
        if (oldEnv[k] === undefined) delete process.env[k];
        else process.env[k] = oldEnv[k];
      }
    } };
  } catch (e) {
    for (const k of Object.keys(env)) {
      if (oldEnv[k] === undefined) delete process.env[k];
      else process.env[k] = oldEnv[k];
    }
    throw e;
  }
}

async function run() {
  // 1) Successful invoice creation (mock fetch)
  console.log("📌 Test: Successful createInvoice uses API and normalizes response");
  const env = { NOWPAYMENTS_API_KEY: "test_key_123", NOWPAYMENTS_API_BASE: "https://api.nowpayments.test/v1", PUBLIC_HOST_ORIGIN: "https://example.local" };
  const { modPromise, restore } = loadNowSvcWithEnv(env);
  // mock global.fetch
  const fakeResp = {
    id: "inv_abc123",
    payment_address: "1A2b3C",
    payment_amount: 0.001,
    payment_currency: "BTC",
    invoice_url: "https://nowpayments.test/inv/inv_abc123",
    expires_at: "2025-12-31T23:59:59Z",
  };
  global.fetch = async (url, opts) => {
    return {
      ok: true,
      status: 200,
      json: async () => fakeResp,
      text: async () => JSON.stringify(fakeResp),
    };
  };

  const nowSvc = (await modPromise).default;
  const inv = await nowSvc.createInvoice({ amount: 10, currency: "USD", orderId: "ORD1", userId: 42, crypto: "BTC", expiresMinutes: 30 });
  assert(inv && inv.providerRef === "inv_abc123", "providerRef should be returned");
  assert(inv.address === "1A2b3C", "address normalized");
  assert(inv.cryptoCurrency === "BTC", "cryptoCurrency normalized");
  console.log("✅ PASS\n");
  restore();

  // 2) Missing API key should throw early
  console.log("📌 Test: Missing API key throws on createInvoice");
  const { modPromise: mod2, restore: restore2 } = loadNowSvcWithEnv({ NOWPAYMENTS_API_KEY: "" });
  const nowSvc2 = (await mod2).default;
  let threw = false;
  try {
    await nowSvc2.createInvoice({ amount: 1, orderId: "ORD2", userId: 1 });
  } catch (e) {
    threw = true;
    assert(e.message && e.message.includes("NOWPAYMENTS_API_KEY"), "should mention missing API key");
  }
  assert(threw, "createInvoice should throw when not configured");
  console.log("✅ PASS\n");
  restore2();

  // 3) Network error should bubble up
  console.log("📌 Test: Network error bubbles from fetch");
  const { modPromise: mod3, restore: restore3 } = loadNowSvcWithEnv({ NOWPAYMENTS_API_KEY: "test_key_123" });
  global.fetch = async () => { throw new Error("network fail"); };
  const nowSvc3 = (await mod3).default;
  let netThrew = false;
  try {
    await nowSvc3.createInvoice({ amount: 5, orderId: "ORD3", userId: 2 });
  } catch (e) {
    netThrew = true;
    assert(e.message && e.message.includes("network fail"), "network error should propagate");
  }
  assert(netThrew, "network error should throw");
  console.log("✅ PASS\n");
  restore3();

  // 4) verifySignature valid and invalid
  console.log("📌 Test: verifySignature accepts valid signature and rejects invalid");
  const key = "my_secret_key";
  const { modPromise: mod4, restore: restore4 } = loadNowSvcWithEnv({ NOWPAYMENTS_API_KEY: key });
  const nowSvc4 = (await mod4).default;
  const raw = Buffer.from(JSON.stringify({ test: "payload" }));
  const h = crypto.createHmac("sha256", key).update(raw).digest("hex");
  const valid = nowSvc4.verifySignature(raw, h);
  assert(valid === true, "signature should verify");
  const invalid = nowSvc4.verifySignature(raw, "deadbeef");
  assert(invalid === false, "invalid signature rejected");
  console.log("✅ PASS\n");
  restore4();

  // Cleanup global.fetch stub
  try { delete global.fetch; } catch (e) { global.fetch = undefined; }

  console.log("🎉 nowpayments tests complete\n");
}

run().catch((err) => {
  console.error("❌ nowpayments.test.js error:", err);
  process.exit(1);
});
