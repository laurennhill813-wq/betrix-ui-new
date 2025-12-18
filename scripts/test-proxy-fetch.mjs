import { getSportradarImages } from "../src/data/images-sportradar.js";
import imageProxy from "../src/services/image-proxy.js";

const KEY = process.env.SPORTRADAR_API_KEY || null;
if (!KEY) {
  console.error("Missing SPORTRADAR_API_KEY");
  process.exit(1);
}

(async () => {
  const ev = { sport: "soccer" };
  const imgs = await getSportradarImages(ev);
  console.log("Candidates:", imgs);
  if (!imgs || imgs.length === 0) return;
  const url = imgs[0].url;
  console.log("Attempting proxy fetch for", url);
  const res = await imageProxy.fetchAndCacheImage(url);
  console.log("Proxy result:", res);
})();
