import fs from 'fs/promises';
(async ()=>{
  const content = await fs.readFile('.env.local','utf8');
  console.log('RAW LENGTH:', content.length);
  const lines = content.split(/\r?\n/);
  console.log('LINES:', lines.length);
  for (let i=0;i<Math.min(20,lines.length);i++){
    console.log(i+1,':', JSON.stringify(lines[i]));
  }
})();
