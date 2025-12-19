(async ()=>{
  try {
    await import('../tests/nowpayments.test.js');
    console.log('import succeeded');
  } catch (e) {
    console.error('IMPORT ERROR');
    console.error(e && e.stack ? e.stack : e);
  }
})();
