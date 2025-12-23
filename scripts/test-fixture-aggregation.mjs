#!/usr/bin/env node

import { getRedis } from "../src/lib/redis-factory.js";
import { aggregateFixtures } from "../src/lib/fixtures-aggregator.js";

const redis = await getRedis();

try {
  console.log("Testing fixture aggregation...\n");

  // Check what keys exist
  console.log("=== Scanning for fixture keys ===");
  const fixtureKeys = await redis.keys("rapidapi:*:fixtures:*").catch(() => []);
  console.log(`Found ${fixtureKeys.length} fixture keys:`);
  for (const key of fixtureKeys.slice(0, 10)) {
    const val = await redis.get(key).catch(() => null);
    const parsed = val ? JSON.parse(val) : null;
    const sport = parsed?.sport || parsed?.sportKey || "unknown";
    const fixtureCount = parsed?.fixtures?.length || 0;
    console.log(`  ${key}: sport=${sport}, fixtures=${fixtureCount}`);
  }

  // Run aggregation
  console.log("\n=== Running Aggregation ===");
  const agg = await aggregateFixtures(redis);
  console.log(`Total upcoming: ${agg.totalUpcomingFixtures}, Live: ${agg.totalLiveMatches}`);
  console.log(`By sport:`);
  for (const [sport, counts] of Object.entries(agg.bySport)) {
    console.log(`  ${sport}: upcoming=${counts.upcoming}, live=${counts.live}`);
  }
  
  process.exit(0);
} catch (e) {
  console.error("Error:", e.message);
  process.exit(1);
}
