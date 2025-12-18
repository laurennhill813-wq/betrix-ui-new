import axios from "axios";
import { sendPhotoWithCaption } from "../src/services/telegram-sender.js";

const BASE = process.env.SPORTRADAR_BASE || "https://api.sportradar.com";
const KEY =
  process.env.SPORTRADAR_API_KEY || process.env.IMAGE_SERVICE_KEY || null;
const CHAT =
  process.env.TEST_CHAT_ID || process.env.BOT_BROADCAST_CHAT_ID || null;

if (!KEY) {
  console.error("Missing SPORTRADAR_API_KEY (set env var)");
  process.exit(1);
}
if (!CHAT) {
  console.error("Missing TEST_CHAT_ID or BOT_BROADCAST_CHAT_ID");
  process.exit(1);
}

async function fetchManifest() {
  // Use the country flags manifest as a simple test manifest that's broadly available
  const manifestUrl = `${BASE.replace(/\/+$/, "")}/flags-images-t3/sr/country-flags/flags/manifest.xml?api_key=${KEY}`;
  console.log("Fetching manifest", manifestUrl);
  const resp = await axios.get(manifestUrl, { timeout: 10000 });
  return resp.data;
}

function extractImageHrefFromManifest(xml) {
  // crude but effective: find first <link ... href="/...jpg"/> occurrence
  const m = xml.match(/<link[^>]+href=["']([^"']+\.(?:jpg|jpeg|png|svg))["']/i);
  if (m && m[1]) return m[1];
  return null;
}

(async function run() {
  try {
    const xml = await fetchManifest();
    const href = extractImageHrefFromManifest(xml);
    if (!href) {
      console.error("No image href found in manifest");
      process.exit(1);
    }

    // Build full URL
    let imageUrl = href.startsWith("http")
      ? href
      : `${BASE.replace(/\/+$/, "")}${href}`;
    // Append api_key if not present
    if (!imageUrl.includes("api_key=")) {
      imageUrl += (imageUrl.includes("?") ? "&" : "?") + `api_key=${KEY}`;
    }

    console.log("Resolved image URL:", imageUrl);

    // Attempt to post image to Telegram chat
    await sendPhotoWithCaption({
      chatId: CHAT,
      photoUrl: imageUrl,
      caption: "Sportradar test image (flags manifest)",
    });
    console.log("Posted image (or attempted). Check channel.");
  } catch (e) {
    console.error("Test failed", e && e.message ? e.message : e);
    process.exit(1);
  }
})();
