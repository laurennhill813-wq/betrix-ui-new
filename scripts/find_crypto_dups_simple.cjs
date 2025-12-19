const fs = require('fs');
const path = require('path');

function walk(dir, fileList = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', '.git', '.history', 'archive', 'attached_assets', '.local'].includes(e.name)) continue;
      walk(full, fileList);
    } else if (e.isFile() && full.endsWith('.js') || full.endsWith('.mjs') || full.endsWith('.cjs')) {
      fileList.push(full);
    }
  }
  return fileList;
}

const root = path.resolve(__dirname, '..');
const files = walk(root);
const results = [];
for (const f of files) {
  try {
    const s = fs.readFileSync(f, 'utf8');
    const matches = s.match(/import\s+crypto\s+from\s+['"]crypto['"]/g) || [];
    if (matches.length > 1) results.push({ file: path.relative(root, f), count: matches.length });
  } catch (e) {}
}
console.log(JSON.stringify(results, null, 2));
