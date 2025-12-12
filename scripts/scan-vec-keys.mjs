import fs from 'fs';
import Redis from 'ioredis';
const envText = fs.readFileSync(new URL('../.env.local.fixed', import.meta.url), 'utf8');
const env = Object.fromEntries(envText.split(/\r?\n/).filter(Boolean).map(l=>{const i=l.indexOf('=');return [l.slice(0,i), l.slice(i+1)];}));
const client = new Redis(env.REDIS_URL);
(async ()=>{
  const keys = await client.keys('vec:*');
  console.log('vec keys:', keys.slice(0,20));
  if(keys.length>0){
    const k = keys[0];
    const h = await client.hgetall(k);
    console.log('sample',k, Object.keys(h));
  }
  client.disconnect();
})();
