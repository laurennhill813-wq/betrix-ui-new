import { broadcastText } from '../telegram/broadcast.js';
import SportsAggregator from '../services/sports-aggregator.js';

const FIXTURES_TICKER_ENABLED = String(process.env.FIXTURES_TICKER_ENABLED || 'false').toLowerCase() === 'true';

async function getTodayFixtures() {
  try {
    if (typeof SportsAggregator === 'function') {
      const agg = new SportsAggregator();
      if (typeof agg.getTodayFixtures === 'function') return await agg.getTodayFixtures();
    }
  } catch (e) { /* ignore */ }
  return [];
}

export async function runFixturesTickerCycle() {
  if (!FIXTURES_TICKER_ENABLED) return;
  try {
    const fixtures = await getTodayFixtures();
    if (!fixtures || fixtures.length === 0) return;
    const lines = fixtures.slice(0, 20).map(f => `• <b>${f.home} vs ${f.away}</b> — ${f.kickoffLocal || f.kickoff || ''}`);
    const text = ['📅 <b>Today’s Matches</b>', '', ...lines, '', 'Stay tuned — more updates live.'].join('\n');
    await broadcastText(text);
    console.log('[FixturesTicker] Posted today’s fixtures');
  } catch (e) {
    console.error('[FixturesTicker] Error', e?.message || e);
  }
}

export function startFixturesTickerScheduler(cron) {
  if (!FIXTURES_TICKER_ENABLED) {
    console.log('[FixturesTicker] Disabled (FIXTURES_TICKER_ENABLED != true)');
    return;
  }
  const expr = '0 7 * * *';
  console.log('[FixturesTicker] Starting scheduler with cron:', expr);
  cron.schedule(expr, () => { runFixturesTickerCycle(); });
}

export default { runFixturesTickerCycle, startFixturesTickerScheduler };
