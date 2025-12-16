import { getInterestingEvents } from '../aggregator/multiSportAggregator.js';
import { summarizeEventForTelegram } from '../ai/summarizer.js';
import { selectBestImageForEvent } from '../media/imageSelector.js';
import { sendPhotoWithCaption } from '../services/telegram-sender.js';

const POSTING_COOLDOWN_MS = Number(process.env.MEDIA_AI_COOLDOWN_MS || 5 * 60 * 1000);
let lastPostedAt = 0;

export async function runMediaAiTick() {
  const now = Date.now();
  if (now - lastPostedAt < POSTING_COOLDOWN_MS) return;

  const chatId = process.env.BOT_BROADCAST_CHAT_ID;
  if (!chatId) return console.warn('[MediaAiTicker] BOT_BROADCAST_CHAT_ID not set - skipping tick');

  const events = await getInterestingEvents();
  if (!events || events.length === 0) return console.info('[MediaAiTicker] No interesting events');

  const chosen = events[Math.floor(Math.random() * events.length)];

  const [image, aiSummary] = await Promise.all([
    selectBestImageForEvent(chosen).catch(() => null),
    summarizeEventForTelegram(chosen, 'auto').catch(() => ({ caption: null, tone: null })),
  ]);

  if (!image || !image.imageUrl) return console.warn('[MediaAiTicker] No valid image resolved, skipping post');

  const caption = (aiSummary && aiSummary.caption) ? aiSummary.caption : `**${chosen.home || 'Home'} vs ${chosen.away || 'Away'}**`;

  await sendPhotoWithCaption({ chatId, photoUrl: image.imageUrl, caption }).catch(err => console.error('[MediaAiTicker] sendPhoto failed', err && err.message ? err.message : err));

  console.info('[MediaAiTicker] Posted AI media item', { sport: chosen.sport, league: chosen.league, source: image.source, tone: aiSummary && aiSummary.tone });

  lastPostedAt = now;
}

export default { runMediaAiTick };
