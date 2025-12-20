/* eslint-env jest */
import { describe, test, expect } from '@jest/globals';

jest.setTimeout(20000);

describe('Sportradar normalization helpers', () => {
  test('normalize NBA schedule shape', async () => {
    // mock provider
    const mod = await import('../src/services/sportradar-client.js');
    const { fetchAndNormalizeFixtures } = mod;
    // monkeypatch fetchSportradar by mocking provider module
    const provider = await import('../src/services/providers/sportradar.js');
    // create a fake NBA schedule response
    const fake = {
      games: [
        { id: 'game-1', scheduled: '2025-12-20T18:00:00Z', home: { name: 'Home A' }, away: { name: 'Away B' }, venue: { name: 'Stadium A' }, status: 'scheduled', competition: { name: 'NBA' } }
      ]
    };
    // override fetchSportradar in provider
    provider.fetchSportradar = async () => ({ ok: true, data: fake, provider_path: '/nba/trial/v7/en/games/2025-12-20/schedule.json', httpStatus: 200 });
    const res = await fetchAndNormalizeFixtures('nba', { date: '2025-12-20' }, {});
    expect(res.items.length).toBe(1);
    const f = res.items[0];
    expect(f.sport).toBe('nba');
    expect(f.eventId).toBe('game-1');
    expect(f.homeTeam).toBe('Home A');
    expect(f.awayTeam).toBe('Away B');
    expect(f.startTimeISO).toBe('2025-12-20T18:00:00Z');
    expect(res.pathUsed).toBe('/nba/trial/v7/en/games/2025-12-20/schedule.json');
    expect(res.httpStatus).toBe(200);
  });

  test('normalize Tennis schedule shape', async () => {
    const mod = await import('../src/services/sportradar-client.js');
    const { fetchAndNormalizeFixtures } = mod;
    const provider = await import('../src/services/providers/sportradar.js');
    const fake = { schedule: { events: [ { id: 't1', date: '2025-12-21', competitors: [ { name: 'Player A' }, { name: 'Player B' } ], venue: { name: 'Court 1' } } ] } };
    provider.fetchSportradar = async () => ({ ok: true, data: fake, provider_path: '/tennis/trial/v3/en/schedules/2025-12-21/schedule.json', httpStatus: 200 });
    const res = await fetchAndNormalizeFixtures('tennis', { date: '2025-12-21' }, {});
    expect(res.items.length).toBe(1);
    const f = res.items[0];
    expect(f.homeTeam).toBe('Player A');
    expect(f.awayTeam).toBe('Player B');
    expect(res.pathUsed).toBe('/tennis/trial/v3/en/schedules/2025-12-21/schedule.json');
  });
});
