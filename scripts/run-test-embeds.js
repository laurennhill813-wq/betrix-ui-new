const fs = require('fs');
(async function(){
  try{
    const content = fs.readFileSync('.env.local','utf8');
    for (const line of content.split(/\r?\n/)){
      if (!line || !line.includes('=')) continue;
      const [k,v] = line.split('=',2);
      process.env[k] = v;
    }
    // import the ESM test script
    await import('../scripts/test-azure-embeddings.mjs');
  } catch (e){
    console.error('run-test-embeds failed:', e && e.message? e.message : e);
    process.exit(2);
  }
})();
