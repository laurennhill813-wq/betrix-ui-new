#!/usr/bin/env node
import fetch from 'node-fetch';

const KEY = process.env.SPORTRADAR_KEY;
if (!KEY) {
  console.error('Missing SPORTRADAR_KEY in environment');
  process.exit(1);
}

const BASE = 'https://api.sportradar.com';
const today = new Date().toISOString().slice(0,10);

const endpoints = [
  // trial/common patterns - some may return 404 if not available for account
  `/soccer/trial/v4/en/competitions.json`,
  `/soccer/trial/v4/en/matches/${today}/summaries.json`,
  `/soccer/trial/v4/en/standings.json`,
  `/soccer/trial/v4/en/seasons.json`,
  // alternative path styles
  `/soccer-xt3/en/matches/${today}/summaries.json`,
  `/soccer/en/competitions.json`,
];

async function probe(ep, { useHeader = false, useQuery = true } = {}) {
  let url = `${BASE}${ep}`;
  if (useQuery) url += `?api_key=${encodeURIComponent(KEY)}`;
  const opts = {};
  if (useHeader) opts.headers = { 'Api-Key': KEY };
  try {
    const res = await fetch(url, opts);
    const headers = Object.fromEntries(res.headers.entries());
    const text = await res.text();
    console.log('\n===', ep, 'STATUS', res.status, 'LEN', text.length);
    console.log('Request url:', url);
    console.log('Auth header used:', useHeader, 'query param used:', useQuery);
    console.log('Response headers:', headers);
    try {
      const j = JSON.parse(text);
      if (Array.isArray(j)) {
        console.log('Sample array length:', j.length);
        console.log(JSON.stringify(j.slice(0,3), null, 2));
      } else {
        console.log('Sample object keys:', Object.keys(j).slice(0,10));
        console.log(JSON.stringify(j, null, 2).substring(0,2000));
      }
    } catch (e) {
      console.log('Non-JSON body (first 1000 chars):');
      console.log(text.substring(0,1000));
    }
  } catch (err) {
    console.error('Request failed for', ep, err && err.message);
  }
}

(async ()=>{
  console.log('Testing Sportradar endpoints for date', today);
  console.log('\n--- TRY QUERY PARAM (api_key=) ---');
  for (const ep of endpoints) await probe(ep, { useHeader: false, useQuery: true });
  console.log('\n--- TRY HEADER (Api-Key) ---');
  for (const ep of endpoints) await probe(ep, { useHeader: true, useQuery: false });
})();
