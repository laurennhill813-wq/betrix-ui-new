#!/usr/bin/env node
import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const keywords = [
  'Lakers','Yankees','Patriots','Bruins','Ferrari','Nadal','Federer','Cowboys',
  'Dodgers','Celtics','Rams','Packers','Warriors','Mavericks','Rangers','Bruins',
  'Red Sox','Yankees','Bulls','Blackhawks','NHL','NBA','MLB','NFL','NASCAR','tennis'
];

function findFiles(dir) {
  const out = [];
  const files = readdirSync(dir, { withFileTypes: true });
  for (const f of files) {
    const p = join(dir, f.name);
    if (f.isDirectory()) {
      if (['node_modules', '.git', 'dist'].includes(f.name)) continue;
      out.push(...findFiles(p));
    } else if (/\.(js|mjs|json|ts)$/.test(f.name)) out.push(p);
  }
  return out;
}

function containsKeyword(txt) {
  const lower = txt.toLowerCase();
  return keywords.some(k => lower.includes(k.toLowerCase()));
}

function scan() {
  const files = findFiles(ROOT + '/src');
  const matches = [];
  for (const f of files) {
    try {
      const txt = readFileSync(f, 'utf8');
      if (containsKeyword(txt)) {
        matches.push({ file: f, snippet: txt.slice(0, 400) });
      }
    } catch (e) {}
  }
  const out = { scanned: files.length, matches };
  try { writeFileSync(join(ROOT, 'ci-logs', 'nonfootball-placeholders.json'), JSON.stringify(out, null, 2)); } catch(e) { try { require('fs').mkdirSync(join(ROOT,'ci-logs'), { recursive: true }); writeFileSync(join(ROOT, 'ci-logs', 'nonfootball-placeholders.json'), JSON.stringify(out, null, 2)); } catch(e2) {} }
  console.log('Scan complete. Results written to ci-logs/nonfootball-placeholders.json');
}

scan();
