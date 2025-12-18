import assert from "assert";
import MockRedis from "./helpers/mock-redis.js";
import { handleProfile } from "../src/handlers/commands.js";

async function run() {
  const redis = new MockRedis();
  const userId = 424242;
  const userKey = `user:${userId}`;

  // Seed a realistic user hash as JSON (hgetall expects an object)
  const userObj = {
    id: String(userId),
    created_at: "2024-01-02T12:34:56.000Z",
    tier: "PRO",
    total_bets: "12",
    total_wins: "7",
    current_streak: "3",
    referral_code: "ref_test_123",
  };

  await redis.set(userKey, JSON.stringify(userObj));

  const res = await handleProfile(9999, userId, redis);
  assert(res && res.chat_id === 9999, "Expected chat_id on response");
  assert(
    typeof res.text === "string" && res.text.includes(userObj.referral_code),
    "Profile text should contain referral code",
  );

  console.log("✔ profile command test passed");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
