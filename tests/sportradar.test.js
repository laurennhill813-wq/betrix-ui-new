/* eslint-env jest */
import { SPORTRADAR_SPORTS } from "../src/config/sportradar-sports.js";
import { getRedis, MockRedis } from "../src/lib/redis-factory.js";

jest.setTimeout(20000);

describe("Sportradar registry and prefetch", () => {
  test("registry includes required sports", () => {
    const ids = SPORTRADAR_SPORTS.map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(["soccer", "nba", "nfl", "mlb", "nhl", "tennis", "nascar"]));
  });

  test("prefetch populates redis keys (mocked client)", async () => {
    // use in-memory MockRedis
    const mr = new MockRedis();

    // stub sportradar-client module to return sample data and metadata
    jest.unstable_mockModule("../src/services/sportradar-client.js", () => ({
      fetchAndNormalizeTeams: async (sport) => ({ items: [{ sport, teamId: `${sport}-1`, name: `${sport.toUpperCase()} Team 1`, market: null, alias: null }], httpStatus: 200, pathUsed: `/mock/${sport}/teams`, errorReason: null }),
      fetchAndNormalizeFixtures: async (sport, params) => ({ items: [ { sport, league: `${sport}-league`, eventId: `${sport}-ev-1`, startTimeISO: new Date().toISOString(), homeTeam: `${sport} Home`, awayTeam: `${sport} Away`, venue: "Test Stadium", status: "SCHEDULED" } ], httpStatus: 200, pathUsed: `/mock/${sport}/schedule`, errorReason: null }),
      sportEmoji: (s) => "🏟️",
    }));

    const { startSportradarPrefetch } = await import("../src/tasks/sportradar-prefetch.js");

    const handle = startSportradarPrefetch({ redis: mr, cronExpr: "*/30 * * * *", days: 0, ttlFixtures: 10, ttlTeams: 10 });

    // wait a moment for immediate run to finish
    await new Promise((r) => setTimeout(r, 1000));

    const healthRaw = await mr.get("sportradar:health");
    expect(healthRaw).toBeTruthy();
    const health = JSON.parse(healthRaw);
    expect(health.bySport).toBeDefined();
    // Ensure health entries include enrichment fields
    for (const s of Object.keys(health.bySport)) {
      const entry = health.bySport[s];
      const expectedKeys = ["sport","lastUpdated","fixturesCount","teamsCount","httpStatus","errorReason","pathUsed"];
      const keys = Object.keys(entry).sort();
      expect(keys).toEqual(expectedKeys.sort());
    }
    // check that nascar key exists
    const teamsRaw = await mr.get("sportradar:teams:nascar");
    expect(teamsRaw).toBeTruthy();
    const teams = JSON.parse(teamsRaw);
    expect(Array.isArray(teams.items)).toBe(true);

    // cleanup
    try {
      handle.stop();
    } catch (e) {}
  });

  test("normalization produces canonical fixtures for multiple sports", async () => {
    // Provide mocked provider responses with sport-specific shapes
    const mocked = {};
    mocked.nba = { games: [ { id: 'nba-1', scheduled: '2025-01-01T20:00:00Z', home: { name: 'Lakers' }, away: { name: 'Bulls' }, venue: { name: 'Staples' }, status: 'scheduled' } ] };
    mocked.nfl = { games: [ { id: 'nfl-1', scheduled_at: '2025-01-02T18:00:00Z', home_team: { name: 'Patriots' }, away_team: { name: 'Jets' }, stadium: 'Foxboro', status: 'scheduled' } ] };
    mocked.mlb = { games: [ { id: 'mlb-1', scheduled: '2025-04-01T19:00:00Z', home_team: { name: 'Yankees' }, away_team: { name: 'RedSox' }, ballpark: 'Yankee Stadium', status: 'scheduled' } ] };
    mocked.nhl = { games: [ { id: 'nhl-1', scheduled: '2025-10-10T02:00:00Z', home_team: { name: 'Bruins' }, away_team: { name: 'Canadiens' }, arena: 'TD Garden', status: 'scheduled' } ] };
    mocked.tennis = { schedule: { events: [ { id: 'ten-1', scheduled: '2025-06-01T12:00:00Z', competitors: [ { name: 'Player A' }, { name: 'Player B' } ], court: 'Center Court', status: 'scheduled' } ] } };
    mocked.nascar = { schedule: { events: [ { id: 'nas-1', scheduled: '2025-03-15T14:00:00Z', participants: [ { name: 'Driver 1' } ], track: 'Daytona', status: 'scheduled' } ] } };

    // Mock the provider module to return these shapes
    jest.unstable_mockModule("../src/services/providers/sportradar.js", () => ({
      fetchSportradar: async (sport, type, params) => {
        const s = String(sport).toLowerCase();
        const body = mocked[s] || { games: [] };
        return { ok: true, body, provider_path: `/mock/${s}/schedule`, status: 200 };
      },
    }));

    const client = await import("../src/services/sportradar-client.js");
    const sportsToTest = ["nba", "nfl", "mlb", "nhl", "tennis", "nascar"];

    for (const s of sportsToTest) {
      const res = await client.fetchAndNormalizeFixtures(s, { date: '2025-01-01' }, {});
      expect(res).toBeDefined();
      expect(res.items).toBeInstanceOf(Array);
      expect(res.items.length).toBeGreaterThan(0);
      const f = res.items[0];
      expect(f).toHaveProperty('sport');
      expect(f).toHaveProperty('league');
      expect(f).toHaveProperty('eventId');
      expect(f).toHaveProperty('startTimeISO');
      expect(f).toHaveProperty('homeTeam');
      expect(f).toHaveProperty('awayTeam');
      expect(f).toHaveProperty('venue');
      expect(f).toHaveProperty('status');
      // metadata
      expect(res).toHaveProperty('httpStatus');
      expect(res).toHaveProperty('pathUsed');
    }
  });

  test("prefetch writes health on errors (mocked error responses)", async () => {
    const mr = new MockRedis();

    // Mock provider-level responses by mocking providers/fetcher so client maps codes
    jest.unstable_mockModule("../src/services/providers/sportradar.js", () => ({
      fetchSportradar: async (sport, type, params) => {
        // simulate specific errors for some sports
        if (sport === "soccer") return { ok: false, status: 429, bodyText: 'Limit Exceeded' };
        if (sport === "tennis") return { ok: false, status: 502, bodyText: 'Gateway failure' };
        // normal success shape
        const date = params && params.date ? params.date : new Date().toISOString().slice(0,10);
        return { ok: true, status: 200, body: { games: [ { id: `${sport}-1`, scheduled: `${date}T12:00:00Z`, home: { name: `${sport} Home` }, away: { name: `${sport} Away` } ] }, provider_path: `/mock/${sport}/schedule` };
      }
    }));

    const { startSportradarPrefetch } = await import("../src/tasks/sportradar-prefetch.js");

    const handle = startSportradarPrefetch({ redis: mr, cronExpr: "*/30 * * * *", days: 0, ttlFixtures: 10, ttlTeams: 10 });
    await new Promise((r) => setTimeout(r, 1000));

    const healthRaw = await mr.get("sportradar:health");
    expect(healthRaw).toBeTruthy();
    const health = JSON.parse(healthRaw);
    expect(health.bySport).toBeDefined();
    // soccer should have recorded rate_limited
    const soccer = health.bySport["soccer"];
    expect(soccer).toBeDefined();
    expect(soccer.teamsCount).toBe(0);
    expect(soccer.fixturesCount).toBe(0);
    expect(soccer.httpStatus).toBe(429);
    expect(soccer.errorReason).toBeTruthy();
    // ensure exact schema keys
    expect(Object.keys(soccer).sort()).toEqual(["sport","lastUpdated","fixturesCount","teamsCount","httpStatus","errorReason","pathUsed"].sort());

    // tennis should have gateway error recorded
    const tennis = health.bySport["tennis"];
    expect(tennis).toBeDefined();
    expect(tennis.fixturesCount).toBe(0);
    expect(tennis.httpStatus).toBe(502);
    expect(tennis.errorReason).toBeTruthy();
    expect(Object.keys(tennis).sort()).toEqual(["sport","lastUpdated","fixturesCount","teamsCount","httpStatus","errorReason","pathUsed"].sort());

    try { handle.stop(); } catch (e) {}
  });
});
