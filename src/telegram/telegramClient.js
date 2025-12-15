// Minimal Telegram client using global fetch (Node 20+)
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || process.env.TELEGRAM_BOT_TOKEN || null;
const TELEGRAM_BASE = TELEGRAM_TOKEN ? `https://api.telegram.org/bot${TELEGRAM_TOKEN}` : null;

async function safeFetch(path, body) {
  if (!TELEGRAM_BASE) throw new Error('Missing TELEGRAM_TOKEN');
  const url = `${TELEGRAM_BASE}${path}`;
  const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await resp.json().catch(() => null);
  if (!json || !json.ok) throw new Error('Telegram API error: ' + JSON.stringify(json));
  return json;
}

export async function sendTelegramMessage(chatId, text, options = {}) {
  if (!TELEGRAM_TOKEN) {
    console.warn('[Telegram] TELEGRAM_TOKEN not set; skipping sendTelegramMessage');
    return null;
  }
  try {
    const payload = Object.assign({ chat_id: chatId, text }, options);
    return await safeFetch('/sendMessage', payload);
  } catch (err) {
    console.error('[Telegram] sendMessage failed', err?.message || err);
    return null;
  }
}

export async function sendTelegramPhoto(chatId, photoUrl, caption, options = {}) {
  if (!TELEGRAM_TOKEN) {
    console.warn('[Telegram] TELEGRAM_TOKEN not set; skipping sendTelegramPhoto');
    return null;
  }
  try {
    const payload = Object.assign({ chat_id: chatId, photo: photoUrl, caption }, options);
    return await safeFetch('/sendPhoto', payload);
  } catch (err) {
    console.error('[Telegram] sendPhoto failed', err?.message || err);
    return null;
  }
}

export default { sendTelegramMessage, sendTelegramPhoto };
