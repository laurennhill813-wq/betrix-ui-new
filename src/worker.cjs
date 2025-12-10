import express from "express"; import Redis from "ioredis"; const app = express();
const redis = new Redis(process.env.REDIS_URL, {
  tls: { rejectUnauthorized: true },
  maxRetriesPerRequest: 5
});
redis.on("connect",()=>console.log("? Connected to Redis"));
redis.on("error",(err)=>console.error("? Redis error",err));
app.get("/health",(req,res)=>res.json({status:"ok"}));
const PORT = process.env.PORT || 10000;
app.listen(PORT,"0.0.0.0",()=>console.log(`BETRIX worker + diagnostics running on ${PORT}`));
