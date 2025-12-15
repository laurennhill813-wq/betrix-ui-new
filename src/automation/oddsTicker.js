import { broadcastText } from '../telegram/broadcast.js';

const ODDS_TICKER_ENABLED = String(process.env.ODDS_TICKER_ENABLED || 'false').toLowerCase() === 'true';

// The module expects an instantiated sportsAggregator to be injected by the
// worker process. This avoids creating new aggregator instances and reusing
// the cached, prefetch-enabled aggregator already running in the worker.
let aggInstance = null;

export function setAggregator(aggregator) {
  aggInstance = aggregator;
}

export async function runOddsTickerCycle() {
  if (!ODDS_TICKER_ENABLED) return;
  try {
    if (!aggInstance || typeof aggInstance.getUpcomingWithOdds !== 'function') {
      console.warn('[OddsTicker] No aggregator available or method missing; skipping cycle');
      return;
    }
    const matches = await aggInstance.getUpcomingWithOdds();
    if (!matches || matches.length === 0) return;
    const lines = matches.slice(0, 10).map(m => `• <b>${m.home} vs ${m.away}</b>\n  ${m.oddsSummary || m.odds || ''}`);
    const text = ['🎯 <b>Upcoming Odds</b>', '', ...lines, '', 'More odds live inside BETRIX.'].join('\n');
    await broadcastText(text);
    console.log('[OddsTicker] Posted odds summary');
  } catch (e) {
    console.error('[OddsTicker] Error', e?.message || e);
  }
}

export function startOddsTickerScheduler(cron, aggregator) {
  if (aggregator) setAggregator(aggregator);
  if (!ODDS_TICKER_ENABLED) {
    console.log('[OddsTicker] Disabled (ODDS_TICKER_ENABLED != true)');
    return;
  }
  const expr = '0 * * * *';
  console.log('[OddsTicker] Starting scheduler with cron:', expr);
  cron.schedule(expr, () => { runOddsTickerCycle(); });
}

export default { runOddsTickerCycle, startOddsTickerScheduler, setAggregator };
