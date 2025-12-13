import { handleCallbackQuery } from '../src/handlers/handler-complete.js';

(async () => {
  const mockFixture = {
    id: 'fixture-1',
    home: 'Tottenham Hotspur',
    away: 'Manchester City',
    kickoff: '2010-08-14T11:45:00Z',
    competition: { id: 8, name: 'Premier League' },
    venue: 'TBA',
    status: 'POSTPONED',
    provider: 'sportsmonks'
  };

  const services = {
    sportsAggregator: {
      getFixtures: async () => [mockFixture],
      getAllLiveMatches: async () => [mockFixture]
    },
    ai: {
      analyzeSport: async (sport, matchData, prompt) => {
        // Simulate AI returning a JSON object in various shapes
        return {
          choices: [
            { message: { content: JSON.stringify({ summary: 'Short summary', predictions: [{ market: 'Match Winner', selection: 'Away', probability: 0.72, confidence: 'high', suggested_stake_pct: 5, rationale: 'City are stronger' }] }) } }
          ]
        };
      }
    }
  };

  const cq = {
    data: 'analyseFixture:fixture-1',
    id: 'cb-test-1',
    message: { chat: { id: 12345 }, message_id: 999 }
  };

  const actions = await handleCallbackQuery(cq, null, services);
  console.log('Returned actions:', JSON.stringify(actions, null, 2));
})();
