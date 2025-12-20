#!/usr/bin/env node
import fs from "fs";
import path from "path";
import createRedisAdapter from "../src/utils/redis-adapter.js";
import { getRedis, MockRedis } from "../src/lib/redis-factory.js";
import { RapidApiFetcher, normalizeRedisKeyPart } from "../src/lib/rapidapi-fetcher.js";

const subscriptionsPath = path.join(process.cwd(), "src", "rapidapi", "subscriptions.json");
let subs = [];
try {
  subs = JSON.parse(fs.readFileSync(subscriptionsPath, "utf8"));
} catch (e) {
  console.error("Failed to load subscriptions.json", e?.message || e);
  process.exit(1);
}

const redisClient = createRedisAdapter(getRedis());
const fetcher = new RapidApiFetcher({ apiKey: process.env.RAPIDAPI_KEY });
const TTL = Number(process.env.RAPIDAPI_TTL_SEC || 300);

async function run() {
  const ts = Date.now();
  const diag = { updatedAt: ts, apis: {} };
  for (const api of subs) {
    const name = api.name || "unknown";
    const host = api.host;
    diag.apis[name] = { status: "unknown", lastUpdated: null, endpoints: {} };
    const endpoints = Array.isArray(api.sampleEndpoints) ? api.sampleEndpoints : [];
    for (const endpoint of endpoints.slice(0, 10)) {
      try {
        const result = await fetcher.fetchRapidApi(host, endpoint).catch((e) => { throw e; });
        const key = `rapidapi:${normalizeRedisKeyPart(name)}:${normalizeRedisKeyPart(endpoint)}`;
        await redisClient.set(key, JSON.stringify({ fetchedAt: ts, apiName: name, endpoint, httpStatus: result.httpStatus, data: result.body }), "EX", TTL).catch(() => {});
        diag.apis[name].endpoints[endpoint] = {
          httpStatus: result.httpStatus,
          errorReason: result.httpStatus && result.httpStatus >= 400 ? `http_${result.httpStatus}` : null,
          lastUpdated: ts,
        };
        diag.apis[name].lastUpdated = ts;
        diag.apis[name].status = (result.httpStatus >= 200 && result.httpStatus < 300) ? "ok" : "error";
        console.log({ apiName: name, endpoint, httpStatus: result.httpStatus });
        if (!summary[name]) summary[name] = { ok: 0, error: 0 };
        if (result.httpStatus >= 200 && result.httpStatus < 300) summary[name].ok += 1;
        else summary[name].error += 1;
      } catch (e) {
        diag.apis[name].endpoints[endpoint] = {
          httpStatus: e && e.status ? e.status : null,
          errorReason: e && e.message ? String(e.message) : String(e),
          lastUpdated: Date.now(),
        };
        diag.apis[name].status = "error";
        console.error({ apiName: name, endpoint, error: e && e.message ? e.message : String(e) });
        if (!summary[name]) summary[name] = { ok: 0, error: 0 };
        summary[name].error += 1;
      }
    }
  }
  try {
    await redisClient.set("rapidapi:health", JSON.stringify(diag)).catch(() => {});
  } catch (e) {}
  console.log("RapidAPI prefetch complete");
  // Print summary
  console.log("\nRapidAPI Summary:");
  for (const [name, s] of Object.entries(summary)) {
    const status = s.error === 0 ? "HEALTHY" : s.ok === 0 ? "FAILING" : "DEGRADED";
    console.log(`${name}: ${status} (ok=${s.ok}, errors=${s.error})`);
  }
  process.exit(0);
}

run().catch((e) => {
  console.error("run-rapidapi-prefetch failed", e?.message || e);
  process.exit(1);
});
