import { selectBestImageForEventCombined } from '../src/media/imageSelector.js';
import { sendPhotoWithCaption } from '../src/services/telegram-sender.js';

const CHAT = process.env.TEST_CHAT_ID || process.env.BOT_BROADCAST_CHAT_ID || null;
if (!CHAT) { console.error('Missing chat env'); process.exit(1); }

(async ()=>{
  const ev = { sport: 'soccer', home: 'Manchester United', away: 'Chelsea', league: 'Premier League' };
  console.log('Selecting image for', ev.home, 'vs', ev.away);
  const cand = await selectBestImageForEventCombined(ev);
  console.log('Selected candidate:', cand);
  if (!cand || !cand.imageUrl) {
    console.error('No image candidate found'); process.exit(1);
  }
  await sendPhotoWithCaption({ chatId: CHAT, photoUrl: cand.imageUrl, caption: `Test post: ${ev.home} vs ${ev.away}` });
  console.log('Posted (or attempted)');
})();
