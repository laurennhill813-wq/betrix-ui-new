import dotenv from "dotenv";
import path from "path";

// Try loading env from common files, prefer the fixed file if present
const envFiles = [".env.local.fixed", ".env.local", ".env"];
let loaded = false;
for (const f of envFiles) {
  try {
    const full = path.resolve(process.cwd(), f);
    const res = dotenv.config({ path: full });
    if (res && res.parsed) {
      console.log(`Loaded env from ${f}`);
      loaded = true;
      break;
    }
  } catch (e) {
    // ignore
  }
}
if (!loaded) console.warn("No env file loaded; relying on process.env");

(async () => {
  try {
    // Dynamic import after dotenv to ensure CONFIG reads loaded env
    const { CONFIG } = await import("../src/config.js");
    const { default: SportGameOddsService } =
      await import("../src/services/sportsgameodds.js");

    console.log(
      "CONFIG.SPORTSGAMEODDS:",
      JSON.stringify(CONFIG.SPORTSGAMEODDS, null, 2),
    );
    const svc = new SportGameOddsService(null);
    console.log("SportGameOdds base:", svc.base);
    console.log("SPORTSGAMEODDS key present:", Boolean(svc.key));

    const items = await svc.getUpcomingFixtures(null, { per_page: 50 });
    console.log(
      "Fetched items count:",
      Array.isArray(items) ? items.length : 0,
    );

    const sample = Array.isArray(items) ? items.slice(0, 5) : [];
    console.log("Sample (first 5) normalized items:");
    console.log(JSON.stringify(sample, null, 2));

    for (const it of sample) {
      const homeType = it.home === null ? "null" : typeof it.home;
      const awayType = it.away === null ? "null" : typeof it.away;
      console.log(
        "ITEM:",
        it.id,
        "| homeType:",
        homeType,
        homeType === "object" ? Object.keys(it.home || {}) : it.home,
        "| awayType:",
        awayType,
        awayType === "object" ? Object.keys(it.away || {}) : it.away,
        "| start:",
        it.start,
      );
    }

    // If no items returned, perform a few diagnostic requests to discover available endpoints
    if (!Array.isArray(items) || items.length === 0) {
      const axios = (await import("axios")).default;
      const candidates = [
        "",
        "/v1",
        "/health",
        "/status",
        "/docs",
        "/openapi.json",
        "/events",
        "/fixtures",
        "/odds",
        "/odds/events",
        "/events/upcoming",
        "/fixtures/upcoming",
      ];
      console.log(
        "No items; running diagnostics against candidate endpoints...",
      );
      for (const c of candidates) {
        const url = svc.base.replace(/\/$/, "") + c;
        try {
          const resp = await axios.get(url, {
            headers: svc._headers(),
            timeout: 10000,
          });
          console.log("OK", url, "status", resp.status);
          if (resp.data && typeof resp.data === "object") {
            console.log("Sample keys:", Object.keys(resp.data).slice(0, 10));
          } else {
            console.log("Response length:", String(resp.data).slice(0, 200));
          }
        } catch (e) {
          const status =
            e.response && e.response.status ? e.response.status : "ERR";
          console.log("ERR", url, "->", status);
        }
      }
    }

    process.exit(0);
  } catch (e) {
    console.error("Error while fetching SportGameOdds:", e?.message || e);
    if (e && e.response && e.response.data) {
      console.error("Response data:", JSON.stringify(e.response.data, null, 2));
    }
    process.exit(2);
  }
})();
