#!/usr/bin/env node
// Simple script to call the NFL RapidAPI team listing endpoint and print team names
const key = process.env.RAPIDAPI_KEY;
if (!key) {
  console.error('RAPIDAPI_KEY environment variable is not set');
  process.exit(2);
}
const url = 'https://nfl-api-data.p.rapidapi.com/nfl-team-listing/v1/data';
(async () => {
  try {
    const res = await fetch(url, {
      headers: {
        'x-rapidapi-host': 'nfl-api-data.p.rapidapi.com',
        'x-rapidapi-key': key,
      },
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch (e) {
      console.error('Response was not valid JSON:');
      console.error(text.slice(0, 2000));
      process.exit(2);
    }

    // Try to discover team names by scanning the object tree
    const names = [];
    const seen = new Set();
    function walk(obj) {
      if (!obj || typeof obj !== 'object') return;
      if (Array.isArray(obj)) return obj.forEach(walk);
      if (typeof obj.name === 'string' && obj.name.trim()) {
        const n = obj.name.trim();
        if (!seen.has(n)) { seen.add(n); names.push(n); }
      }
      for (const k of Object.keys(obj)) walk(obj[k]);
    }
    walk(data);

    console.log('HTTP status:', res.status);
    if (names.length) {
      console.log('Found team names (first 30):');
      names.slice(0, 30).forEach((n, i) => console.log(`${i+1}. ${n}`));
      console.log(`Total extracted names: ${names.length}`);
      process.exit(0);
    }

    console.log('No `name` fields discovered in response tree — printing JSON root keys:');
    console.log(Object.keys(data));
    process.exit(3);
  } catch (err) {
    console.error('Request failed:', err && err.message ? err.message : err);
    process.exit(2);
  }
})();
