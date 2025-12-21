import assert from 'assert';
import { startServer } from '../src/server.js';

// Ensure /health/rapidapi registration log is emitted on startup
(async () => {
  const origLog = console.log;
  let seen = false;
  console.log = (...args) => {
    try {
      const s = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
      if (s.includes('/health/rapidapi registered')) seen = true;
    } catch (e) {}
    try { origLog.apply(console, args); } catch (e) {}
  };

  let server;
  try {
    server = startServer();
    // allow short time for startup logs
    await new Promise((r) => setTimeout(r, 600));
  } finally {
    try { if (server && server.close) server.close(); } catch (e) {}
    console.log = origLog;
  }

  assert.ok(seen, 'Expected startup to log "/health/rapidapi registered"');
  console.log('[test] startup-rapidapi-registered: OK');
  process.exit(0);
})();
