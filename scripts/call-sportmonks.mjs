import dotenv from 'dotenv';
import path from 'path';
import { sportmonks } from '../src/services/sportmonks.js';

for (const f of ['.env.local.fixed', '.env.local', '.env']) {
  try { dotenv.config({ path: path.resolve(process.cwd(), f) }); } catch(_) {}
}

(async () => {
  const params = '&select=id,starting_at,localteam_id,visitorteam_id' + '&include=localTeam:name;visitorTeam:name';
  try {
    const r = await sportmonks('/football/fixtures', params);
    console.log('TYPE:', typeof r);
    console.log(Object.keys(r).slice(0,10));
    if (r && r.data) console.log('data length:', Array.isArray(r.data) ? r.data.length : 'not-array');
    console.log('SAMPLE:', JSON.stringify(r).substring(0,800));
  } catch (e) { console.error(e); }
  process.exit(0);
})();
