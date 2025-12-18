const express = require("express");
const { getRedisAdapter } = require("./lib/redis-factory.js");

const app = express();
const redis = getRedisAdapter();

(async () => {
  try {
    if (redis && typeof redis.connect === "function") await redis.connect();
  } catch (e) {
    // ignore connection errors for diagnostics worker
  }

  if (redis && typeof redis.on === "function") {
    redis.on("connect", () => console.log("? Connected to Redis"));
    redis.on("error", (err) => console.error("? Redis error", err));
  }

  app.get("/health", (req, res) => res.json({ status: "ok" }));
  const PORT = process.env.PORT || 10000;
  app.listen(PORT, "0.0.0.0", () =>
    console.log(`BETRIX worker + diagnostics running on ${PORT}`),
  );
})();
