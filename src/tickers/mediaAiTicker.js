import { getInterestingEvents } from "../aggregator/multiSportAggregator.js";
import { summarizeEventForTelegram } from "../ai/summarizer.js";
import {
  selectBestImageForEvent,
  selectBestImageForEventCombined,
  selectBestMediaForEventCombined,
} from "../media/imageSelector.js";
import { sendPhotoWithCaption, sendVideoWithCaption } from "../services/telegram-sender.js";
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
      topSnapshot.map(async (r) => {
        const id = r.ev && (r.ev.id || (r.ev.raw && r.ev.raw.id)) ? (r.ev.id || (r.ev.raw && r.ev.raw.id)) : buildEventId(r.ev);
        const isUpcoming = String(r.ev.status || "").toUpperCase() === "TIMED";
        const dupWindow = isUpcoming ? 600 : 3600;
        const dup = await hasPostedWithin(id, dupWindow).catch(() => false);
        return {
          id,
          score: r.score,
          home: r.ev && (r.ev.home || r.ev.homeName || r.ev.home_team),
          away: r.ev && (r.ev.away || r.ev.awayName || r.ev.away_team),
          sport: r.ev && r.ev.sport,
          status: r.ev && r.ev.status,
          dup,
        };
      }),
    );
    console.info("[MediaAiTicker] Candidates snapshot:", JSON.stringify(snapshotRows, null, 2));
  } catch (e) {
    console.warn("[MediaAiTicker] snapshot failed", e && e.message);
  }

  // Pick best candidate
  let chosen = null;
  for (const s of scored) {
    try {
      const sport = s.ev && s.ev.sport ? String(s.ev.sport).toLowerCase() : "";
      const priorities = JSON.parse(
        process.env.MEDIA_SPORT_PRIORITIES ||
          '{"soccer":1,"nba":1.1,"nfl":1.05,"mlb":0.9,"nhl":0.9,"tennis":0.95}',
      );
      const base = Number(priorities[sport] || 1);
      const hour = new Date().getHours();
      const isPrime = hour >= 18 && hour <= 23;
      const tod = isPrime ? 1.15 : 1.0;
      s.score = Math.floor(s.score * base * tod);
    } catch (e) {}

    const minScore = Number(process.env.MEDIA_AI_MIN_SCORE || 10);
    if (s.score < minScore) continue;

    const evId = buildEventId(s.ev);
    // Use shorter window for upcoming fixtures to allow rotation
    const isUpcoming = String(s.ev.status || "").toUpperCase() === "TIMED";
    const dupWindow = isUpcoming
      ? Number(process.env.MEDIA_AI_DUP_WINDOW_UPCOMING_SECONDS || 600)
      : Number(process.env.MEDIA_AI_DUP_WINDOW_SECONDS || 3600);
    const already = await hasPostedWithin(evId, dupWindow).catch(() => false);
    if (already) continue;

    chosen = s.ev;
    chosen._score = s.score;
    chosen._eventId = evId;
    break;
  }

  if (!chosen) {
    console.info("[MediaAiTicker] No candidate passed checks");
    return;
  }

  console.info("[MediaAiTicker] Selected event", {
    home: chosen.home,
    away: chosen.away,
    sport: chosen.sport,
    score: chosen._score,
  });

  // Fetch media and caption
  const [media, aiSummary] = await Promise.all([
    selectBestMediaForEventCombined(chosen).catch(() => null),
    summarizeEventForTelegram(chosen, "conversational").catch(() => ({
      caption: null,
      tone: null,
    })),
  ]);

  console.info("[MediaAiTicker] Media fetch result", {
    found: !!media,
    type: media?.type,
    source: media?.source,
  });

  // If main media selector failed, try basic image fallback
  let finalMedia = media;
  if (!finalMedia) {
    console.info("[MediaAiTicker] Trying basic image fallback");
    finalMedia = await selectBestImageForEventCombined(chosen).catch(() => null);
    if (finalMedia) {
      console.info("[MediaAiTicker] Basic image fallback succeeded");
      finalMedia = { mediaUrl: finalMedia.imageUrl, type: "image", source: finalMedia.source };
    }
  }

  if (!finalMedia || !finalMedia.mediaUrl) {
    console.warn("[MediaAiTicker] No media found — posting text-only");
    try {
      const captionOnly =
        aiSummary && aiSummary.caption
          ? aiSummary.caption
          : `**${chosen.home || "Home"} vs ${chosen.away || "Away"}**`;
      await broadcastText(captionOnly);
      await telemetry.incCounter("posts_fallback_text");
      console.info("[MediaAiTicker] Posted text fallback", {
        sport: chosen.sport,
        league: chosen.league,
      });
      // Don't mark TIMED as posted so it can rotate in future ticks
      const isUpcoming = String(chosen.status || "").toUpperCase() === "TIMED";
      if (chosen._eventId && !isUpcoming) {
        await markEventPosted(chosen._eventId, { fallback: true }).catch(() => {});
      }
      lastPostedAt = now;
      return;
    } catch (e) {
      console.error("[MediaAiTicker] text fallback failed", e && e.message);
      await telemetry.incCounter("failures");
      return;
    }
  }

  const caption =
    aiSummary && aiSummary.caption
      ? aiSummary.caption
      : `**${chosen.home || "Home"} vs ${chosen.away || "Away"}**`;

  try {
    if (finalMedia.type === "video") {
      await sendVideoWithCaption({ chatId, videoUrl: finalMedia.mediaUrl, caption });
      console.info("[MediaAiTicker] Posted video", {
        sport: chosen.sport,
        league: chosen.league,
        source: finalMedia.source,
      });
    } else {
      await sendPhotoWithCaption({ chatId, photoUrl: finalMedia.mediaUrl, caption });
      console.info("[MediaAiTicker] Posted image", {
        sport: chosen.sport,
        league: chosen.league,
        source: finalMedia.source,
      });
    }
    await telemetry.incCounter("posts");
    // Mark as posted
    if (chosen._eventId) {
      await markEventPosted(chosen._eventId, {
        sport: chosen.sport,
        league: chosen.league,
      }).catch(() => {});
    }
    lastPostedAt = now;
  } catch (err) {
    console.error("[MediaAiTicker] send failed", err && err.message);
    await telemetry.incCounter("failures");
  }
}

export default { runMediaAiTick };
