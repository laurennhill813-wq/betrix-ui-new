// ESM version of mediaAiTicker.js
import { getInterestingEvents } from "../aggregator/multiSportAggregator.js";
import { summarizeEventForTelegram } from "../ai/summarizer.js";
import { generateHashtags } from "../ai/openaiHashtags.js";
import {
  selectBestImageForEvent,
  selectBestImageForEventCombined,
  selectBestMediaForEventCombined,
} from "../media/imageSelector.js";
import { generateDalleImage } from "../ai/openaiDalle.js";
import { sendPhotoWithCaption, sendVideoWithCaption } from "../services/telegram-sender.js";
import { queuePostForApproval } from "../services/adminPostQueue.js";
import { sendTelegramAdminAlert } from "../services/adminAlert.js";
import { scoreEvent } from "../brain/interestScorer.js";
import {
  buildEventId,
  hasPostedWithin,
  markEventPosted,
} from "../brain/memory.js";
import { bumpEventMention } from "../brain/trending.js";
import telemetry from "../brain/telemetry.js";
import { broadcastText } from "../telegram/broadcast.js";

const POSTING_COOLDOWN_MS = Number(
  process.env.MEDIA_AI_COOLDOWN_MS || 30 * 1000,
);
let lastPostedAt = 0;

export async function runMediaAiTick() {
  const now = Date.now();
  if (now - lastPostedAt < POSTING_COOLDOWN_MS) return;

  const chatId = process.env.BOT_BROADCAST_CHAT_ID;
  if (!chatId)
    return console.warn(
      "[MediaAiTicker] BOT_BROADCAST_CHAT_ID not set - skipping tick",
    );

  const events = await getInterestingEvents();
  if (!events || events.length === 0)
    return console.info("[MediaAiTicker] No interesting events");

  // bump mention counters for short-term trending
  const toBump = events.slice(0, Number(process.env.MEDIA_AI_BUMP_TOP || 10));
  for (const e of toBump) {
    try {
      const id = e.id || (e.raw && e.raw.id) || null;
      if (id) await bumpEventMention(id).catch(() => null);
    } catch (e) {}
  }

  // Score and rank events
  const scored = await Promise.all(
    events.map(async (ev) => ({ ev, score: (await scoreEvent(ev)) || 0 })),
  );
  scored.sort((a, b) => b.score - a.score);

  // Log candidate snapshot
  try {
    const topSnapshot = scored.slice(0, 10);
    const snapshotRows = await Promise.all(
      topSnapshot.map(async ({ ev, score }) => {
        const summary = await summarizeEventForTelegram(ev);
        return `${score}\t${summary}`;
      })
    );
    telemetry.log("mediaAiTicker.candidates", snapshotRows.join("\n"));
  } catch (e) {
    console.warn("[MediaAiTicker] Error logging snapshot", e);
  }

  // ...rest of the code remains unchanged...
}

export default {
  runMediaAiTick,
};
