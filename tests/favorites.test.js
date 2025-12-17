import assert from 'assert';
import MockRedis from './helpers/mock-redis.js';
import { handleCallbackQuery } from '../src/handlers/handler-complete.js';

// Minimal integration test for favorites flow
async function run() {
  const redis = new MockRedis();
  const cq = {
    id: 'cb_1',
    from: { id: 424242 },
    message: { chat: { id: 9999 }, message_id: 1 },
    data: 'favorites'
  };
  const res = await handleCallbackQuery(cq, redis, {});
  assert(res && (res.method === 'editMessageText' || res.method === 'sendMessage'));

  // simulate add prompt
  cq.data = 'favorites_add_prompt';
  const r2 = await handleCallbackQuery(cq, redis, {});
  assert(r2 && r2.method === 'sendMessage');

  // simulate user sending team name (handled by telegram-handler-v2 in real flow)
  // emulate what handler would do: set the state and then call the message handler
  await redis.set('favorites:424242:state', 'awaiting_add');
  const fakeMessageUpdate = { message: { chat: { id: 9999 }, from: { id: 424242 }, text: 'Arsenal' } };
  const v2 = await import('../src/handlers/telegram-handler-v2.js');
  const r3 = await v2.handleMessage(fakeMessageUpdate, redis, {});
  assert(r3 && r3.method === 'sendMessage');

  // verify user persisted
  const stored = JSON.parse(await redis.get('user:424242'));
  assert(Array.isArray(stored.favorites) && stored.favorites.includes('Arsenal'));

  console.log('✔ favorites flow test passed');
}

run().catch(e => { console.error(e); process.exit(1); });
