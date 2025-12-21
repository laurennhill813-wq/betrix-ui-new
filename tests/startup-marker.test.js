import assert from 'assert';

// Ensure we set an explicit deploy id before importing the server so the
// startup marker uses a predictable key in tests.
process.env.RENDER_DEPLOY_ID = process.env.RENDER_DEPLOY_ID || 'test-deploy';

const { startServer } = await import('../src/server.js');
const { cacheGet } = await import('../src/lib/redis-cache.js');

// Start the server and then verify the Redis startup marker key exists.
(async () => {
  const server = startServer();
  try {
    // allow a short time for the async startup marker to run
    await new Promise((r) => setTimeout(r, 600));

    const key = `rapidapi:startup:${process.env.RENDER_DEPLOY_ID}`;
    const val = await cacheGet(key);
    assert.ok(val, `Expected Redis startup marker ${key} to exist`);
    // Accept either the literal 'registered' or a timestamp string
    assert.ok(val === 'registered' || typeof val === 'string', `Unexpected marker value: ${String(val)}`);
    console.log('[test] startup-marker: OK');
    process.exit(0);
  } catch (e) {
    console.error('[test] startup-marker: FAILED', e && e.message ? e.message : e);
    process.exit(2);
  } finally {
    try { if (server && server.close) server.close(); } catch (e) {}
  }
})();
