process.env.USE_MOCK_REDIS = '1';
import request from 'supertest';
import app from '../src/app_clean.js';
import createRedisAdapter from '../src/utils/redis-adapter.js';
import { getRedis } from '../src/lib/redis-factory.js';

test('/health/rapidapi returns unified per-sport totals', async () => {
  // Seed some fixture keys into MockRedis used by app
  const redisClient = getRedis();
  // write a sample rapidapi fixtures key for soccer and hockey
  await redisClient.set('rapidapi:football:fixtures:sample', JSON.stringify({ apiName: 'FootballData', sportKey: 'soccer', fixtures: [ { home_team: 'A', away_team: 'B' } ], ts: Date.now() }));
  await redisClient.set('rapidapi:hockey:fixtures:sample', JSON.stringify({ apiName: 'OddsAPI', sportKey: 'hockey', fixtures: [ { home_team: 'H1', away_team: 'H2' } ], ts: Date.now() }));

  const res = await request(app).get('/health/rapidapi').expect(200);
  expect(res.body).toBeDefined();
  expect(res.body.unified).toBeDefined();
  expect(typeof res.body.unified.upcomingFixtures === 'number' || typeof res.body.unified.upcomingFixtures === 'string').toBe(true);
  // unified.sports should be present and include soccer/hockey
  expect(res.body.unified.sports).toBeDefined();
  expect(res.body.unified.sports.soccer).toBeDefined();
  expect(res.body.unified.sports.hockey).toBeDefined();
});
