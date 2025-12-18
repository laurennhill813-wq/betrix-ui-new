import mediaAggregator from "../services/media-aggregator.js";
import { sendPhotoWithCaption } from "../services/telegram-sender.js";
import { canPostNow, markPosted } from "../lib/liveliness.js";

const SPORTS_ROTATION = (process.env.SPORTS_ROTATION &&
  process.env.SPORTS_ROTATION.split(",")) || ["soccer", "nba", "nfl", "tennis"];

function pickRotatingSport() {
  const idx =
    Math.floor(Date.now() / (10 * 60 * 1000)) % SPORTS_ROTATION.length;
  return SPORTS_ROTATION[idx];
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
