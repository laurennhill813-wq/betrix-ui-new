import mediaAggregator from "../services/media-aggregator.js";
import { sendPhotoWithCaption } from "../services/telegram-sender.js";
import { canPostNow, markPosted } from "../lib/liveliness.js";
import { getUpcomingFixtures, sportEmoji } from "../services/sportradar-client.js";
import { cacheGet, cacheSet } from "../lib/redis-cache.js";

const DEFAULT_ROTATION = ["soccer", "nba", "nfl", "tennis", "mlb", "nhl", "nascar"];

async function pickRotatingSport() {
  // Check for explicit env override first
  const env = process.env.SPORTS_ROTATION;
  let list = env && env.split(",").filter(Boolean);
  // If no env, try cache of available sports
  if (!list || list.length === 0) {
    try {
      const cached = await cacheGet("ticker:available_sports");
      if (cached && Array.isArray(cached)) list = cached;
    } catch (e) {
      void e;
    }
  }
  // If still not set, probe default candidates for availability
  if (!list || list.length === 0) {
    list = [];
    for (const s of DEFAULT_ROTATION) {
      try {
        const fixtures = await getUpcomingFixtures(s, {});
        if (fixtures && fixtures.length > 0) list.push(s);
      } catch (e) {
        // ignore failures
        continue;
      }
    }
    // cache the discovered list for 10 minutes
    try {
      await cacheSet("ticker:available_sports", list, 600);
    } catch (e) {
      void e;
    }
  }

  if (!list || list.length === 0) list = DEFAULT_ROTATION;

  const idx = Math.floor(Date.now() / (10 * 60 * 1000)) % list.length;
  return list[idx];
}

function buildCaption(media) {
  const leaguePart = media.league ? ` • ${media.league}` : "";
  const titlePart = media.title ? `\n${media.title}` : "";
  return `🔥 ${media.sport || "Sports"}${leaguePart}${titlePart}\n\nPowered by BETRIX.`;
}

export async function runAutoMediaTick() {
  const chatId = process.env.BOT_BROADCAST_CHAT_ID;
  if (!chatId)
    return console.warn(
      "BOT_BROADCAST_CHAT_ID not set - skipping auto-media tick",
    );

  try {
    const ok = await canPostNow();
    if (!ok)
      return console.info("Skipping auto-media tick due to liveliness policy");

    const sport = pickRotatingSport();
    const media = await mediaAggregator.fetchRandomMediaItem({ sport });
    if (!media) return console.warn(`No media returned for sport=${sport}`);

    const caption = buildCaption(media);
    await sendPhotoWithCaption({ chatId, photoUrl: media.url, caption });
    await markPosted();
  } catch (err) {
    console.error(
      "runAutoMediaTick failed",
      err && err.message ? err.message : err,
    );
  }
}

export default { runAutoMediaTick };
