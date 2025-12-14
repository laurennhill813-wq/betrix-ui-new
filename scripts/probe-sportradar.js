#!/usr/bin/env node
/*
Probe Sportradar endpoints for a given API key.
Writes results to `tests/run-sportradar-probe.json` and prints a summary.

Usage:
  SPORTRADAR_KEY=yourkey node scripts/probe-sportradar.js [YYYY-MM-DD]
If date is omitted, today (UTC) is used.
*/
const fs = require('fs');
const { URL } = require('url');

const key = process.env.SPORTRADAR_KEY || process.env.SPORTRADAR_API_KEY;
if (!key) {
  console.error('Missing SPORTRADAR_KEY environment variable');
  process.exit(2);
}

const base = process.env.SPORTRADAR_BASE || 'https://api.sportradar.com';
const dateArg = process.argv[2] || new Date().toISOString().slice(0, 10);

const routes = {
  competitions: [
    '/soccer/v4/en/competitions.json',
    '/soccer/v4/competitions.json',
    '/soccer/trial/v4/en/competitions.json',
    '/soccer/trial/v4/competitions.json'
  ],
  matches_by_date: [
    `/soccer/v4/en/matches/${dateArg}/schedule.json`,
    `/soccer/v4/en/matches/${dateArg}/matches.json`,
    `/soccer/trial/v4/en/matches/${dateArg}/schedule.json`,
    `/soccer/trial/v4/en/matches/${dateArg}/matches.json`,
    `/soccer/v4/en/matches_by_date/${dateArg}.json`,
    `/soccer/trial/v4/en/matches_by_date/${dateArg}.json`
  ]
};

async function tryUrl(u) {
  try {
    const res = await fetch(u, { method: 'GET', redirect: 'follow' });
    const text = await res.text();
    return { ok: res.ok, status: res.status, statusText: res.statusText, bodySnippet: text.slice(0, 1000) };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

async function run() {
  const out = { generated_at: new Date().toISOString(), base, probes: {} };
  for (const [name, candidates] of Object.entries(routes)) {
    out.probes[name] = [];
    for (const path of candidates) {
      const url = new URL(path, base);
      url.searchParams.set('api_key', key);
      process.stdout.write(`Trying ${url.href} ... `);
      // eslint-disable-next-line no-await-in-loop
      const r = await tryUrl(url.href);
      out.probes[name].push({ url: url.href, result: r });
      if (r.ok) {
        console.log(`OK ${r.status}`);
      } else if (r.status) {
        console.log(`${r.status} ${r.statusText}`);
      } else {
        console.log(`ERR ${r.error}`);
      }
    }
  }
  const dest = 'tests/run-sportradar-probe.json';
  try {
    fs.mkdirSync('tests', { recursive: true });
    fs.writeFileSync(dest, JSON.stringify(out, null, 2), 'utf8');
    console.log('\nWrote ' + dest);
  } catch (err) {
    console.error('Failed to write results:', err);
  }
  // Also print a short summary
  for (const [name, items] of Object.entries(out.probes)) {
    const ok = items.filter(i => i.result && i.result.ok);
    console.log(`\nSummary for ${name}: ${ok.length} successful routes (of ${items.length})`);
    items.forEach(it => {
      const s = it.result && it.result.status ? `${it.result.status}` : (it.result && it.result.error) || 'unknown';
      console.log(` - ${it.url} -> ${s}`);
    });
  }
}

run().catch(e => {
  console.error('Probe failed', e);
  process.exit(1);
});
