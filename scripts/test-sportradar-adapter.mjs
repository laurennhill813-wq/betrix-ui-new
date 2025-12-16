import { getSportradarImages } from '../src/data/images-sportradar.js';
import { sendPhotoWithCaption } from '../src/services/telegram-sender.js';

const KEY = process.env.SPORTRADAR_API_KEY || null;
const CHAT = process.env.TEST_CHAT_ID || process.env.BOT_BROADCAST_CHAT_ID || null;

if (!KEY) {
  console.error('Missing SPORTRADAR_API_KEY');
  process.exit(1);
}
if (!CHAT) {
  console.error('Missing TEST_CHAT_ID');
  process.exit(1);
}

(async function run() {
  try {
    const ev = { sport: 'soccer', league: 'premier-league', id: null, date: null };
    const imgs = await getSportradarImages(ev);
    console.log('Adapter returned', imgs.length, 'candidates');
    if (!imgs || imgs.length === 0) {
      console.error('No candidates found');
      process.exit(1);
    }

    const img = imgs[0];
    console.log('Posting candidate', img.url, img.source);
    await sendPhotoWithCaption({ chatId: CHAT, photoUrl: img.url, caption: `Sportradar adapter post (${img.source})` });
    console.log('Posted (or attempted)');
  } catch (e) {
    console.error('Test failed', e && e.message ? e.message : e);
    process.exit(1);
  }
})();
