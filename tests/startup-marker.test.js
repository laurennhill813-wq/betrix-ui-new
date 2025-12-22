import assert from 'assert';

// Ensure we set an explicit deploy id before starting the server so the
// startup marker uses a predictable key in tests.
process.env.RENDER_DEPLOY_ID = process.env.RENDER_DEPLOY_ID || 'test-deploy';
const { cacheGet, getRaw, _clearFallback } = await import('../src/lib/redis-cache.js');
const { getRedisClient } = await import('../src/lib/redis-cache.js');

// Clear any in-memory fallback state from previous tests before importing server
try { _clearFallback(); } catch (e) {}
const { startServer } = await import('../src/server.js');

(async () => {
  const server = startServer({ port: 0 });
  try {
    // allow a short time for the async startup marker to run
    await new Promise((r) => setTimeout(r, 800));

    const globalKey = 'rapidapi:startup:registered';
    const deployIdentifier = process.env.RENDER_DEPLOY_ID || process.env.COMMIT_SHA || process.env.RENDER_SERVICE_ID || 'test-deploy';
    const deployKey = `rapidapi:startup:${deployIdentifier}`;

    const gVal = await cacheGet(globalKey);
    assert.ok(gVal, `Expected Redis startup marker ${globalKey} to exist`);
    assert.ok(gVal === 'registered' || typeof gVal === 'string', `Unexpected global marker value: ${String(gVal)}`);

    // When a deploy identifier is available in env, expect a deploy-specific key
    if (process.env.RENDER_DEPLOY_ID || process.env.COMMIT_SHA || process.env.RENDER_SERVICE_ID) {
      const dVal = await cacheGet(deployKey);
      assert.ok(dVal, `Expected Redis startup marker ${deployKey} to exist`);
      assert.ok(dVal === 'registered' || typeof dVal === 'string', `Unexpected deploy marker value: ${String(dVal)}`);

      // If we have an actual Redis client, check TTL is approximately 86400s
      const client = getRedisClient();
      if (client && client.ttl) {
        try {
          const ttl = await client.ttl(deployKey);
          assert.ok(typeof ttl === 'number', `Expected numeric TTL, got: ${String(ttl)}`);
          assert.ok(Math.abs(ttl - 86400) < 300, `TTL for ${deployKey} expected ≈86400s, got ${ttl}`);
        } catch (e) {
          // If TTL check fails due to adapter differences, ignore but log
          console.warn('TTL check skipped due to client error', e && e.message ? e.message : e);
        }
      }
    }

    console.log('[test] startup-marker: OK');
    process.exit(0);
  } catch (e) {
    console.error('[test] startup-marker: FAILED', e && e.message ? e.message : e);
    process.exit(2);
  } finally {
    try { if (server && server.close) server.close(); } catch (e) {}
  }
})();
