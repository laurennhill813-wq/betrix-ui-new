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

    // stub sportradar-client module to return sample data
    jest.unstable_mockModule("../src/services/sportradar-client.js", () => ({
      getTeams: async (sport) => {
        return [{ id: `${sport}-1`, name: `${sport.toUpperCase()} Team 1` }];
      },
      getUpcomingFixtures: async (sport) => {
        return [
          {
            league: `${sport}-league`,
            eventId: `${sport}-ev-1`,
            startTime: new Date().toISOString(),
            home: `${sport} Home`,
            away: `${sport} Away`,
            venue: "Test Stadium",
            status: "SCHEDULED",
          },
        ];
      },
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
});
