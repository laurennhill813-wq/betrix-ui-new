#!/usr/bin/env node
const Redis = require('ioredis');
const url = process.argv[2] || process.env.REDIS_URL;
if(!url){
  console.error('Usage: node scripts/get_specific_keys.cjs <redis-url>');
  process.exit(2);
}
const redis = new Redis(url);
(async()=>{
  try{
    await redis.ping();
    const keys = [
      'rapidapi:fixtures:live:total',
      'rapidapi:fixtures:upcoming:total',
      'rapidapi:fixtures:live:soccer',
      'rapidapi:fixtures:upcoming:soccer',
      'rapidapi:fixtures:list',
      'rapidapi:fixtures:providers'
    ];
    const out = {};
    for(const k of keys){
      const type = await redis.type(k);
      let raw = null;
      if(type === 'string') raw = await redis.get(k);
      else if(type === 'list') raw = await redis.lrange(k,0,200);
      else if(type === 'set') raw = await redis.smembers(k);
      else if(type === 'hash') raw = await redis.hgetall(k);
      else if(type === 'zset') raw = await redis.zrange(k,0,200,'WITHSCORES');
      out[k] = { type, raw };
    }
    console.log(JSON.stringify(out, null, 2));
  }catch(e){
    console.error('Error:', e.message||e);
  }finally{
    redis.disconnect();
  }
})();
