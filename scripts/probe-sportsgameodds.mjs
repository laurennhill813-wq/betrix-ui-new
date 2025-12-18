import dotenv from "dotenv";
import path from "path";
import axios from "axios";

// load env (prefer fixed)
const envFiles = [".env.local.fixed", ".env.local", ".env"];
for (const f of envFiles) {
  try {
    dotenv.config({ path: path.resolve(process.cwd(), f) });
  } catch (_) {}
}

const key = process.env.SPORTSGAMEODDS_API_KEY || null;
const configuredBase =
  process.env.SPORTSGAMEODDS_BASE || "https://api.sportsgameodds.com/v1";

const baseCandidates = [
  configuredBase,
  configuredBase.replace(/\/?v?1\/?$/i, ""),
  configuredBase + "/api",
  configuredBase.replace("api.", ""),
  "https://api.sgo.io",
  "https://sportsgameodds.com/api",
  "https://sgo-api.sportsgameodds.com",
];

const endpoints = [
  "/",
  "/v1",
  "/api",
  "/health",
  "/status",
  "/docs",
  "/openapi.json",
  "/events",
  "/events/upcoming",
  "/events/list",
  "/fixtures",
  "/fixtures/upcoming",
  "/fixtures/list",
  "/odds",
  "/odds/events",
  "/odds/list",
];

const headerVariants = [
  { Authorization: `Bearer ${key}` },
  { "x-api-key": key },
  { "X-API-KEY": key },
  { "Api-Key": key },
  {},
];

const queryVariants = [{}, { api_key: key }, { key }, { token: key }];

function shortBody(b) {
  try {
    const s = typeof b === "string" ? b : JSON.stringify(b);
    return s.slice(0, 800).replace(/\n/g, " ");
  } catch (e) {
    return "<unserializable>";
  }
}

(async () => {
  console.log("SPORTSGAMEODDS API KEY present:", Boolean(key));
  console.log("Configured base:", configuredBase);

  const results = [];
  for (const base of baseCandidates) {
    for (const ep of endpoints) {
      const url = (base + ep).replace(/([^:])\/\//g, "$1/");
      let ok = false;
      for (const q of queryVariants) {
        for (const h of headerVariants) {
          const headers = Object.assign({ Accept: "application/json" }, h);
          try {
            const resp = await axios.get(url, {
              headers,
              params: q,
              timeout: 8000,
              validateStatus: null,
            });
            const status = resp.status;
            const body = resp.data;
            results.push({
              url,
              status,
              header: h,
              query: q,
              body: shortBody(body),
            });
            ok = true;
            // if 2xx we can stop trying other auth variants for this endpoint
            if (status >= 200 && status < 300) break;
          } catch (e) {
            results.push({ url, error: e.message });
          }
        }
        if (ok) break;
      }
    }
  }

  // Print concise table-like output for the top results (unique url/status)
  const seen = new Map();
  for (const r of results) {
    const key = `${r.url}::${r.status || "ERR"}`;
    if (!seen.has(key)) seen.set(key, r);
  }

  console.log("\nProbe summary (unique url/status):");
  for (const [k, r] of seen.entries()) {
    console.log(
      `${r.status || "ERR"} ${r.url} -> ${r.body ? r.body.substring(0, 120) : r.error || ""}`,
    );
  }

  // Save a detailed JSON file for inspection
  try {
    const fs = await import("fs");
    await fs.promises.writeFile(
      path.resolve(process.cwd(), "scripts/probe-sgo-results.json"),
      JSON.stringify(results, null, 2),
      "utf8",
    );
    console.log("\nDetailed results saved to scripts/probe-sgo-results.json");
  } catch (e) {
    console.warn("Failed to save detailed results:", e?.message || e);
  }

  process.exit(0);
})();
