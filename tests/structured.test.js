import assert from "assert";
import { validateRecommendation } from "../src/ai/structured.js";

function run() {
  console.log("\n🧪 structured.test.js");
  const good = {
    type: "recommendation",
    match_id: "m1",
    market: "match_winner",
    selection: "Team A",
    odds: 1.95,
    confidence: 0.7,
    stake_recommendation: "small",
    rationale: "Home form advantage.",
  };
  const r = validateRecommendation(good);
  assert(r.valid === true, "good recommendation should validate");
  const bad = { ...good, odds: "1.95" };
  const r2 = validateRecommendation(bad);
  assert(r2.valid === false, "bad recommendation should fail");
  console.log("✅ structured validation tests passed");
}

run();

export default run;
