#!/usr/bin/env node
import Redis from 'ioredis';

async function run() {
  const url = process.env.REDIS_URL || process.env.REDIS || '';
  if (!url) {
    console.error('Please set REDIS_URL env var');
    process.exit(2);
  }
  const r = new Redis(url);
  try {
    const keys = await r.keys('rapidapi:*');
    if (!keys || keys.length === 0) {
      console.log('No rapidapi:* keys found');
      process.exit(0);
    }
    for (const k of keys.sort()) {
      try {
        const t = await r.type(k).catch(() => 'unknown');
        process.stdout.write(`${k}  type=${t}`);
        if (t === 'string') {
          const v = await r.get(k).catch(() => null);
          const preview = v ? (v.length > 400 ? v.slice(0,400) + '...<truncated>' : v) : '<empty>';
          process.stdout.write(` value=${preview.replace(/\n/g,' ')}\n`);
        } else if (t === 'list') {
          const len = await r.lLen(k).catch(() => null);
          process.stdout.write(` length=${len}\n`);
        } else if (t === 'hash') {
          const h = await r.hGetAll(k).catch(() => null);
          process.stdout.write(` fields=${h ? Object.keys(h).length : 0}\n`);
        } else {
          process.stdout.write('\n');
        }
      } catch (e) {
        console.error('err reading', k, e && e.message ? e.message : String(e));
      }
    }
  } finally {
    try { await r.quit(); } catch(e){ try{ r.disconnect(); }catch{} }
  }
}

run().catch((e)=>{ console.error(e && e.message ? e.message : String(e)); process.exit(1); });
