import fs from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { _clearFallback } from '../src/lib/redis-cache.js';
import { fetchSportradar } from '../src/services/providers/sportradar.js';

test('sportradar adapter normalizes competitions and caches them', async (t) => {
  process.env.SPORTRADAR_KEY = process.env.SPORTRADAR_KEY || 'test-key-for-unit';
  _clearFallback();

  const raw = await fs.readFile(new URL('./fixtures/sportradar/competitions.json', import.meta.url));
  const fixture = JSON.parse(raw.toString());

  // first call: fetcher returns fixture
  const fetcher = async () => ({ ok: true, body: fixture });

  const r1 = await fetchSportradar('soccer', 'competitions', {}, { fetcher });
  assert.equal(r1.ok, true);
  assert.ok(r1.data);
  assert.equal(Array.isArray(r1.data.competitions), true);
  assert.equal(r1.data.competitions.length, 2);
  assert.equal(r1.data.competitions[0].id, 'sr:competition:1');
  assert.equal(r1.data.competitions[0].name, 'Test League');

  // second call: simulate network failure but expect cache hit
  const failingFetcher = async () => ({ ok: false, error: 'network' });
  const r2 = await fetchSportradar('soccer', 'competitions', {}, { fetcher: failingFetcher });
  assert.equal(r2.ok, true);
  assert.equal(r2.cached, true);
  assert.equal(r2.data.competitions.length, 2);
});
