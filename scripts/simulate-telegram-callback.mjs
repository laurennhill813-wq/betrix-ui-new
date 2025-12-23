import { fileURLToPath } from 'url';
import path from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load handler
import handler from '../src/handlers/handler-complete.js';
// handler-complete exports named functions; import default fallback
const { handleCallbackQuery } = handler;

async function run() {
  // Fake callback_query (sport:basketball:upcoming)
  const cq = {
    id: 'sim-cb-1',
    from: { id: 222222, is_bot: false, first_name: 'Tester' },
    message: { message_id: 55, chat: { id: 222222, type: 'private' } },
    data: 'sport:basketball:upcoming',
  };

  // Minimal mock redis (only implements methods used by handler)
  const redis = {
    async get(k) {
      return null;
    },
    async set(k, v) {
      return 'OK';
    },
    async keys(pattern) {
      return [];
    },
    async expire() {
      return 1;
    },
  };

  // Mock sportsAggregator to return sample basketball fixtures
  const services = {
    sportsAggregator: {
      async getFixtures(sport) {
        if (String(sport).toLowerCase() === 'basketball') {
          return [
            {
              id: 'b1',
              home: 'Lakers',
              away: 'Heat',
              time: '2025-12-24T19:00:00Z',
              league: 'NBA',
              provider: 'RapidAPI',
            },
            {
              id: 'b2',
              home: 'Celtics',
              away: 'Bucks',
              time: '2025-12-24T21:30:00Z',
              league: 'NBA',
              provider: 'RapidAPI',
            },
          ];
        }
        return [];
      },
    },
    // Provide minimal extras used by handler
    openLiga: null,
    footballData: null,
    rss: null,
    scrapers: null,
    oddsAnalyzer: null,
    multiSportAnalyzer: null,
    cache: null,
    sportsData: null,
    ai: null,
    nowPayments: null,
  };

  try {
    const res = await handleCallbackQuery(cq, redis, services);
    console.log('Handler returned:', JSON.stringify(res, null, 2));
  } catch (e) {
    console.error('Handler threw:', e && e.stack ? e.stack : e);
  }
}

run();
