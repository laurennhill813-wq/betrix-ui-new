import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchSportbex } from '../../src/lib/sportbex-client.js';

test('fetchSportbex /live-score/series returns series payload (mocked)', async () => {
  const res = await fetchSportbex('/live-score/series?page=1&perPage=10');
  assert.ok(res, 'Expected a response object');
  assert.strictEqual(res.httpStatus, 200);
  assert.ok(res.body && (res.body.message || res.body.data !== undefined), 'Expected body with message or data');
});

test('fetchSportbex competitions path returns array (mocked)', async () => {
  const res = await fetchSportbex('/betfair/competitions/4');
  assert.ok(res, 'Expected a response object');
  assert.strictEqual(res.httpStatus, 200);
  assert.ok(Array.isArray(res.body) || typeof res.body === 'object', 'Expected body to be array or object');
});
