import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

async function main() {
  const subsPath = path.join(process.cwd(), 'src', 'rapidapi', 'subscriptions.json');
  const raw = fs.readFileSync(subsPath, 'utf8');
  const subs = JSON.parse(raw);
  const entry = (Array.isArray(subs) ? subs.find(s => s.host && s.host.includes('soccersapi')) : null) || subs.soccersapi;
  const url = entry && (entry.directUrl || entry.sampleEndpoints && entry.sampleEndpoints[0]);
  if (!url) {
    console.error('SoccersAPI directUrl not found in subscriptions.json');
    process.exit(2);
  }
  console.log('Fetching SoccersAPI leagues (paginated) from:', url);
  const nameSet = new Set();
  let totalFetched = 0;
  for (let page = 1; page <= 200; page++) {
    const pUrl = url.includes('?') ? `${url}&page=${page}` : `${url}?page=${page}`;
    const r = await fetch(pUrl, { headers: { Accept: 'application/json' } });
    if (!r.ok) {
      console.error('Fetch failed (page', page, '):', r.status, r.statusText);
      break;
    }
    const body = await r.json();
    const leagues = Array.isArray(body.data) ? body.data : (Array.isArray(body.items) ? body.items : []);
    if (!leagues || leagues.length === 0) break;
    leagues.forEach(l => {
      const name = (l.name || l.title || l.league || '').toLowerCase().trim();
      if (name) nameSet.add(name);
    });
    totalFetched += leagues.length;
    console.log('page', page, 'fetched', leagues.length, 'total', totalFetched);
    // Stop early if less than page size
    if (leagues.length < 100) break;
  }
  console.log('Total unique league names fetched:', nameSet.size);

  // Load required list
  const reqPath = path.join(process.cwd(), 'scripts', 'required-leagues.txt');
  if (!fs.existsSync(reqPath)) {
    console.error('Please create scripts/required-leagues.txt with one league name per line to validate.');
    process.exit(2);
  }
  const reqRaw = fs.readFileSync(reqPath, 'utf8');
  const reqNames = reqRaw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);

  const missing = [];
  for (const q of reqNames) {
    const qNorm = q.toLowerCase();
    if (nameSet.has(qNorm)) continue;
    // Try substring match
    let found = false;
    for (const n of nameSet) {
      if (n.includes(qNorm) || qNorm.includes(n)) { found = true; break; }
    }
    if (!found) missing.push(q);
  }

  console.log('\nValidation report:');
  console.log('Required leagues checked:', reqNames.length);
  console.log('Missing leagues:', missing.length);
  if (missing.length) {
    console.log(missing.join('\n'));
    process.exit(3);
  }
  console.log('All required leagues are present in SoccersAPI response.');
}

main().catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
