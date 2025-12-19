import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

function findFiles(dir) {
  const out = [];
  const files = readdirSync(dir, { withFileTypes: true });
  for (const f of files) {
    const p = join(dir, f.name);
    if (f.isDirectory()) out.push(...findFiles(p));
    else out.push(p);
  }
  return out;
}

const root = join(process.cwd(), 'src');
const files = findFiles(root).filter((p) => p.endsWith('.js') || p.endsWith('.mjs'));
for (const f of files) {
  try {
    const txt = readFileSync(f, 'utf8');
    const matches = (txt.match(/from\s+['"]crypto['"]/g) || []).length;
    if (matches > 1) {
      console.log('File imports crypto multiple times:', f, 'count=', matches);
    }
  } catch (e) {}
}
console.log('done');
