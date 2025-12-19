const fs = require('fs');
const glob = require('glob');
const pat = 'import crypto from "crypto"';

glob('**/*.js', { ignore: ['node_modules/**', '.history/**', 'archive/**'] }, (er, files) => {
  const bad = [];
  files.forEach(f => {
    try {
      const s = fs.readFileSync(f, 'utf8');
      const c = (s.match(new RegExp(pat, 'g')) || []).length;
      if (c > 1) bad.push({ f, c });
    } catch (e) {}
  });
  console.log(JSON.stringify(bad, null, 2));
});
