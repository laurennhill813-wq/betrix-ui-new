#!/usr/bin/env node
import fetch from "../src/lib/fetch.js";

const KEY = process.env.SPORTSDATAIO_KEY;
if (!KEY) {
  console.error("Missing SPORTSDATAIO_KEY in environment");
  process.exit(1);
}

const BASE = "https://api.sportsdata.io/v3/soccer";
const today = new Date().toISOString().slice(0, 10);

const endpoints = [
  `/scores/json/Competitions`,
  `/scores/json/Areas`,
  `/scores/json/Teams`,
  `/scores/json/FixturesByDate/${today}`,
  `/scores/json/MatchesByDate/${today}`,
  `/scores/json/LiveScores`,
  `/scores/json/Live`,
  `/scores/json/UpcomingMatches`,
  `/scores/json/UpcomingFixtures`,
];

async function probe(ep, { useHeader = true, useQuery = true } = {}) {
  let url = `${BASE}${ep}`;
  if (useQuery) url += `?key=${encodeURIComponent(KEY)}`;
  const opts = {};
  if (useHeader) opts.headers = { "Ocp-Apim-Subscription-Key": KEY };

  try {
    const res = await fetch(url, opts);
    const headers = Object.fromEntries(res.headers.entries());
    const text = await res.text();
    console.log("\n===", ep, "STATUS", res.status, "LEN", text.length);
    console.log("Request url:", url);
    console.log("Request used header:", useHeader, "query:", useQuery);
    console.log("Response headers:", headers);
    try {
      const j = JSON.parse(text);
      if (Array.isArray(j)) {
        console.log("Sample array length:", j.length);
        console.log(JSON.stringify(j.slice(0, 3), null, 2));
      } else {
        console.log("Sample object keys:", Object.keys(j).slice(0, 10));
        console.log(JSON.stringify(j, null, 2).substring(0, 2000));
      }
    } catch (e) {
      console.log("Non-JSON response (first 1000 chars):");
      console.log(text.substring(0, 1000));
    }
  } catch (err) {
    console.error("Request failed for", ep, err && err.message);
  }
}

(async () => {
  const mode = (process.argv[2] || "both").toLowerCase();
  console.log(
    "Testing SportsDataIO soccer endpoints for date",
    today,
    "mode=",
    mode,
  );

  if (mode === "header" || mode === "both") {
    console.log("\n----- HEADER-ONLY (no ?key) -----");
    for (const ep of endpoints)
      await probe(ep, { useHeader: true, useQuery: false });
  }

  if (mode === "query" || mode === "both") {
    console.log("\n----- QUERY-ONLY (no header) -----");
    for (const ep of endpoints)
      await probe(ep, { useHeader: false, useQuery: true });
  }
})();
