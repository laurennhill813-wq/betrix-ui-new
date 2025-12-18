import dotenv from "dotenv";
import path from "path";
import fetch from "node-fetch";

for (const f of [".env.local.fixed", ".env.local", ".env"]) {
  try {
    dotenv.config({ path: path.resolve(process.cwd(), f) });
  } catch (_) {}
}

const KEY = process.env.SPORTSGAMEODDS_API_KEY;
const BASE =
  process.env.SPORTSGAMEODDS_API_BASE ||
  process.env.SPORTSGAMEODDS_BASE ||
  "https://api.sportsgameodds.com/v2";

async function probe(path) {
  const url = `${BASE}${path}`;
  console.log("Requesting", url);
  const res = await fetch(url, {
    headers: { "X-API-Key": KEY, Accept: "application/json" },
    timeout: 20000,
  });
  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Body:", text.substring(0, 2000));
}

(async () => {
  await probe("/odds/football");
  await probe("/odds/nba");
  await probe("/odds/mlb");
  process.exit(0);
})();
