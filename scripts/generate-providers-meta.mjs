#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const integrationFile = 'integration-output.json';
const outFile = 'providers-meta.json';

if (!fs.existsSync(integrationFile)) {
  console.error('Missing', integrationFile);
  process.exit(2);
}

const data = JSON.parse(fs.readFileSync(integrationFile, 'utf8'));

// Try to import normalizers
let dispatch = null;
try {
  const modPath = path.join(process.cwd(), 'src', 'lib', 'rapidapi-normalizers.js');
  dispatch = (await import('../' + modPath.replace(/\\/g, '/'))).dispatch;
} catch (e) {
  try {
    const mod = await import('../src/lib/rapidapi-normalizers.js');
    dispatch = mod.dispatch;
  } catch (e2) {
    dispatch = null;
  }
}

const out = [];
for (const p of data) {
  const host = p.meta?.sourceHost || p._host || null;
  const provider = p.provider || host;
  if (dispatch && host && dispatch[host]) {
    try {
      const meta = dispatch[host](p);
      out.push({ provider, host, meta });
      continue;
    } catch (e) {
      out.push({ provider, host, error: e.message });
      continue;
    }
  }
  // fallback: expose items as-is
  out.push({ provider, host, meta: { kind: p.kind || p.type || 'unknown', items: p.teams || p.seasons || p.conferences || p.items || [] } });
}

fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
console.log('Wrote', outFile);
