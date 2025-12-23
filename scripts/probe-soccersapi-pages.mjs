import fetch from 'node-fetch';
(async()=>{
  for(let p=1;p<=10;p++){
    const url=`https://api.soccersapi.com/v2.2/leagues/?user=28Ekz&token=PT0s9YfsZO&t=list&page=${p}`;
    try{
      const r=await fetch(url,{headers:{Accept:'application/json'}});
      const b=await r.json();
      const len=Array.isArray(b.data)?b.data.length:(Array.isArray(b.items)?b.items.length:0);
      console.log('page',p,'status',r.status,'len',len);
    }catch(e){console.error('err',p,e.message)}
  }
})();
