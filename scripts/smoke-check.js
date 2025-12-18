// scripts/smoke-check.js
// ESM-compatible smoke check: performs a simple HTTP health probe and exits.
import http from "http";

async function probe(url) {
  return new Promise((resolve, reject) => {
    const req = http
      .get(url, (res) => {
        resolve({ statusCode: res.statusCode });
      })
      .on("error", (err) => reject(err));
    req.setTimeout(5000, () => {
      req.destroy(new Error("timeout"));
    });
  });
}

(async function () {
  try {
    const healthUrl =
      process.env.SERVICE_HEALTH_URL || "http://localhost:3000/health";
    const res = await probe(healthUrl);
    if (res && res.statusCode >= 200 && res.statusCode < 300) {
      console.log("health ok", res.statusCode);
      process.exit(0);
    }
    console.error("health check returned", res);
    process.exit(2);
  } catch (e) {
    console.error("smoke check failed", e && (e.message || e));
    process.exit(2);
  }
})();
