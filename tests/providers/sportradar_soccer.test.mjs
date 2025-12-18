import test from "node:test";
import assert from "node:assert/strict";
import { fetchSportradar } from "../../src/services/providers/sportradar.js";

test("fetchSportradar returns matches_by_date payload (mocked)", async () => {
  const mockFetcher = async ({ base, path, auth, key }, opts) => {
    // return a mocked Sportradar-like response
    return {
      ok: true,
      status: 200,
      body: {
        generated_at: new Date().toISOString(),
        matches: [
          {
            id: "m1",
            home: { name: "Home FC" },
            away: { name: "Away FC" },
            scheduled: "2025-12-01T15:00:00Z",
            status: "SCHEDULED",
          },
        ],
      },
    };
  };

  const res = await fetchSportradar(
    "soccer",
    "matches_by_date",
    { date: "2025-12-01" },
    { fetcher: mockFetcher },
  );
  assert.ok(res && res.ok, "Expected ok response");
  assert.ok(
    res.data &&
      Array.isArray(res.data.matches) &&
      res.data.matches.length === 1,
    "Expected one match in data",
  );
});
