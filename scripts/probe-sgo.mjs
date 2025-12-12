import { getRedis } from '../src/lib/redis-factory.js';
import axios from 'axios';
import { CONFIG } from '../src/config.js';

(async function(){
  try {
    const redis = getRedis();
    const base = (CONFIG.SPORTSGAMEODDS && CONFIG.SPORTSGAMEODDS.BASE) || 'https://api.sportsgameodds.com/v1';
    const key = (CONFIG.SPORTSGAMEODDS && CONFIG.SPORTSGAMEODDS.KEY) || process.env.SPORTSGAMEODDS_API_KEY || null;
    console.log('Probing SportGameOdds base:', base, 'keyPresent:', !!key);
    const candidates = [
      '/', '/health', '/status', '/v1', '/v1/health', '/v1/status', '/events', '/fixtures', '/events/upcoming'
    ];

    const headerVariants = key ? [
      { 'Authorization': `Bearer ${key}` },
      { 'x-api-key': key },
      { 'X-API-KEY': key }
    ] : [{}];

    let success = false;
    const results = [];

    for (const c of candidates) {
      const url = base.replace(/\/$/, '') + c;
      for (const h of headerVariants) {
        try {
          const resp = await axios.get(url, { headers: Object.assign({ Accept: 'application/json' }, h), timeout: 8000 });
          console.log('OK', url, 'status:', resp.status);
          results.push({ url, status: resp.status, ok: true });
          success = true;
        } catch (e) {
          const status = e && e.response && e.response.status ? e.response.status : 'ERR';
          console.log('FAIL', url, 'status:', status);
          results.push({ url, status, ok: false, err: e?.message || null });
        }
      }
    }

    // store health in redis
    const keyRedis = 'betrix:provider:health:sportsgameodds';
    const payload = { ok: success, ts: Date.now(), results };
    try { await redis.set(keyRedis, JSON.stringify(payload)); await redis.expire(keyRedis, 3600); console.log('Wrote health to', keyRedis); } catch (e) { console.log('Redis write failed', e?.message || e); }

    process.exit(0);
  } catch (e) {
    console.error('Probe failed', e?.message || e);
    process.exit(1);
  }
})();