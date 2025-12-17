import { test } from 'node:test';
import assert from 'node:assert/strict';

// Basic smoke test to ensure AI service modules load and expose expected functions
test('AI provider modules present', async () => {
  // don't import heavy provider clients here; just verify module files exist
  const mod = await import('../src/services/azure-ai.js').catch(() => null);
  assert.ok(mod, 'azure-ai module should load');
  // Expect at least one exported symbol
  const keys = mod ? Object.keys(mod) : [];
  assert.ok(keys.length > 0, 'azure-ai should export functions');
});
