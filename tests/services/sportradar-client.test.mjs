import MockRedis from "../helpers/mock-redis.js";
import { getUpcomingFixtures, getTeams } from "../../src/services/sportradar-client.js";
import { cacheDel } from "../../src/lib/redis-cache.js";

test("getUpcomingFixtures normalizes provider payload", async () => {
  const mockFetcher = async (req, opts) => ({ ok: true, body: { matches: [{ home: { name: "Alpha" }, away: { name: "Beta" }, scheduled: "2025-12-20T12:00:00Z" }] } });

  const fixtures = await getUpcomingFixtures("nba", { fetcher: mockFetcher });
  expect(Array.isArray(fixtures)).toBe(true);
  expect(fixtures.length).toBe(1);
  expect(fixtures[0].home).toBe("Alpha");
  expect(fixtures[0].away).toBe("Beta");
});

test("getTeams extracts teams from payload or fixtures fallback", async () => {
  const mockFetcherTeams = async (req, opts) => ({ ok: true, body: { teams: [{ id: "t1", name: "Team One" }, { id: "t2", name: "Team Two" }] } });
  await cacheDel("sportradar:upcoming:nba");
  await cacheDel("sportradar:teams:nba");
  const teams = await getTeams("nba", { fetcher: mockFetcherTeams });
  expect(Array.isArray(teams)).toBe(true);
  expect(teams.length).toBe(2);
  expect(teams[0].name).toBe("Team One");

  // fallback: no teams endpoint, but fixtures present
  const mockFetcherFixtures = async (req, opts) => ({ ok: true, body: { matches: [{ home: { name: "A" }, away: { name: "B" }, scheduled: "2025-12-20T12:00:00Z" }] } });
  const fallback = await getTeams("nascar", { fetcher: mockFetcherFixtures });
  expect(fallback.length).toBeGreaterThan(0);
});
