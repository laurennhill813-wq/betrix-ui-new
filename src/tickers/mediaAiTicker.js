import { getInterestingEvents } from "../aggregator/multiSportAggregator.js";
import { summarizeEventForTelegram } from "../ai/summarizer.js";
import {
  selectBestImageForEvent,
  selectBestImageForEventCombined,
} from "../media/imageSelector.js";
import { sendPhotoWithCaption } from "../services/telegram-sender.js";
import { scoreEvent } from "../brain/interestScorer.js";
import {
  buildEventId,
  hasPostedEvent,
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

  // bump mention counters for short-term trending (only top N to limit writes)
  const toBump = events.slice(0, Number(process.env.MEDIA_AI_BUMP_TOP || 10));
  for (const e of toBump) {
    try {
      const id = e.id || (e.raw && e.raw.id) || null;
      if (id) await bumpEventMention(id).catch(() => null);
    } catch (e) {}
  }

  // Score and rank events, prefer higher scored items and rotate sports
  const scored = await Promise.all(
    events.map(async (ev) => ({ ev, score: (await scoreEvent(ev)) || 0 })),
  );
  scored.sort((a, b) => b.score - a.score);

  // Snapshot top candidates for immediate diagnostics (always log)
  try {
    const topSnapshot = scored.slice(0, 10);
    const snapshotRows = await Promise.all(
      topSnapshot.map(async (r) => {
        const id = r.ev && (r.ev.id || (r.ev.raw && r.ev.raw.id)) ? (r.ev.id || (r.ev.raw && r.ev.raw.id)) : buildEventId(r.ev);
        const dup = await hasPostedEvent(id).catch(() => false);
        return {
          id,
          score: r.score,
          home: r.ev && (r.ev.home || r.ev.homeName || r.ev.home_team) ? (r.ev.home || r.ev.homeName || r.ev.home_team) : null,
          away: r.ev && (r.ev.away || r.ev.awayName || r.ev.away_team) ? (r.ev.away || r.ev.awayName || r.ev.away_team) : null,
          sport: r.ev && r.ev.sport,
          status: r.ev && r.ev.status,
          dup,
        };
      }),
    );
    console.info("[MediaAiTicker] Candidates snapshot:", JSON.stringify(snapshotRows, null, 2));
  } catch (e) {
    console.warn("[MediaAiTicker] failed to produce candidates snapshot", e && e.message ? e.message : e);
  }

  // pick the top candidate that passes thresholds and hasn't been posted recently
  let chosen = null;
  for (const s of scored) {
    // apply sport-priority and time-of-day weighting
    try {
      const sport = s.ev && s.ev.sport ? String(s.ev.sport).toLowerCase() : "";
      const priorities = JSON.parse(
        process.env.MEDIA_SPORT_PRIORITIES ||
          '{"soccer":1,"nba":1.1,"nfl":1.05,"mlb":0.9,"nhl":0.9,"tennis":0.95}',
      );
      const base = Number(priorities[sport] || 1);
      const hour = new Date().getHours();
      const isPrime = hour >= 18 && hour <= 23; // local prime hours
      const tod = isPrime
        ? Number(process.env.MEDIA_TOD_PRIME_MULTIPLIER || 1.15)
        : Number(process.env.MEDIA_TOD_OFF_MULTIPLIER || 1.0);
      s.score = Math.floor(s.score * base * tod);
    } catch (e) {
      /* ignore weighting errors */
    }
      // require a minimal score threshold to avoid low-value posts
      // Lowered to 10 to allow more upcoming fixtures when no live matches exist
      const minScore = Number(process.env.MEDIA_AI_MIN_SCORE || 10);
      if (s.score < minScore) continue;
    const evId = buildEventId(s.ev);
    // consider duplicates only if posted recently (default: 1 hour)
    const dupWindow = Number(process.env.MEDIA_AI_DUP_WINDOW_SECONDS || 3600);
    const already = await hasPostedWithin(evId, dupWindow).catch(() => false);
    if (already) continue;
    chosen = s.ev;
    chosen._score = s.score;
    chosen._eventId = evId;
    break;
  }

  if (!chosen)
    {
      console.info("[MediaAiTicker] No candidate passed scoring/duplication checks");
      // If debug mode enabled, dump top scored candidates and duplication status
      try {
        if (process.env.MEDIA_AI_DEBUG === "1") {
          const top = scored.slice(0, 8);
          const debugRows = await Promise.all(
            top.map(async (r) => {
              const id = r.ev && (r.ev.id || (r.ev.raw && r.ev.raw.id)) ? (r.ev.id || (r.ev.raw && r.ev.raw.id)) : buildEventId(r.ev);
              const dupWindow = Number(process.env.MEDIA_AI_DUP_WINDOW_SECONDS || 3600);
              const dup = await hasPostedWithin(id, dupWindow).catch(() => false);
              return { id, score: r.score, home: r.ev.home, away: r.ev.away, sport: r.ev.sport, dup };
            }),
          );
          console.info("[MediaAiTicker][DEBUG] topCandidates", JSON.stringify(debugRows, null, 2));
        }
      } catch (e) {
        console.warn("[MediaAiTicker] debug dump failed", e && e.message ? e.message : e);
      }
      return;
    }

  const [media, aiSummary] = await Promise.all([
    // try provider adapters (images + videos) first
    selectBestMediaForEventCombined(chosen).catch(() => null),
    summarizeEventForTelegram(chosen, "auto").catch(() => ({
      caption: null,
      tone: null,
    })),
  ]);

  if (!media || !media.mediaUrl) {
    console.warn(
      "[MediaAiTicker] No valid image resolved — attempting text-only fallback",
    );
    try {
      // attempt text-only post via broadcastText
      const captionOnly =
        aiSummary && aiSummary.caption
          ? aiSummary.caption
          : `**${chosen.home || "Home"} vs ${chosen.away || "Away"}**`;
      await broadcastText(captionOnly);
      await telemetry.incCounter("posts_fallback_text");
      console.info("[MediaAiTicker] Posted text-only fallback", {
        sport: chosen.sport,
        league: chosen.league,
        score: chosen._score,
      });
      if (chosen._eventId) {
        try {
          await markEventPosted(chosen._eventId, {
            sport: chosen.sport,
            league: chosen.league,
            fallback: true,
          });
        } catch (e) {}
      }
      lastPostedAt = now;
      return;
    } catch (e) {
      console.error(
        "[MediaAiTicker] text-only fallback failed",
        e && e.message ? e.message : e,
      );
      await telemetry.incCounter("failures");
      return;
    }
  }

  const caption =
    aiSummary && aiSummary.caption
      ? aiSummary.caption
      : `**${chosen.home || "Home"} vs ${chosen.away || "Away"}**`;

    try {
      if (media.type === 'video') {
        await sendVideoWithCaption({ chatId, videoUrl: media.mediaUrl, caption });
        console.info("[MediaAiTicker] Posted AI media video", {
          sport: chosen.sport,
          league: chosen.league,
          source: media.source,
          tone: aiSummary && aiSummary.tone,
          score: chosen._score,
        });
      } else {
        await sendPhotoWithCaption({ chatId, photoUrl: media.mediaUrl, caption });
        console.info("[MediaAiTicker] Posted AI media item", {
          sport: chosen.sport,
          league: chosen.league,
          source: media.source,
          tone: aiSummary && aiSummary.tone,
          score: chosen._score,
        });
      }
    await telemetry.incCounter("posts");
    // mark as posted in memory to avoid duplicates
    if (chosen._eventId) {
      try {
        await markEventPosted(chosen._eventId, {
          sport: chosen.sport,
          league: chosen.league,
        });
      } catch (e) {}
    }
    lastPostedAt = now;
  } catch (err) {
    console.error(
      "[MediaAiTicker] sendPhoto failed",
      err && err.message ? err.message : err,
    );
    await telemetry.incCounter("failures");
  }
}

export default { runMediaAiTick };
