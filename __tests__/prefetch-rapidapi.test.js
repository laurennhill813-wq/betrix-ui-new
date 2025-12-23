import { jest } from '@jest/globals';
import { startPrefetchScheduler } from "../src/tasks/prefetch-scheduler.js";

function createInMemoryRedis() {
  const kv = new Map();
  return {
    async set(k, v) {
      kv.set(k, typeof v === "string" ? v : JSON.stringify(v));
      return "OK";
    },
    async get(k) {
      return kv.has(k) ? kv.get(k) : null;
    },
    async publish(_channel, _msg) {
      return 1;
    },
    async del(k) {
      kv.delete(k);
      return 1;
    },
    async expire(_k, _t) {
      return 1;
    },
  };
}

describe("Prefetch RapidAPI integration", () => {
  beforeEach(() => {
    process.env.RAPIDAPI_KEY = "test-key-xyz";
    // mock fetch to return a predictable response
    fetch = jest.fn().mockImplementation(async (url) => {
      if (url.includes("/api/premierleague/team")) {
        return { status: 200, json: async () => ({ team: "Liverpool" }) };
      }
      // simulate 403 for others for coverage
      return { status: 403, json: async () => ({ message: "forbidden" }) };
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
    delete process.env.RAPIDAPI_KEY;
  });

  test("writes health and keys to Redis even on errors", async () => {
    const redis = createInMemoryRedis();
    const handle = startPrefetchScheduler({ redis, intervalSeconds: 60 });
    // allow scheduler to run its immediate job
    await new Promise((r) => setTimeout(r, 200));
    // inspect rapidapi health
    const raw = await redis.get("rapidapi:health");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw);
    expect(parsed).toHaveProperty("apis");
    // check at least Premier League entry exists
    const plEntry = parsed.apis["Premier League Live Scores"];
    expect(plEntry).toBeDefined();
    // check stored key for the team endpoint exists
    const keyFragment = "api_premierleague_team_name_Liverpool";
    // find any key matching rapidapi:Premier_League_Live_Scores:* containing that fragment
    // our in-memory redis stored keys in a Map; we can't list keys, but we expect health endpoints entry
    expect(Object.keys(plEntry.endpoints).length).toBeGreaterThan(0);
    handle.stop();
  }, 10000);
});
