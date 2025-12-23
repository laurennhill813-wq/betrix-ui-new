#!/usr/bin/env node
import fs from 'fs';
import { dispatch } from '../src/lib/rapidapi-normalizers.js';

const inFile = 'normalized-providers.json';
const outFile = 'integration-output.json';
if (!fs.existsSync(inFile)) {
  console.error('Missing input:', inFile);
  process.exit(2);
}
const data = JSON.parse(fs.readFileSync(inFile, 'utf8'));
const integrated = [];
for (const p of data) {
  const host = p._host || null;
  const fn = host && dispatch[host];
  if (fn) {
    try {
      integrated.push(fn(p));
    } catch (e) {
      integrated.push({ provider: p.provider || host, error: e.message, raw: p });
    }
  } else {
    // fallback mapping
    if (p.type === 'teams' || p.type === 'conferences') {
      integrated.push({ provider: p.provider || host, kind: 'team-list', teams: p.items || [], meta: { sourceHost: host } });
    } else if (p.type === 'seasons') {
      integrated.push({ provider: p.provider || host, kind: 'season-list', seasons: p.items || [], meta: { sourceHost: host } });
    } else if (p.type === 'odds') {
      integrated.push({ provider: p.provider || host, kind: 'odds-market', markets: p.items || [], meta: { sourceHost: host, hasOdds: !!(p.metadata && p.metadata.hasOdds) } });
    } else {
      integrated.push({ provider: p.provider || host, kind: 'unknown', meta: { sourceHost: host, status: p._status || null } });
    }
  }
}
fs.writeFileSync(outFile, JSON.stringify(integrated, null, 2));
console.log('Wrote', outFile);
