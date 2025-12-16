import telemetry from '../src/brain/telemetry.js';

(async ()=>{
  try {
    const a = await telemetry.getCounter('upload_fallback_attempts');
    const s = await telemetry.getCounter('upload_fallback_success');
    const f = await telemetry.getCounter('upload_fallback_failures');
    console.log('upload_fallback_attempts=', a);
    console.log('upload_fallback_success=', s);
    console.log('upload_fallback_failures=', f);
  } catch (e) {
    console.error('err', e && e.message ? e.message : e);
  }
})();
