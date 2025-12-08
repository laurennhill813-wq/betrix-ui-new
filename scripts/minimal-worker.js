#!/usr/bin/env node
/**
 * Minimal worker that reads `outgoing:telegram` list from Redis and sends messages via TelegramService.
 * Run this as a separate process (recommended) with the same env as the web service.
 */
import { getRedis } from '../src/lib/redis-factory.js';
import TelegramService from '../src/services/telegram.js';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  const token = process.env.TELEGRAM_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error('TELEGRAM_TOKEN not set, worker exiting');
    process.exit(2);
  }
  const telegram = new TelegramService(token, Number(process.env.TELEGRAM_SAFE_CHUNK || 2000));
  const redis = getRedis();
  console.log('Minimal worker started - polling outgoing:telegram');

  while (true) {
    try {
      // brpop with timeout=5 equivalent
      const item = await redis.brpoplpush ? await redis.brpoplpush('outgoing:telegram', 'outgoing:processing', 5) : await redis.lpop('outgoing:telegram');
      if (!item) {
        await sleep(1000);
        continue;
      }

      // item expected to be JSON { chatId, text, options }
      let obj = null;
      try { obj = JSON.parse(item); } catch (e) { console.warn('Invalid outgoing item', item); continue; }

      try {
        await telegram.sendMessage(obj.chatId, obj.text, obj.options || {});
        console.log('Sent Telegram message to', obj.chatId);
      } catch (e) {
        console.error('Failed to send Telegram message', e?.message || e);
        // push back to queue for retry
        try { await redis.rpush('outgoing:telegram', item); } catch(e2){ console.error('Failed to requeue', e2); }
        await sleep(2000);
      }
      // remove from processing list if using brpoplpush pattern
      try { if (redis.lrem) await redis.lrem('outgoing:processing', 1, item); } catch(e){ /* ignore */ }
    } catch (err) {
      console.error('Worker loop error', err?.message || err);
      await sleep(2000);
    }
  }
}

run().catch(e => { console.error('Worker failed', e); process.exit(1); });
