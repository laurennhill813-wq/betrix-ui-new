import fs from 'fs';
const fixed = new URL('../.env.local.fixed', import.meta.url);
const dest = new URL('../.env.local', import.meta.url);
const data = fs.readFileSync(fixed, 'utf8');
fs.writeFileSync(dest, data, { encoding: 'utf8' });
console.log('Restored .env.local from .env.local.fixed');
