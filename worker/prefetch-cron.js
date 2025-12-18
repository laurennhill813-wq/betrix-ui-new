import { prefetchAllSportsData } from "../src/services/prefetch.js";

async function run() {
  console.log("⏱ Running scheduled prefetch...");
  try {
    await prefetchAllSportsData();
    console.log("✅ Prefetch cycle done.");
    process.exit(0);
  } catch (e) {
    console.error("Prefetch failed", e.message || e);
    process.exit(2);
  }
}

run();
