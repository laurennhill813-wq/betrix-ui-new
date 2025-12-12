import fetch from 'node-fetch';

const KEY = process.env.ISPORTS_API_KEY;
const BASE = process.env.ISPORTS_API_BASE || 'http://api.isportsapi.com';
const FALLBACK = process.env.ISPORTS_API_BASE_FALLBACK || 'http://api2.isportsapi.com';

export async function isports(path) {
  const url = `${BASE}${path}${path.includes('?') ? '&' : '?'}api_key=${KEY}`;
  const fallbackUrl = `${FALLBACK}${path}${path.includes('?') ? '&' : '?'}api_key=${KEY}`;

  try {
    const res = await fetch(url, { timeout: 15000 });
    if (!res.ok) throw new Error(`Primary isports failed ${res.status}`);
    return await res.json();
  } catch (e) {
    const res = await fetch(fallbackUrl, { timeout: 15000 });
    return await res.json();
  }
}
