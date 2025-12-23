import fetch from 'node-fetch';
(async()=>{
  const url='https://api.soccersapi.com/v2.2/leagues/?user=28Ekz&token=PT0s9YfsZO&t=list';
  let names=[];
  for(let p=1;;p++){
    const r=await fetch(url+`&page=${p}`);
    const b=await r.json();
    const leagues=Array.isArray(b.data)?b.data:(Array.isArray(b.items)?b.items:[]);
    if(!leagues||leagues.length===0) break;
    leagues.forEach(l=>names.push((l.name||l.title||l.league||'').toLowerCase()));
    if(leagues.length<100) break;
  }
  const uniq=[...new Set(names)];
  console.log('total',uniq.length);
  const q=['major','mls','j. league','j league','jleague','j.league','j.league','j1','j2','j3'];
  for(const term of q){
    console.log('---',term);
    console.log(uniq.filter(n=>n.includes(term)).slice(0,20));
  }
})();
