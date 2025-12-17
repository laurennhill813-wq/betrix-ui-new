import fs from 'fs';
import path from 'path';
// load .env.local if present (simple parser)
const envPath = path.resolve('.env.local');
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, 'utf8');
  raw.split(/\r?\n/).forEach(line => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m) {
      let val = m[2];
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[m[1]] = val;
    }
  });
  console.log('.env.local loaded');
} else {
  console.log('.env.local not found, relying on existing env');
}

import { getRedisAdapter } from '../src/lib/redis-factory.js';
const r = getRedisAdapter();
(async () => {
  try {
    const payload = { message: { text: '[auto-index test] ping', from: { id: 999999, username: 'testbot' }, chat: { id: 999999 } } };
    await r.lpush('telegram:updates', JSON.stringify(payload));
    console.log('PUSH_OK');
    // give the worker a moment to pick up the job
    await new Promise((res) => setTimeout(res, 3000));

    const len = await r.llen('telegram:updates');
    console.log('telegram:updates length:', len);

    const keys = await r.keys('vec:*');
    console.log('vec keys:', keys);
    if (keys.length > 0) {
      const k = keys[0];
      const obj = await r.hgetall(k);
      console.log('sample', k, obj);
    }
  } catch (e) {
    console.error('ERR', e);
  } finally {
    try { await r.quit(); } catch (e) {}
    process.exit(0);
  }
})();
