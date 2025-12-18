import fetch from "node-fetch";

const url = process.argv[2];
if (!url) {
  console.error("Usage: node check-fetch-headers.mjs <url>");
  process.exit(1);
}

async function tryFetch(hdrs) {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: hdrs,
      timeout: 15000,
    });
    console.log(
      "headers",
      hdrs,
      "->",
      res.status,
      res.ok,
      "ct=",
      res.headers.get("content-type"),
    );
  } catch (e) {
    console.log("headers", hdrs, "-> error", e && e.message);
  }
}

(async () => {
  await tryFetch({ "User-Agent": "BetrixBot/1.0", Accept: "image/*" });
  await tryFetch({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    Accept: "image/*",
  });
  await tryFetch({
    "User-Agent": "BetrixBot/1.0",
    Accept: "image/*",
    Referer: "https://api.sportradar.com/",
  });
  await tryFetch({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    Accept: "image/*",
    Referer: "https://api.sportradar.com/",
  });
})();
