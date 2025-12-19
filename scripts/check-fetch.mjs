import fetch from "../src/lib/fetch.js";
import { getSportradarImages } from "../src/data/images-sportradar.js";

(async () => {
  const imgs = await getSportradarImages({ sport: "soccer" });
  for (const i of imgs) {
    try {
      console.log("HEAD fetch", i.url);
      const res = await fetch(i.url, {
        method: "GET",
        redirect: "manual",
        headers: { "User-Agent": "BetrixBot/1.0" },
        timeout: 15000,
      });
      console.log(
        " -> status",
        res.status,
        "ok?",
        res.ok,
        "ct=",
        res.headers.get("content-type"),
      );
    } catch (e) {
      console.log(" -> fetch error", e && e.message ? e.message : e);
    }
  }
})();
