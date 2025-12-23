/**
 * Prefetch & Fixture Caching System
 * Automatically fetches and caches sports data across all working APIs
 * Runs on a schedule to keep fixture data fresh for users
 */

import unifiedAPI from '../services/unified-sports-api.js';
import logger from '../utils/logger.js';

class PrefetchSystem {
  constructor() {
    this.isRunning = false;
    this.lastRun = null;
    this.schedules = {
      nfl: 30 * 60 * 1000,        // Every 30 minutes
      soccer: 15 * 60 * 1000,     // Every 15 minutes
      basketball: 20 * 60 * 1000, // Every 20 minutes
      odds: 5 * 60 * 1000,        // Every 5 minutes
      news: 10 * 60 * 1000        // Every 10 minutes
    };
  }

  /**
   * Start prefetch system
   */
  async start() {
    if (this.isRunning) {
      logger.info('[PrefetchSystem] Already running');
      return;
    }

    this.isRunning = true;
    logger.info('[PrefetchSystem] Starting prefetch system');

    // Initial prefetch
    await this.prefetchAll();

    // Schedule recurring prefetches
    this.schedulePrefetches();
  }

  /**
   * Schedule recurring prefetches
   */
  schedulePrefetches() {
    // NFL Teams
    setInterval(async () => {
      try {
        await unifiedAPI.getNFLTeams();
        logger.debug('[PrefetchSystem] NFL teams prefetched');
      } catch (err) {
        logger.warn('[PrefetchSystem] NFL prefetch failed:', err.message);
      }
    }, this.schedules.nfl);

    // Soccer
    setInterval(async () => {
      try {
        await unifiedAPI.searchSoccer('upcoming');
        logger.debug('[PrefetchSystem] Soccer fixtures prefetched');
      } catch (err) {
        logger.warn('[PrefetchSystem] Soccer prefetch failed:', err.message);
      }
    }, this.schedules.soccer);

    // Basketball
    setInterval(async () => {
      try {
        await unifiedAPI.getBasketballNews();
        logger.debug('[PrefetchSystem] Basketball news prefetched');
      } catch (err) {
        logger.warn('[PrefetchSystem] Basketball prefetch failed:', err.message);
      }
    }, this.schedules.basketball);

    // Live Odds
    setInterval(async () => {
      try {
        await unifiedAPI.getUpcomingMatches();
        logger.debug('[PrefetchSystem] Live odds prefetched');
      } catch (err) {
        logger.warn('[PrefetchSystem] Odds prefetch failed:', err.message);
      }
    }, this.schedules.odds);

    // News
    setInterval(async () => {
      try {
        await unifiedAPI.getTopNews();
        logger.debug('[PrefetchSystem] Sports news prefetched');
      } catch (err) {
        logger.warn('[PrefetchSystem] News prefetch failed:', err.message);
      }
    }, this.schedules.news);

    logger.info('[PrefetchSystem] Prefetch schedules initialized');
  }

  /**
   * Prefetch all data immediately
   */
  async prefetchAll() {
    logger.info('[PrefetchSystem] Running full prefetch cycle');
    
    const tasks = [
      this.prefetchNFL(),
      this.prefetchSoccer(),
      this.prefetchBasketball(),
      this.prefetchOdds(),
      this.prefetchNews()
    ];

    const results = await Promise.allSettled(tasks);
    this.lastRun = new Date();

    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    logger.info(`[PrefetchSystem] Prefetch complete: ${succeeded} succeeded, ${failed} failed`);

    return { succeeded, failed, lastRun: this.lastRun };
  }

  /**
   * Prefetch NFL data
   */
  async prefetchNFL() {
    try {
      const teams = await unifiedAPI.getNFLTeams();
      logger.info(`[Prefetch] NFL: ${teams.length} teams loaded`);
      return { sport: 'NFL', count: teams.length };
    } catch (err) {
      logger.warn(`[Prefetch] NFL failed:`, err.message);
      throw err;
    }
  }

  /**
   * Prefetch Soccer fixtures
   */
  async prefetchSoccer() {
    try {
      const matches = await unifiedAPI.searchSoccer('upcoming');
      const count = (matches && matches.length) || 0;
      logger.info(`[Prefetch] Soccer: ${count} matches loaded`);
      return { sport: 'Soccer', count };
    } catch (err) {
      logger.warn(`[Prefetch] Soccer failed:`, err.message);
      throw err;
    }
  }

  /**
   * Prefetch Basketball data
   */
  async prefetchBasketball() {
    try {
      const news = await unifiedAPI.getBasketballNews();
      const count = (news && news.length) || 0;
      logger.info(`[Prefetch] Basketball: ${count} items loaded`);
      return { sport: 'Basketball', count };
    } catch (err) {
      logger.warn(`[Prefetch] Basketball failed:`, err.message);
      throw err;
    }
  }

  /**
   * Prefetch odds data
   */
  async prefetchOdds() {
    try {
      const odds = await unifiedAPI.getUpcomingMatches();
      const count = (odds && odds.length) || 0;
      logger.info(`[Prefetch] Odds: ${count} matches with odds loaded`);
      return { sport: 'Odds', count };
    } catch (err) {
      logger.warn(`[Prefetch] Odds failed:`, err.message);
      throw err;
    }
  }

  /**
   * Prefetch news
   */
  async prefetchNews() {
    try {
      const news = await unifiedAPI.getTopNews();
      const count = (news && news.length) || 0;
      logger.info(`[Prefetch] News: ${count} articles loaded`);
      return { sport: 'News', count };
    } catch (err) {
      logger.warn(`[Prefetch] News failed:`, err.message);
      throw err;
    }
  }

  /**
   * Stop prefetch system
   */
  stop() {
    if (this.isRunning) {
      this.isRunning = false;
      logger.info('[PrefetchSystem] Stopped');
    }
  }

  /**
   * Get system status
   */
  getStatus() {
    return {
      running: this.isRunning,
      lastRun: this.lastRun,
      uptime: this.isRunning ? 'active' : 'inactive'
    };
  }

  /**
   * Force immediate prefetch (for debugging/manual triggers)
   */
  async forcePrefetch() {
    logger.info('[PrefetchSystem] Force prefetch triggered');
    return await this.prefetchAll();
  }
}

// Export singleton
export default new PrefetchSystem();
