import { getRedisAdapter, MockRedis } from "./src/lib/redis-factory.js";
async function test() {
  console.log("Creating fallback MockRedis via getRedis()...");
  const r = getRedisAdapter();
  console.log("Type:", typeof r);
  if (r instanceof MockRedis) console.log("Got MockRedis instance");
  console.log(
    "Testing methods: set, get, expire, ttl, rpush, rpoplpush, brpoplpush, publish",
  );
  await r.set("k", "v");
  console.log("get k ->", await r.get("k"));
  await r.expire("k", 10);
  console.log("ttl(k) ->", await r.ttl("k"));
  await r.rpush("myq", "a");
  await r.rpush("myq", "b");
  console.log(
    "rpoplpush from myq to myq2 ->",
    await r.rpoplpush("myq", "myq2"),
  );
  console.log(
    "brpoplpush from myq to myq2 ->",
    await r.brpoplpush("myq", "myq2", 1),
  );
  await r.publish("channel", "hi");
  console.log("publish done");
  if (r.quit) {
    await r.quit();
    console.log("quit ok");
  }
}

test().catch((e) => {
  console.error("TEST ERROR", e);
  process.exit(1);
});
