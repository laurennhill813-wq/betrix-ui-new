/**
 * Automatic Prefetch & Fixture System
 * 
 * Runs on startup and periodically to:
 * - Prefetch all sports data
 * - Update fixtures in real-time
 * - Keep cache fresh
 * - Ensure bot is always responsive
 */

import SportsDataAggregator from '../services/sports-data-aggregator.js';

const logger = {
  info: (msg) => console.log(`[Prefetch] ${msg}`),
  error: (msg) => console.error(`[Prefetch] ❌ ${msg}`),
  success: (msg) => console.log(`[Prefetch] ✅ ${msg}`)
};

// Cache tracking
let prefetchState = {
  lastUpdate: null,
  nflTeams: null,
  plTeams: null,
  fixtures: null,
  leagues: null,
  isRunning: false,
  errorCount: 0
};

// ============================================
// PREFETCH ALL DATA
// ============================================

export async function prefetchAllSportsData() {
  if (prefetchState.isRunning) {
    logger.info('Prefetch already running, skipping...');
    return;
  }

  prefetchState.isRunning = true;
  const startTime = Date.now();

  try {
    logger.info('Starting comprehensive prefetch...');

    // Fetch all data in parallel
    const [nflTeams, plTeams, fixtures, leagues, odds] = await Promise.all([
      SportsDataAggregator.getNFLTeams().catch(err => ({
        success: false,
        error: err.message
      })),
      SportsDataAggregator.getPremierLeagueTeams().catch(err => ({
        success: false,
        error: err.message
      })),
      SportsDataAggregator.getFixtures().catch(err => ({
        success: false,
        error: err.message
      })),
      SportsDataAggregator.getBet365Leagues().catch(err => ({
        success: false,
        error: err.message
      })),
      SportsDataAggregator.getPinnacleOdds().catch(err => ({
        success: false,
        error: err.message
      }))
    ]);

    // Store results
    prefetchState.nflTeams = nflTeams;
    prefetchState.plTeams = plTeams;
    prefetchState.fixtures = fixtures;
    prefetchState.leagues = leagues;
    prefetchState.lastUpdate = new Date();

    // Calculate results
    const elapsed = Date.now() - startTime;
    const successful = [nflTeams, plTeams, fixtures, leagues, odds].filter(r => r.success).length;
    const total = 5;

    logger.success(`Prefetch complete: ${successful}/${total} sources ready (${elapsed}ms)`);

    if (nflTeams.success) logger.info(`  • NFL Teams: ${nflTeams.count}`);
    if (plTeams.success) logger.info(`  • Premier League: ${plTeams.count}`);
    if (fixtures.success) logger.info(`  • Fixtures: ${fixtures.count}`);
    if (leagues.success) logger.info(`  • Leagues: ${leagues.count}`);
    if (odds.success) logger.info(`  • Odds Sources: ${odds.count}`);

    prefetchState.errorCount = 0;

    return {
      success: true,
      timestamp: prefetchState.lastUpdate,
      dataLoaded: {
        nflTeams: nflTeams.success ? nflTeams.count : 0,
        plTeams: plTeams.success ? plTeams.count : 0,
        fixtures: fixtures.success ? fixtures.count : 0,
        leagues: leagues.success ? leagues.count : 0
      }
    };
  } catch (err) {
    prefetchState.errorCount++;
    logger.error(`Prefetch failed: ${err.message}`);

    return {
      success: false,
      error: err.message,
      errorCount: prefetchState.errorCount
    };
  } finally {
    prefetchState.isRunning = false;
  }
}

// ============================================
// SCHEDULED UPDATES
// ============================================

let prefetchIntervals = [];

export function startScheduledPrefetch() {
  logger.info('Starting scheduled prefetch service...');

  // Full prefetch every hour
  const fullPrefetchInterval = setInterval(async () => {
    await prefetchAllSportsData();
  }, 3600000); // 1 hour

  // Live data refresh every 5 minutes
  const liveDataInterval = setInterval(async () => {
    try {
      await SportsDataAggregator.getFixtures();
      logger.info('Live fixtures refreshed');
    } catch (err) {
      logger.error(`Live refresh failed: ${err.message}`);
    }
  }, 300000); // 5 minutes

  // Odds update every 2 minutes
  const oddsInterval = setInterval(async () => {
    try {
      await SportsDataAggregator.getPinnacleOdds();
      logger.info('Odds refreshed');
    } catch (err) {
      logger.error(`Odds refresh failed: ${err.message}`);
    }
  }, 120000); // 2 minutes

  prefetchIntervals = [fullPrefetchInterval, liveDataInterval, oddsInterval];
  logger.success('Scheduled prefetch service started');

  return {
    full: fullPrefetchInterval,
    live: liveDataInterval,
    odds: oddsInterval
  };
}

export function stopScheduledPrefetch() {
  prefetchIntervals.forEach(interval => clearInterval(interval));
  prefetchIntervals = [];
  logger.info('Scheduled prefetch service stopped');
}

// ============================================
// GET PREFETCH STATUS
// ============================================

export function getPrefetchStatus() {
  const age = prefetchState.lastUpdate 
    ? Math.round((Date.now() - prefetchState.lastUpdate.getTime()) / 1000)
    : null;

  return {
    lastUpdate: prefetchState.lastUpdate,
    ageSeconds: age,
    isStale: age && age > 3600, // Older than 1 hour
    dataLoaded: {
      nflTeams: prefetchState.nflTeams?.count || 0,
      plTeams: prefetchState.plTeams?.count || 0,
      fixtures: prefetchState.fixtures?.count || 0,
      leagues: prefetchState.leagues?.count || 0
    },
    errorCount: prefetchState.errorCount,
    status: prefetchState.isRunning ? 'RUNNING' : 'IDLE'
  };
}

// ============================================
// INITIALIZATION
// ============================================

export async function initializePrefetchSystem() {
  logger.info('Initializing prefetch system...');

  try {
    // Do initial prefetch immediately
    await prefetchAllSportsData();

    // Then start scheduled updates
    startScheduledPrefetch();

    logger.success('Prefetch system initialized successfully');

    return {
      success: true,
      status: getPrefetchStatus()
    };
  } catch (err) {
    logger.error(`Failed to initialize: ${err.message}`);
    return {
      success: false,
      error: err.message
    };
  }
}

// ============================================
// MANUAL REFRESH
// ============================================

export async function refreshSpecificData(type) {
  const refreshers = {
    'nfl': () => SportsDataAggregator.getNFLTeams(),
    'soccer': () => SportsDataAggregator.getPremierLeagueTeams(),
    'fixtures': () => SportsDataAggregator.getFixtures(),
    'leagues': () => SportsDataAggregator.getBet365Leagues(),
    'odds': () => SportsDataAggregator.getPinnacleOdds(),
    'all': () => prefetchAllSportsData()
  };

  const refresher = refreshers[type];
  if (!refresher) {
    return { success: false, error: `Unknown type: ${type}` };
  }

  try {
    logger.info(`Manually refreshing: ${type}`);
    const result = await refresher();
    logger.success(`Refreshed ${type}: ${result.count || 'N/A'} items`);
    return { success: true, result };
  } catch (err) {
    logger.error(`Refresh failed: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// ============================================
// HEALTH CHECK
// ============================================

export function getHealthCheck() {
  const status = getPrefetchStatus();
  
  const checks = {
    'Data Loading': status.dataLoaded.nflTeams > 0 || status.dataLoaded.plTeams > 0,
    'Recent Update': status.ageSeconds && status.ageSeconds < 3600,
    'No Errors': status.errorCount === 0,
    'Service Running': prefetchState.isRunning || prefetchIntervals.length > 0
  };

  const passing = Object.values(checks).filter(v => v).length;
  const total = Object.keys(checks).length;

  return {
    healthy: passing === total,
    passing,
    total,
    checks,
    status
  };
}

export default {
  prefetchAllSportsData,
  startScheduledPrefetch,
  stopScheduledPrefetch,
  getPrefetchStatus,
  initializePrefetchSystem,
  refreshSpecificData,
  getHealthCheck
};
