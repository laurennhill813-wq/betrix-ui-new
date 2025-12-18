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
  console.log(
    "Candidates:",
    imgs.map((i) => i.url),
  );
  for (const i of imgs) {
    console.log("Trying", i.url);
    const res = await imageProxy.fetchAndCacheImage(i.url);
    console.log(" ->", res);
    if (res && res.path) break;
  }
})();
