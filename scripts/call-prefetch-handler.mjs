import 'dotenv/config';

// ensure TELEGRAM_ADMINS is set before importing the handler module
process.env.TELEGRAM_ADMINS = process.env.TELEGRAM_ADMINS || '12345';
import { handlePrefetchStatus } from '../src/bot/handlers/prefetch-status.js';

(async function(){
  try {
    const fakeCtx = {
      from: { id: 12345 },
      reply: (msg, opts) => { console.log('--- BOT REPLY ---'); console.log(msg); if (opts) console.log('opts:', opts); return Promise.resolve(); }
    };

    await handlePrefetchStatus(fakeCtx);
    process.exit(0);
  } catch (e) {
    console.error('Handler call failed', e?.message || e);
    process.exit(2);
  }
})();