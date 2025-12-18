import { runMediaAiTick } from "../src/tickers/mediaAiTicker.js";

(async () => {
  try {
    console.log("[forceMediaTick] Running single media tick...");
    await runMediaAiTick();
    console.log("[forceMediaTick] Done");
  } catch (e) {
    console.error("[forceMediaTick] Error", e && e.message ? e.message : e);
    process.exit(1);
  }
})();
