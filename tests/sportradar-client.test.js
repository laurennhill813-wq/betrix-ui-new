/* eslint-env jest */
import { fetchSportradar } from "../src/services/providers/sportradar.js";

jest.setTimeout(10000);

describe("Sportradar provider endpoint mapping", () => {
  const captured = [];

  const makeFetcher = (ok = true, body = {}) => async ({ base, path, auth, key }, opts = {}) => {
    captured.push({ base, path, auth, key });
    return { ok, status: ok ? 200 : 404, headers: {}, bodyText: JSON.stringify(body), body };
  };

  test.each([
    ["nba", `/nba/trial/v7/en/games/2025-01-01/schedule.json`],
    ["nfl", `/nfl/trial/v7/en/games/2025-01-01/schedule.json`],
    ["mlb", `/mlb/trial/v7/en/games/2025-01-01/schedule.json`],
    ["nhl", `/nhl/trial/v7/en/games/2025-01-01/schedule.json`],
    ["tennis", `/tennis/trial/v3/en/schedules/2025-01-01/schedule.json`],
    ["nascar", `/nascar/trial/v2/en/schedules/2025-01-01/schedule.json`],
  ])("constructs trial path for %s", async (sport, expectedPath) => {
    captured.length = 0;
    const res = await fetchSportradar(sport, "matches_by_date", { date: "2025-01-01" }, { fetcher: makeFetcher(true, { schedule: [] }) });
    expect(res).toBeTruthy();
    expect(res.ok).toBe(true);
    expect(res.provider_path).toBe(expectedPath);
  });
});
