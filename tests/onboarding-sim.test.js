import assert from "assert";
import { test } from "node:test";
import { handleMessage } from "../src/handlers/telegram-handler-v2.js";
import { UserService } from "../src/services/user.js";

// Rich MockRedis for simulation
class MockRedis {
  constructor() {
    this.store = new Map();
  }
  async get(k) { return this.store.has(k) ? this.store.get(k) : null; }
  async set(k, v) { this.store.set(k, String(v)); return "OK"; }
  async setex(k, _ttl, v) { this.store.set(k, String(v)); return "OK"; }
  async del(k) { return this.store.delete(k) ? 1 : 0; }
  async hset(k, field, val) {
    const obj = JSON.parse(this.store.get(k) || "{}") || {};
    obj[field] = String(val);
    this.store.set(k, JSON.stringify(obj));
    return 1;
  }
  async hgetall(k) { try { const raw = this.store.get(k); return raw ? JSON.parse(raw) : {}; } catch { return {}; } }
  async type(k) {
    if (!this.store.has(k)) return "none";
    const v = this.store.get(k);
    // crude detection
    if (typeof v === "string") return "string";
    return "string";
  }
}

test("onboarding simulation: ACTIVE user with onboarding key should be cleaned and not intercept message", async () => {
  const redis = new MockRedis();
  const userId = 1000;
  const chatId = 2000;

  // seed ACTIVE user
  await redis.set(`user:${userId}`, JSON.stringify({ state: "ACTIVE", id: String(userId) }));
  // seed onboarding key
  await redis.set(`user:${userId}:onboarding`, JSON.stringify({ step: "name", createdAt: Date.now() }));

  // create UserService bound to this mock redis
  const userService = new UserService(redis);
  const services = { userService };

  // invoke handler with a normal message
  const update = { message: { chat: { id: chatId }, from: { id: userId }, text: "Hello AI" } };
  const res = await handleMessage(update, redis, services);

  // 1. ensureNoOnboarding() deletes the onboarding key
  const onboardRaw = await redis.get(`user:${userId}:onboarding`);
  assert.strictEqual(onboardRaw, null, "onboarding key should be deleted for ACTIVE user");

  // 2 & 3. The message should not be intercepted by onboarding handler => res should be null/undefined
  assert.ok(res === null || res === undefined, "handleMessage should not return onboarding payload for ACTIVE user");

  // 4. Final state remains ACTIVE
  const userRaw = await redis.get(`user:${userId}`);
  const finalUser = userRaw ? JSON.parse(userRaw) : null;
  assert.ok(finalUser && String(finalUser.state).toUpperCase() === "ACTIVE", "user state should remain ACTIVE");
});
