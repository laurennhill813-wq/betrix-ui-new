#!/usr/bin/env node
import fs from 'fs';
import { normalizers } from './normalizers/index.js';

const inFile = 'test-provided-results.json';
const outFile = 'normalized-providers.json';

if (!fs.existsSync(inFile)) {
  console.error('Input file not found:', inFile);
  process.exit(2);
}

const data = JSON.parse(fs.readFileSync(inFile, 'utf8'));
const normalized = [];
for (const r of data) {
  const host = r.host;
  const normalizer = normalizers[host];
  if (normalizer) {
    try {
      const n = normalizer(r);
      n._host = host;
      n._status = r.status || null;
      n._hasBody = !!r.hasBody;
      n._teamsCount = r.teamsCount || 0;
      normalized.push(n);
    } catch (e) {
      normalized.push({ provider: host, error: e.message, raw: r });
    }
  } else {
    // fallback: if teams present, expose them
    if (r.teamsCount && r.teamsCount > 0) {
      normalized.push({ provider: host, type: 'teams', items: r.teams || [], _host: host });
    } else {
      normalized.push({ provider: host, type: 'unknown', _host: host, _status: r.status || null });
    }
  }
}

fs.writeFileSync(outFile, JSON.stringify(normalized, null, 2));
console.log('Wrote', outFile);
