import assert from 'assert';

// Simple Telegram bot smoke test — single copy, no shebangs
class MockRedis {
  constructor() { this.data = {}; }
  async hgetall(k) { return this.data[k] || {}; }
  async hset(k, v) { this.data[k] = v; return 1; }
  async get(k) { return this.data[k] ?? null; }
  async setex(k, t, v) { this.data[k] = v; return 'OK'; }
}

const mockServices = {
  telegram: {
    sendMessage: async (chatId, text) => ({ ok: true, result: { message_id: 1 }, chat_id: chatId, text }),
    editMessage: async () => ({ ok: true }),
  },
  api: {},
};

async function runTests() {
  console.log('\n🧪 Starting BETRIX Bot Command Tests (clean)...\n');
  const redis = new MockRedis();

  try {
    const { handleCommand } = await import('../src/handlers/commands.js');
    const { handleCallback } = await import('../src/handlers/callbacks.js');

    const userId = 123456;
    const chatId = 789012;

    const start = await handleCommand('/start', chatId, userId, redis, mockServices);
    assert(start && (start.chat_id === chatId || start.chatId === chatId), '/start should return chat id');

    const menu = await handleCommand('/menu', chatId, userId, redis, mockServices);
    assert(menu && menu.reply_markup && menu.reply_markup.inline_keyboard, '/menu should include inline keyboard');

    const help = await handleCommand('/help', chatId, userId, redis, mockServices);
    assert(help && typeof help.text === 'string', '/help should return text');

    const menuCb = await handleCallback('menu_main', chatId, userId, redis, mockServices);
    assert(menuCb && menuCb.reply_markup, 'menu_main callback should return reply_markup');

    console.log('\n✅ Telegram bot smoke tests passed.');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Telegram bot smoke tests failed:', err && err.message);
    console.error(err && err.stack);
    process.exit(1);
  }
}

const _isMain = (typeof require !== 'undefined') ? require.main === module : (import.meta && import.meta.url === `file://${process.argv[1]}`);
if (_isMain) {
  runTests();
}
