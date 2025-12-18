import dotenv from "dotenv";
import path from "path";
import Redis from "ioredis";

for (const f of [".env.local.fixed", ".env.local", ".env"]) {
  try {
    dotenv.config({ path: path.resolve(process.cwd(), f) });
  } catch (_) {}
}

const redis = new Redis(process.env.REDIS_URL);

(async () => {
  await redis.set(
    "prefetch:failures:sgo:test",
    JSON.stringify({ hello: "world" }),
    "EX",
    600,
  );
  const v = await redis.get("prefetch:failures:sgo:test");
  console.log("set/get result:", v);
  process.exit(0);
})();
