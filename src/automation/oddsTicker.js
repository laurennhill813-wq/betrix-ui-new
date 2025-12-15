import { broadcastText } from '../telegram/broadcast.js';
import SportsAggregator from '../services/sports-aggregator.js';

const ODDS_TICKER_ENABLED = String(process.env.ODDS_TICKER_ENABLED || 'false').toLowerCase() === 'true';

async function getUpcomingMatchesWithOdds() {
  // Try to reuse existing SportsAggregator if available
  try {
    if (typeof SportsAggregator === 'function') {
      const agg = new SportsAggregator();
      if (typeof agg.getUpcomingWithOdds === 'function') return await agg.getUpcomingWithOdds();
    }
  } catch (e) { /* ignore */ }
  return [];
}

export async function runOddsTickerCycle() {
  if (!ODDS_TICKER_ENABLED) return;
  try {
    const matches = await getUpcomingMatchesWithOdds();
    if (!matches || matches.length === 0) return;
    const lines = matches.slice(0, 10).map(m => `• <b>${m.home} vs ${m.away}</b>\n  ${m.oddsSummary || m.odds || ''}`);
    const text = ['🎯 <b>Upcoming Odds</b>', '', ...lines, '', 'More odds live inside BETRIX.'].join('\n');
    await broadcastText(text);
    console.log('[OddsTicker] Posted odds summary');
  } catch (e) {
    console.error('[OddsTicker] Error', e?.message || e);
  }
}

export function startOddsTickerScheduler(cron) {
  if (!ODDS_TICKER_ENABLED) {
    console.log('[OddsTicker] Disabled (ODDS_TICKER_ENABLED != true)');
    return;
  }
  const expr = '0 * * * *';
  console.log('[OddsTicker] Starting scheduler with cron:', expr);
  cron.schedule(expr, () => { runOddsTickerCycle(); });
}

export default { runOddsTickerCycle, startOddsTickerScheduler };
