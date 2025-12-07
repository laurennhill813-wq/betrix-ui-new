#!/usr/bin/env node
const fetch = (...args) => import('node-fetch').then(m=>m.default(...args));
(async()=>{
  const serviceId = process.argv[2] || 'srv-d4546263jp1c73eiu4n0';
  const key = process.env.RENDER_API_KEY;
  if(!key){ console.error('No RENDER_API_KEY'); process.exit(1); }

  // To avoid committing secrets into the repo, this script reads values from
  // environment variables at runtime. If a variable is not present, the
  // script will send a placeholder value to Render so you can review.
  const keys = [
    'ADMIN_DEBUG_TOKEN','ADMIN_PASSWORD','ADMIN_TOKEN','ADMIN_USERNAME','ADMIN_USER_IDS',
    'API_FOOTBALL_BASE','API_FOOTBALL_KEY','AZURE_OPENAI_API_VERSION','AZURE_OPENAI_DEPLOYMENT',
    'AZURE_OPENAI_ENDPOINT','AZURE_OPENAI_KEY','BINANCE_API_KEY','BINANCE_API_SECRET',
    'BURST_CAPACITY','COHERE_API_KEY','DATABASE_URL','DEDUPE_ENABLED','DEFAULT_TIMEZONE',
    'DEPLOY_ENV','EXCHANGERATE_API_KE','FOOTBALL_DATA_API','GEMINI_API_KEY','HF_TOKEN',
    'HUGGINGFACE_MODELS','HUGGINGFACE_TOKEN','IMGBB_API_KEY','IPAPI_KEY','LIPANA_API_KEY',
    'LIPANA_CALLBACK_URL','LIPANA_SECRET','LIPANA_WEBHOOK_SECRET','NODE_ENV','OPENWEATHER_API_KEY',
    'PAYPAL_CLIENT_ID','PAYPAL_CLIENT_SECRET','PERFORM_API_BASE','PERFORM_MATCH_ODDS_PATH','PGSSLMODE',
    'RATE_LIMIT_PER_MINUTE','REDIS_PASSWORD','REDIS_TLS_FORCE','REDIS_URL','REDIS_USERNAME',
    'REWARD_REFERRER_AMOUNT','REWARD_SIGNUP_AMOUNT','SHUTDOWN_TIMEOUT_MS','SPORTSMONKS_API','STATPAL_API',
    'TELEGRAM_SAFE_CHUNK','TELEGRAM_TOKEN','TELEGRAM_WEBHOOK_SECRET','TELEGRAM_WEBHOOK_URL','THEODDS_API_KEY',
    'UPSTASH_READONLY_TOKEN','UPSTASH_REST_TOKEN','UPSTASH_REST_URL','USE_STUB_AI'
  ];

  const vars = {};
  for(const k of keys){
    // Read from environment at runtime; fallback to a placeholder string.
    vars[k] = process.env[k] || `<REDACTED_${k}>`;
  }

  function isSecure(name){
    const sensitive = ['KEY','SECRET','TOKEN','PASSWORD','PASS','CLIENT_SECRET','API_','_KEY','_SECRET'];
    return sensitive.some(s=> name.toUpperCase().includes(s));
  }

  let success = 0;
  let failed = 0;
  for(const [k,v] of Object.entries(vars)){
    try{
      const body = { key: k, value: v, secure: !!isSecure(k) };
      const res = await fetch(`https://api.render.com/v1/services/${serviceId}/env-vars`, { method: 'POST', headers: { Authorization: 'Bearer '+key, 'Content-Type':'application/json' }, body: JSON.stringify(body) });
      const txt = await res.text();
      if(res.status===201 || res.status===200){ success++; }
      else { failed++; console.error('ERR',k,res.status,txt.slice(0,200)); }
      await new Promise(r=>setTimeout(r,200));
    }catch(e){ failed++; console.error('EXC',k,e.message); }
  }
  console.log(`Done. success=${success}, failed=${failed}`);
})();
