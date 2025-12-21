#!/usr/bin/env node
const Redis = require('ioredis');
const url = process.argv[2] || process.env.REDIS_URL;
if(!url){
  console.error('Usage: node scripts/list_rapidapi_keys.cjs <redis-url>');
  process.exit(2);
}
const redis = new Redis(url);
(async()=>{
  try{
    await redis.ping();
    const keys = await redis.keys('rapidapi:*');
    console.log(JSON.stringify({ count: keys.length, keys: keys.slice(0,200) }, null, 2));
  }catch(e){
    console.error('Error:', e.message||e);
  }finally{
    redis.disconnect();
  }
})();
