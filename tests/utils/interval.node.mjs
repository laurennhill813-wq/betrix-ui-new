import test from 'node:test';
import assert from 'node:assert/strict';
import { coerceThresholdMinutes, normalizeIntervalParam } from '../../src/utils/interval.js';

test('coerceThresholdMinutes handles numeric and non-numeric inputs', () => {
  assert.equal(coerceThresholdMinutes(undefined), 5);
  assert.equal(coerceThresholdMinutes(null), 5);
  assert.equal(coerceThresholdMinutes('10'), 10);
  assert.equal(coerceThresholdMinutes(15.9), 15);
  assert.equal(coerceThresholdMinutes('foo'), 5);
  assert.equal(coerceThresholdMinutes(-2), 0);
});

test('normalizeIntervalParam returns SQL-friendly string or null', () => {
  assert.equal(normalizeIntervalParam(5), '5 minutes');
  assert.equal(normalizeIntervalParam('20'), '20 minutes');
  assert.equal(normalizeIntervalParam(0), null);
  assert.equal(normalizeIntervalParam(undefined), '5 minutes');
  assert.equal(normalizeIntervalParam(null), '5 minutes');
});
