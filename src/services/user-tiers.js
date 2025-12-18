import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL);

export async function getUserTier(userId) {
  const tier = await redis.get(`user:${userId}:tier`);
  return tier || "free";
}

export async function setUserTier(userId, tier) {
  await redis.set(`user:${userId}:tier`, tier);
}

export default { getUserTier, setUserTier };
