import { broadcastPhoto } from '../telegram/broadcast.js';

const TICKER_ENABLED = String(process.env.MEDIA_TICKER_ENABLED || 'false').toLowerCase() === 'true';
const TICKER_INTERVAL_MINUTES = Number(process.env.MEDIA_TICKER_INTERVAL_MINUTES || 60);

async function getNextMediaItem() {
  // TODO: replace with real media selection/AI generation
  return {
    photoUrl: process.env.SAMPLE_MEDIA_URL || 'https://via.placeholder.com/1024x512.png?text=BETRIX+Highlight',
    caption: process.env.SAMPLE_MEDIA_CAPTION || '🔥 BETRIX Highlight — stay tuned for more!'
  };
}

export async function runMediaTickerCycle() {
  if (!TICKER_ENABLED) return;
  try {
    const item = await getNextMediaItem();
    if (!item || !item.photoUrl) return;
    await broadcastPhoto(item.photoUrl, item.caption);
    console.log('[MediaTicker] Posted media item');
  } catch (e) {
    console.error('[MediaTicker] Error', e?.message || e);
  }
}

export function startMediaTickerScheduler(cron) {
  if (!TICKER_ENABLED) {
    console.log('[MediaTicker] Disabled (MEDIA_TICKER_ENABLED != true)');
    return;
  }
  const expr = `*/${Math.max(1, TICKER_INTERVAL_MINUTES)} * * * *`;
  console.log('[MediaTicker] Starting scheduler with cron:', expr);
  cron.schedule(expr, () => { runMediaTickerCycle(); });
}

export default { runMediaTickerCycle, startMediaTickerScheduler };
