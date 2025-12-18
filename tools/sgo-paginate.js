#!/usr/bin/env node
// Simple CLI to fetch paginated results from SportGameOdds and print counts
// Usage: node tools/sgo-paginate.js --league=nba --what=events --limit=100

import { argv } from "process";
import { getRedis } from "../src/lib/redis-factory.js";
import * as sgo from "../src/services/sportsgameodds.js";

function parseArgs() {
  const out = {};
  for (const a of argv.slice(2)) {
    const [k, v] = a.replace(/^--/, "").split("=");
    out[k] = v || true;
  }
  return out;
}

async function main() {
  const args = parseArgs();
  const redis = getRedis();
  const league = args.league || "nba";
  const what = args.what || "events";
  const limit = Number(args.limit || 100);
  try {
    if (what === "events") {
      const all = await sgo.fetchAllEvents({
        league,
        limit,
        redis,
        forceFetch: true,
      });
      console.log(`Fetched events: ${all.length}`);
      console.log(JSON.stringify(all.slice(0, 5), null, 2));
    } else if (what === "teams") {
      const all = await sgo.fetchAllTeams({
        leagueID: league,
        limit,
        redis,
        forceFetch: true,
      });
      console.log(`Fetched teams: ${all.length}`);
      console.log(JSON.stringify(all.slice(0, 5), null, 2));
    } else if (what === "odds") {
      const all = await sgo.fetchAllOdds({
        league,
        limit,
        redis,
        forceFetch: true,
      });
      console.log(`Fetched odds: ${all.length}`);
      console.log(JSON.stringify(all.slice(0, 5), null, 2));
    } else {
      console.error("Unknown what param. Use events|teams|odds");
      process.exit(2);
    }
  } catch (e) {
    console.error("Error fetching:", e?.message || e);
    process.exit(1);
  } finally {
    try {
      await redis.quit();
    } catch (e) {
      /* ignore */
    }
  }
}

main();
