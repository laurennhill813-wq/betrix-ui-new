import express from "express";
import { getRedisAdapter } from './lib/redis-factory.js';
const app = express();
const redis = getRedisAdapter();
try { if (typeof redis.connect === 'function') await redis.connect(); } catch (_) {}
if (redis && typeof redis.on === 'function') {
  redis.on('connect', () => console.log('? Connected to Redis'));
  redis.on('error', (err) => console.error('? Redis error', err));
}
app.get("/health",(req,res)=>res.json({status:"ok"}));
const PORT = process.env.PORT || 10000;
app.listen(PORT,"0.0.0.0",()=>console.log(`BETRIX worker + diagnostics running on ${PORT}`));
