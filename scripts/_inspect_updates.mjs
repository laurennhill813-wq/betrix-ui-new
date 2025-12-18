import fs from "fs";
import path from "path";
const envPath = path.resolve(".env.local");
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, "utf8");
  raw.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m) {
      let val = m[2];
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      process.env[m[1]] = val;
    }
  });
  console.log(".env.local loaded");
}
import Redis from "ioredis";
const r = new Redis(process.env.REDIS_URL);
(async () => {
  try {
    const len = await r.llen("telegram:updates");
    console.log("telegram:updates length:", len);
    const items = await r.lrange("telegram:updates", 0, 9);
    console.log("first 10 updates:");
    items.forEach((it, i) => {
      try {
        console.log(i, JSON.parse(it));
      } catch (e) {
        console.log(i, it);
      }
    });
    const processing = await r.lrange("telegram:processing", 0, 9);
    console.log("telegram:processing (first 10):", processing.length);
    processing.forEach((it, i) => {
      try {
        console.log("proc", i, JSON.parse(it));
      } catch (e) {
        console.log("proc", i, it);
      }
    });
  } catch (e) {
    console.error("ERR", e);
  } finally {
    await r.quit();
    process.exit(0);
  }
})();
