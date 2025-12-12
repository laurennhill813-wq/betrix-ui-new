import dotenv from 'dotenv';
import path from 'path';
import fetch from 'node-fetch';
import fs from 'fs';

for (const f of ['.env.local.fixed', '.env.local', '.env']) {
  try { dotenv.config({ path: path.resolve(process.cwd(), f) }); } catch(_) {}
}

const KEY = process.env.SPORTMONKS_API_KEY;
const bases = [
  'https://api.sportmonks.com/v3',
  'https://api.sportmonks.com/v2',
  'https://api.sportmonks.com/v1',
  'https://soccer.sportmonks.com/api/v2.0',
];

const endpoints = ['/football/fixtures', '/football/fixtures/latest', '/football/fixtures/live', '/fixtures'];
const authVariants = [
  { q: true },
  { header: { Authorization: `Bearer ${KEY}` } },
  { header: { 'X-API-Key': KEY } },
];

const results = [];

async function tryUrl(url, headers) {
  try {
    const res = await fetch(url, { headers: headers || {}, timeout: 15000 });
    const text = await res.text();
    return { status: res.status, body: text, headers: Object.fromEntries(res.headers.entries()) };
  } catch (e) {
    return { status: 0, body: String(e) };
  }
}

(async () => {
  for (const base of bases) {
    for (const ep of endpoints) {
      for (const av of authVariants) {
        let url = base + ep;
        const header = av.header || {};
        if (av.q) url = `${url}?api_token=${KEY}`;
        const r = await tryUrl(url, header);
        results.push({ url, header, status: r.status, body: r.body });
        console.log('Tried', url, 'status', r.status);
      }
    }
  }
  fs.writeFileSync('./scripts/probe-sportmonks-results.json', JSON.stringify(results, null, 2));
  console.log('Wrote probe-sportmonks-results.json');
  process.exit(0);
})();
