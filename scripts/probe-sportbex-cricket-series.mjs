import fetch from 'node-fetch';

const BASE = process.env.SPORTBEX_BASE || 'https://trial-api.sportbex.com/api';
const KEY = process.env.SPORTBEX_API_KEY || '';

async function probe() {
  const page = process.env.SPORTBEX_PROBE_PAGE || '1';
  const perPage = process.env.SPORTBEX_PROBE_PERPAGE || '10';
  const url = `${BASE}/live-score/series?page=${encodeURIComponent(page)}&perPage=${encodeURIComponent(perPage)}`;
  console.log('Probing Sportbex cricket series:', url);
  const headers = { Accept: 'application/json' };
  if (KEY) headers['sportbex-api-key'] = KEY;
  const r = await fetch(url, { headers }).catch((e) => { console.error('fetch error', e); process.exitCode = 2; });
  if (!r) return;
  console.log('Status:', r.status);
  const body = await r.json().catch(() => null);
  console.dir(body, { depth: 3 });
}

probe().catch(e => { console.error(e); process.exitCode = 1; });
