#!/usr/bin/env node
const Redis = require('ioredis');

async function main(){
  const url = process.argv[2] || process.env.REDIS_URL;
  if(!url){
    console.error('Usage: node scripts/check_redis.cjs <redis-url>');
    process.exit(2);
  }

  console.error('Connecting to', url.replace(/:(?:[^@]+)@/, ':****@'));
  const redis = new Redis(url);
  try{
    await redis.ping();
  }catch(err){
    console.error('Connection error:', err.message || err);
    process.exit(3);
  }

  try{
    const keys = await redis.keys('rapidapi:fixtures:*');
    console.log(JSON.stringify({ totalKeys: keys.length }, null, 2));
    for(const k of keys.slice(0, 200)){
      const type = await redis.type(k);
      let value = null;
      if(type === 'string'){
        value = await redis.get(k);
      } else if(type === 'list'){
        value = await redis.lrange(k, 0, 50);
      } else if(type === 'set'){
        value = await redis.smembers(k);
      } else if(type === 'hash'){
        value = await redis.hgetall(k);
      } else if(type === 'zset'){
        value = await redis.zrange(k, 0, 50, 'WITHSCORES');
      }
      let parsed = value;
      try{ parsed = JSON.parse(value); }catch(e){}
      console.log('---');
      console.log(k);
      console.log('type:', type);
      console.log('value:', typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2));
    }
  }catch(err){
    console.error('Error listing keys:', err.message || err);
  } finally{
    redis.disconnect();
  }
}

main();
