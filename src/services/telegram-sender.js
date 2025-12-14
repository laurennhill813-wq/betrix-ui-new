import fetch from 'node-fetch';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) console.warn('TELEGRAM_BOT_TOKEN not set - telegram sends will be disabled');

export async function sendPhotoWithCaption({ chatId, photoUrl, caption, parse_mode = 'Markdown' }) {
  if (!BOT_TOKEN) return;
  if (!chatId) {
    console.warn('sendPhotoWithCaption: chatId missing');
    return;
  }

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`;
  const body = { chat_id: chatId, photo: photoUrl, caption, parse_mode };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('Telegram sendPhoto failed', res.status, text.slice ? text.slice(0,200) : text);
    }
  } catch (err) {
    console.error('Telegram sendPhoto network error', err && err.message ? err.message : err);
  }
}

export default { sendPhotoWithCaption };
