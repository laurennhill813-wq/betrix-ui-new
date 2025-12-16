import { getInterestingEvents } from '../aggregator/multiSportAggregator.js';
import { summarizeEventForTelegram } from '../ai/summarizer.js';
import { selectBestImageForEvent } from '../media/imageSelector.js';
import { sendPhotoWithCaption } from '../services/telegram-sender.js';
import { scoreEvent } from '../brain/interestScorer.js';
import { buildEventId, hasPostedEvent, markEventPosted } from '../brain/memory.js';

const POSTING_COOLDOWN_MS = Number(process.env.MEDIA_AI_COOLDOWN_MS || 5 * 60 * 1000);
let lastPostedAt = 0;

export async function runMediaAiTick() {
  const now = Date.now();
  if (now - lastPostedAt < POSTING_COOLDOWN_MS) return;

  const chatId = process.env.BOT_BROADCAST_CHAT_ID;
  if (!chatId) return console.warn('[MediaAiTicker] BOT_BROADCAST_CHAT_ID not set - skipping tick');

  const events = await getInterestingEvents();
  if (!events || events.length === 0) return console.info('[MediaAiTicker] No interesting events');

  // Score and rank events, prefer higher scored items and rotate sports
  const scored = events.map(ev => ({ ev, score: scoreEvent(ev) || 0 }));
  scored.sort((a,b) => b.score - a.score);

  // pick the top candidate that passes thresholds and hasn't been posted recently
  let chosen = null;
  for (const s of scored) {
    // require a minimal score threshold to avoid low-value posts
    if (s.score < Number(process.env.MEDIA_AI_MIN_SCORE || 40)) continue;
    const evId = buildEventId(s.ev);
    const already = await hasPostedEvent(evId).catch(() => false);
    if (already) continue;
    chosen = s.ev;
    chosen._score = s.score;
    chosen._eventId = evId;
    break;
  }

  if (!chosen) return console.info('[MediaAiTicker] No candidate passed scoring/duplication checks');

  const [image, aiSummary] = await Promise.all([
    selectBestImageForEvent(chosen).catch(() => null),
    summarizeEventForTelegram(chosen, 'auto').catch(() => ({ caption: null, tone: null })),
  ]);

  if (!image || !image.imageUrl) return console.warn('[MediaAiTicker] No valid image resolved, skipping post');

  const caption = (aiSummary && aiSummary.caption) ? aiSummary.caption : `**${chosen.home || 'Home'} vs ${chosen.away || 'Away'}**`;

  try {
    await sendPhotoWithCaption({ chatId, photoUrl: image.imageUrl, caption });
    console.info('[MediaAiTicker] Posted AI media item', { sport: chosen.sport, league: chosen.league, source: image.source, tone: aiSummary && aiSummary.tone, score: chosen._score });
    // mark as posted in memory to avoid duplicates
    if (chosen._eventId) {
      try { await markEventPosted(chosen._eventId, { sport: chosen.sport, league: chosen.league }); } catch (e) {}
    }
    lastPostedAt = now;
  } catch (err) {
    console.error('[MediaAiTicker] sendPhoto failed', err && err.message ? err.message : err);
  }
}

export default { runMediaAiTick };
