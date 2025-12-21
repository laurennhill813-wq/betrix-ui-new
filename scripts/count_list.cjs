#!/usr/bin/env node
const Redis = require('ioredis');
const url = process.argv[2] || process.env.REDIS_URL;
if(!url){
  console.error('Usage: node scripts/count_list.cjs <redis-url>');
  process.exit(2);
}
const redis = new Redis(url);
(async()=>{
  try{
    await redis.ping();
    const raw = await redis.get('rapidapi:fixtures:list');
    if(!raw){
      console.log('no-list');
      return;
    }
    const arr = JSON.parse(raw);
    console.log(JSON.stringify({ fixturesListLength: arr.length }, null, 2));
  }catch(e){
    console.error('Error:', e.message||e);
  }finally{ redis.disconnect(); }
})();
