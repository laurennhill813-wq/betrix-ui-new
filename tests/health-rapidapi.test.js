import app from "../src/app_clean.js";
import { getRedis } from "../src/lib/redis-factory.js";

describe('/health/rapidapi aggregation', () => {
  beforeEach(() => {
    process.env.USE_MOCK_REDIS = '1';
  });
  afterEach(() => {
    delete process.env.USE_MOCK_REDIS;
  });

  test('returns normalized health array from stored rapidapi:health', async () => {
    const redis = getRedis();
    const sample = {
      updatedAt: Date.now(),
      apis: {
        'The Odds API (direct)': {
          status: 'ok',
          lastUpdated: Date.now(),
          endpoints: {
            '/v4/sports/?apiKey=KEY': { httpStatus: 200, errorReason: null, lastUpdated: Date.now() }
          }
        }
      }
    };
    await redis.set('rapidapi:health', JSON.stringify(sample));

    const srv = app.listen(0);
    const port = srv.address().port;
    // use global fetch (Node v20+) to call endpoint
    const res = await fetch(`http://127.0.0.1:${port}/health/rapidapi`);
    const body = await res.json();
    expect(body).toHaveProperty('ok', true);
    expect(body).toHaveProperty('cached', true);
    expect(Array.isArray(body.health)).toBe(true);
    const found = body.health.find((h) => h.apiName === 'The Odds API (direct)');
    expect(found).toBeDefined();
    expect(found).toHaveProperty('status', 'ok');
    srv.close();
  }, 10000);
});
