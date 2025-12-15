import { sendTelegramMessage, sendTelegramPhoto } from './telegramClient.js';

const BROADCAST_CHAT_ID = process.env.BOT_BROADCAST_CHAT_ID || null;

export function getBroadcastChatId() {
  return BROADCAST_CHAT_ID;
}

export async function broadcastText(text, options = {}) {
  if (!BROADCAST_CHAT_ID) {
    console.warn('[Broadcast] BOT_BROADCAST_CHAT_ID not set; skipping broadcastText');
    return null;
  }
  return sendTelegramMessage(BROADCAST_CHAT_ID, text, options);
}

export async function broadcastPhoto(photoUrl, caption, options = {}) {
  if (!BROADCAST_CHAT_ID) {
    console.warn('[Broadcast] BOT_BROADCAST_CHAT_ID not set; skipping broadcastPhoto');
    return null;
  }
  return sendTelegramPhoto(BROADCAST_CHAT_ID, photoUrl, caption, options);
}

export default { getBroadcastChatId, broadcastText, broadcastPhoto };
