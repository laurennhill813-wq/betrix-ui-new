import fetch from 'node-fetch';

const KEY = process.env.SPORTMONKS_API_KEY;
const BASE = process.env.SPORTMONKS_API_BASE || 'https://api.sportmonks.com/v3';

// sportmonks(path, params) where params is a string like '&select=...&include=...'
export async function sportmonks(path, params = '') {
  const sep = path.includes('?') ? '&' : '?';
  const url = `${BASE}${path}${sep}api_token=${KEY}${params}`;
  const res = await fetch(url, { timeout: 15000 });
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return await res.json();
  const text = await res.text();
  try { return JSON.parse(text); } catch (_) { return { body: text }; }
}

export default { sportmonks };
