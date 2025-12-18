#!/usr/bin/env node
// tools/inspect-sgo.js
// Fetch sample events and odds for configured leagues using the app's service
// Usage: node tools/inspect-sgo.js [league1,league2,...]

import "../src/setup-env.js"; // optional bootstrap if present
import sportsgameodds from "../src/services/sportsgameodds.js";
import { getRedis } from "../src/lib/redis-factory.js";

async function inspect(leagues) {
  const redis = getRedis();

  for (const league of leagues) {
    try {
      console.log(`\n--- League: ${league} (events) ---`);
      const events = await sportsgameodds.fetchEvents({
        league,
        redis,
        forceFetch: true,
      });
      console.log(JSON.stringify(events, null, 2).slice(0, 4000));

      const firstEventId =
        Array.isArray(events) &&
        events[0] &&
        (events[0].id || events[0].eventId)
          ? events[0].id || events[0].eventId
          : null;
      if (firstEventId) {
        console.log(
          `\n--- Fetching odds for first event (${firstEventId}) ---`,
        );
        const odds = await sportsgameodds.fetchOdds({
          league,
          eventId: firstEventId,
          redis,
          forceFetch: true,
        });
        console.log(JSON.stringify(odds, null, 2).slice(0, 10000));
      } else {
        console.log("No events returned for", league);
      }
    } catch (e) {
      console.error("Error inspecting league", league, e?.message || String(e));
    }
  }
}

const args = process.argv.slice(2);
const leagues = args.length ? args : ["nba", "epl", "nfl"];
inspect(leagues)
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(2);
  });
