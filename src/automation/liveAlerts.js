import { broadcastText, broadcastPhoto } from '../telegram/broadcast.js';

const LIVE_ALERTS_ENABLED = String(process.env.LIVE_ALERTS_ENABLED || 'false').toLowerCase() === 'true';

let lastEventIds = new Set();
let aggInstance = null;

export function setAggregator(aggregator) {
  aggInstance = aggregator;
}

async function getLiveMatchesWithEvents() {
  try {
    if (!aggInstance || typeof aggInstance.getLiveMatchesWithEvents !== 'function') return [];
    return await aggInstance.getLiveMatchesWithEvents();
  } catch (e) { /* ignore */ }
  return [];
}

export async function runLiveAlertsCycle() {
  if (!LIVE_ALERTS_ENABLED) return;
  try {
    const matches = await getLiveMatchesWithEvents();
    if (!matches || matches.length === 0) return;
    for (const match of matches) {
      for (const ev of match.newEvents || []) {
        const key = `${match.id}:${ev.id || ev.minute}:${ev.type}`;
        if (lastEventIds.has(key)) continue;
        lastEventIds.add(key);
        let icon = '⚽';
        if (ev.type === 'goal') icon = '⚽';
        else if (ev.type === 'red_card') icon = '🟥';
        else if (ev.type === 'kickoff') icon = '🚨';
        else if (ev.type === 'ft') icon = '✅';
        const text = [`${icon} <b>${match.home} ${match.scoreHome || 0} — ${match.scoreAway || 0} ${match.away}</b>`, ev.minute ? `⏱️ ${ev.minute}' ${ev.description || ev.type}` : ev.description || ev.type].join('\n');

        // Prefer sending a photo when the event provides one (or use team logos/thumbnails).
        const imageUrl = ev?.imageUrl || ev?.thumbnail || match?.thumbnail || match?.homeLogo || match?.awayLogo || null;
        try {
          if (imageUrl) {
            const caption = (ev && ev.caption) ? `${ev.caption}\n\n${text}` : text;
            const res = await broadcastPhoto(imageUrl, caption);
            if (res) {
              console.log('[LiveAlerts] Posted live event with photo', key, imageUrl);
              continue; // move to next event after successful photo post
            }
            // fallthrough: if broadcastPhoto returned null, send text fallback
          }
        } catch (e) {
          console.error('[LiveAlerts] broadcastPhoto error', e?.message || e);
        }

        // Fallback to text-only broadcast
        await broadcastText(text);
        console.log('[LiveAlerts] Posted live event (text)', key);
      }
    }
  } catch (e) {
    console.error('[LiveAlerts] Error', e?.message || e);
  }
}

export function startLiveAlertsScheduler(cron, aggregator) {
  if (aggregator) setAggregator(aggregator);
  if (!LIVE_ALERTS_ENABLED) {
    console.log('[LiveAlerts] Disabled (LIVE_ALERTS_ENABLED != true)');
    return;
  }
  const expr = '* * * * *';
  console.log('[LiveAlerts] Starting scheduler with cron:', expr);
  cron.schedule(expr, () => { runLiveAlertsCycle(); });
}

export default { runLiveAlertsCycle, startLiveAlertsScheduler, setAggregator };
