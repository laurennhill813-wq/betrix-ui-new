import dotenv from "dotenv";
import path from "path";

// load env (prefer fixed)
for (const f of [".env.local.fixed", ".env.local", ".env"]) {
  try {
    dotenv.config({ path: path.resolve(process.cwd(), f) });
  } catch (_) {}
}

import { getUnifiedOddsWithFair } from "../src/services/odds-aggregator.js";

(async () => {
  try {
    console.log("Running odds aggregator test for football...");
    const res = await getUnifiedOddsWithFair({
      sport: "football",
      league: "nfl",
    });
    console.log("Events count:", Array.isArray(res) ? res.length : "NA");
    console.log("Sample:", JSON.stringify((res || []).slice(0, 3), null, 2));
    process.exit(0);
  } catch (e) {
    console.error("Aggregator test failed:", e?.message || e);
    process.exit(2);
  }
})();
