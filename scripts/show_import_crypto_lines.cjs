const fs = require('fs');
const path = 'src/payments/nowpayments.js';
const s = fs.readFileSync(path, 'utf8');
const lines = s.split(/\r?\n/);
lines.forEach((ln, i) => {
  if (ln.includes("import crypto from")) console.log(i+1, ln);
});
console.log('total lines:', lines.length);
