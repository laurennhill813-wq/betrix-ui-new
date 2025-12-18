import fetch from "node-fetch";
import { selectBestSportradarAsset } from "../media/imageSelector.js";

const API_KEY = process.env.SPORTRADAR_API_KEY;

// Fetch a Sportradar event's assets and choose the best asset URL
export async function fetchSportradarEventAssets(eventId) {
  if (!API_KEY) throw new Error("SPORTRADAR_API_KEY not configured");
  if (!eventId) throw new Error("eventId required");

  // This endpoint shape may vary by package; adjust as needed for your subscription
  const url = `https://api.sportradar.com/nfl-images-t3/ap/actionshots/events/${eventId}/assets.json?api_key=${API_KEY}`;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(
      `Sportradar fetch failed ${res.status}: ${txt.slice ? txt.slice(0, 200) : txt}`,
    );
  }

  const json = await res.json().catch(() => ({}));
  // Heuristic: look for arrays named assets/images or a top-level asset list
  const assets = json?.assets || json?.images || json?.asset_list || [];

  // Map to simple URLs if objects are present
  const urls = Array.isArray(assets)
    ? assets
        .map((a) =>
          typeof a === "string"
            ? a
            : (a && (a.url || a.href || a.path)) || null,
        )
        .filter(Boolean)
    : [];

  const bestUrl = selectBestSportradarAsset(urls);
  return { eventId, bestUrl, raw: json };
}

export default { fetchSportradarEventAssets };
