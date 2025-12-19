#!/usr/bin/env node
import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const keywords = [
  'lakers','yankees','patriots','bruins','ferrari','nadal','federer','cowboys',
  'dodgers','celtics','rams','packers','warriors','mavericks','rangers','red sox',
  'bulls','blackhawks','nba','mlb','nfl','nhl','nascar','tennis'
];

function findFiles(dir) {
  const out = [];
  const files = readdirSync(dir, { withFileTypes: true });
  for (const f of files) {
    const p = join(dir, f.name);
    if (f.isDirectory()) {
      if (['node_modules', '.git', 'dist'].includes(f.name)) continue;
      out.push(...findFiles(p));
    } else if (/\.(js|mjs|ts)$/.test(f.name)) out.push(p);
  }
  return out;
}

function findArraysWithKeywords(txt) {
  const results = [];
  // crude regex: find [ ... ] blocks up to 500 chars long
  const arrRe = /\[([^\]]{0,500})\]/gms;
  let m;
  while ((m = arrRe.exec(txt))) {
    const content = m[1];
    const lower = content.toLowerCase();
    if (keywords.some(k => lower.includes(k))) {
      results.push(content.trim());
    }
  }
  return results;
}

function scan() {
  const files = findFiles(join(ROOT, 'src'));
  const out = [];
  for (const f of files) {
    try {
      const txt = readFileSync(f, 'utf8');
      const arrs = findArraysWithKeywords(txt);
      if (arrs.length) out.push({ file: f, arrays: arrs });
    } catch (e) {}
  }
  const outPath = join(ROOT, 'ci-logs', 'array-placeholder-extract.json');
  try { writeFileSync(outPath, JSON.stringify(out, null, 2)); } catch(e){ try { require('fs').mkdirSync(join(ROOT,'ci-logs'),{recursive:true}); writeFileSync(outPath, JSON.stringify(out, null, 2)); } catch(e2){} }
  console.log('Wrote', outPath);
}

scan();
