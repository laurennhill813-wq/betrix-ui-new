import fetch from "../lib/fetch.js";

const KEY = process.env.SPORTSGAMEODDS_API_KEY;
const BASE =
  process.env.SPORTSGAMEODDS_API_BASE ||
  process.env.SPORTSGAMEODDS_BASE ||
  "https://api.sportsgameodds.com/v2";

// Safe request helper for SGO: returns { status, ok, body }
export async function sgo(path) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    headers: { "X-API-Key": KEY, Accept: "application/json" },
    timeout: 20000,
  });
  const ct = res.headers.get("content-type") || "";
  let body = null;
  try {
    if (ct.includes("application/json")) body = await res.json();
    else body = await res.text();
  } catch (e) {
    body = await res.text().catch(() => null);
  }
  return { status: res.status, ok: res.ok, body };
}
