#!/usr/bin/env node
const Redis = require('ioredis');

async function main(){
  const url = process.argv[2] || process.env.REDIS_URL;
  if(!url){
    console.error('Usage: node scripts/redis_counts.cjs <redis-url>');
    process.exit(2);
  }
  const redis = new Redis(url);
  try{
    await redis.ping();
  }catch(err){
    console.error('Connection error:', err.message||err);
    process.exit(3);
  }

  try{
    const liveKeys = await redis.keys('rapidapi:fixtures:live:*');
    const upcomingKeys = await redis.keys('rapidapi:fixtures:upcoming:*');

    const sports = new Set();
    liveKeys.forEach(k=> sports.add(k.split(':').slice(-1)[0]));
    upcomingKeys.forEach(k=> sports.add(k.split(':').slice(-1)[0]));

    const out = {};
    for(const sport of Array.from(sports)){
      const liveKey = `rapidapi:fixtures:live:${sport}`;
      const upKey = `rapidapi:fixtures:upcoming:${sport}`;
      let liveCount = 0, upCount = 0;
      try{
        const lv = await redis.get(liveKey);
        if(lv) {
          try{ liveCount = JSON.parse(lv).length || 0 }catch(e){ liveCount = 1 }
        }
      }catch(e){}
      try{
        const uv = await redis.get(upKey);
        if(uv){
          try{ upCount = JSON.parse(uv).length || 0 }catch(e){ upCount = 1 }
        }
      }catch(e){}
      out[sport] = { live: liveCount, upcoming: upCount };
    }

    console.log(JSON.stringify({ sports: out, totalSports: Object.keys(out).length }, null, 2));
  }catch(err){
    console.error('Error:', err.message || err);
  }finally{
    redis.disconnect();
  }
}

main();
