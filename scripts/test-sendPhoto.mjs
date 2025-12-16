import { sendPhotoWithCaption } from '../src/services/telegram-sender.js';

function envOrExit(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env ${name}. Set it before running the script.`);
    process.exit(1);
  }
  return v;
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || null;
const TEST_CHAT = process.env.TEST_CHAT_ID || process.env.BOT_BROADCAST_CHAT_ID || null;

if (!BOT_TOKEN || !TEST_CHAT) {
  console.error('Please set TELEGAM_BOT_TOKEN (or TELEGRAM_BOT_TOKEN) and TEST_CHAT_ID (or BOT_BROADCAST_CHAT_ID)');
  console.error('Example (PowerShell):');
  console.error('$env:TELEGRAM_BOT_TOKEN = "<your-token>"');
  console.error('$env:TEST_CHAT_ID = "<chat-id>"');
  console.error('Then run: node scripts/test-sendPhoto.mjs');
  process.exit(1);
}

(async function run() {
  try {
    console.log('Sending test: good image URL (should post normally)');
    const good = 'https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png';
    await sendPhotoWithCaption({ chatId: TEST_CHAT, photoUrl: good, caption: 'Test image — good URL' });
    console.log('Good URL send attempted (check chat).');

    console.log('Sending test: bad image URL (expected to trigger upload fallback when Telegram rejects)');
    const bad = process.env.BAD_URL || 'https://example.com/';
    await sendPhotoWithCaption({ chatId: TEST_CHAT, photoUrl: bad, caption: 'Test image — bad URL (should attempt upload fallback)' });
    console.log('Bad URL send attempted (check logs for upload fallback).');
  } catch (err) {
    console.error('Test script error', err && err.message ? err.message : err);
  }
})();
