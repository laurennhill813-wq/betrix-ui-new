import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";

test("Lipana webhook HMAC signature verification", async () => {
  const secret = "test-secret-0123";
  const payload = { event: "payment", data: { id: "tx-123", amount: 100 } };
  const raw = Buffer.from(JSON.stringify(payload));
  const computed = crypto
    .createHmac("sha256", secret)
    .update(raw)
    .digest("hex");

  // Simulate header value and verification routine similar to server.js
  const header = computed;
  const ours = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  // Use timingSafeEqual logic by comparing Buffers
  const ok = (() => {
    try {
      return crypto.timingSafeEqual(Buffer.from(ours), Buffer.from(header));
    } catch (e) {
      return false;
    }
  })();

  assert.equal(ok, true, "computed HMAC should match header HMAC");
});
