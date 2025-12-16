import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import os from 'os';
import path from 'path';
import telemetry from '../brain/telemetry.js';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) console.warn('TELEGRAM_BOT_TOKEN not set - telegram sends will be disabled');

export async function sendPhotoWithCaption({ chatId, photoUrl, caption, parse_mode = 'Markdown' }) {
  if (!BOT_TOKEN) return;
  if (!chatId) {
    console.warn('sendPhotoWithCaption: chatId missing');
    return;
  }
  if (!photoUrl) {
    console.warn('sendPhotoWithCaption: photoUrl missing - skipping sendPhoto');
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

      // If Telegram can't fetch the remote URL (common: wrong type of web page content),
      // attempt to fetch the image locally and upload the binary as multipart/form-data.
      try {
        const lower = String(text || '').toLowerCase();
        // Telegram returns different 400 messages when it cannot fetch remote URLs.
        // Match common patterns so we can attempt local upload fallback.
        if (res.status === 400 && (lower.includes('wrong type of the web page content') || lower.includes('failed to get http url content') || lower.includes('failed to get http url'))) {
          console.info('Telegram sendPhoto: attempting upload fallback for', photoUrl);
          try { telemetry.incCounter('upload_fallback_attempts'); } catch(e){}
          // fetch the resource ourselves
          const imgRes = await fetch(photoUrl, { redirect: 'follow' });
          const ct = imgRes.headers && imgRes.headers.get ? imgRes.headers.get('content-type') : '';

          // If the resource is directly an image, upload it
          if (imgRes.ok && ct && ct.startsWith('image/')) {
            const buf = Buffer.from(await imgRes.arrayBuffer());
            const ext = (ct.split('/')[1] || 'jpg').split(';')[0];
            const filename = `upload.${ext}`;
            const tmp = path.join(os.tmpdir(), `${Date.now()}-${filename}`);
            try {
              await fs.promises.writeFile(tmp, buf);
              const form = new FormData();
              form.append('chat_id', String(chatId));
              if (caption) form.append('caption', caption);
              form.append('photo', fs.createReadStream(tmp), { filename, contentType: ct });

              const headers = form.getHeaders();
              const retryRes = await fetch(url, { method: 'POST', body: form, headers });
              if (!retryRes.ok) {
                const rtxt = await retryRes.text().catch(() => '');
                console.error('Telegram sendPhoto (upload) failed', retryRes.status, rtxt.slice ? rtxt.slice(0,200) : rtxt);
              } else {
                      console.info('Telegram sendPhoto upload fallback succeeded');
                      try { telemetry.incCounter('upload_fallback_success'); } catch(e){}
                return; // success
              }
            } finally {
              try { await fs.promises.unlink(tmp); } catch (e) {}
            }
          }

          // If resource is HTML, try to extract an image (og:image or first <img>)
          if (imgRes.ok && ct && ct.indexOf('html') !== -1) {
            try {
              const html = await imgRes.text();
              // Try common meta tags first
              let match = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
              if (!match) match = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
              let foundUrl = match ? match[1] : null;
              if (!foundUrl) {
                const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
                if (imgMatch) foundUrl = imgMatch[1];
              }

              if (foundUrl) {
                // Resolve relative URL
                try { foundUrl = new URL(foundUrl, photoUrl).href; } catch(e) {}
                console.info('Telegram sendPhoto: extracted image from page', foundUrl);
                const artRes = await fetch(foundUrl, { redirect: 'follow' });
                const act = artRes.headers && artRes.headers.get ? artRes.headers.get('content-type') : '';
                if (artRes.ok && act && act.startsWith('image/')) {
                  const buf2 = Buffer.from(await artRes.arrayBuffer());
                  const ext2 = (act.split('/')[1] || 'jpg').split(';')[0];
                  const filename2 = `upload.${ext2}`;
                  const tmp2 = path.join(os.tmpdir(), `${Date.now()}-${filename2}`);
                  try {
                    await fs.promises.writeFile(tmp2, buf2);
                    const form2 = new FormData();
                    form2.append('chat_id', String(chatId));
                    if (caption) form2.append('caption', caption);
                    form2.append('photo', fs.createReadStream(tmp2), { filename: filename2, contentType: act });

                    const headers2 = form2.getHeaders();
                    const retry2 = await fetch(url, { method: 'POST', body: form2, headers: headers2 });
                    if (!retry2.ok) {
                      const rtxt2 = await retry2.text().catch(() => '');
                      console.error('Telegram sendPhoto (upload from embedded) failed', retry2.status, rtxt2.slice ? rtxt2.slice(0,200) : rtxt2);
                    } else {
                        console.info('Telegram sendPhoto upload fallback (embedded image) succeeded');
                        try { telemetry.incCounter('upload_fallback_success'); } catch(e){}
                      return;
                    }
                  } finally {
                    try { await fs.promises.unlink(tmp2); } catch (e) {}
                  }
                }
              }
            } catch (parseErr) {
              console.error('Telegram sendPhoto: failed to extract embedded image', parseErr && parseErr.message ? parseErr.message : parseErr);
            }
          }
        }
        try { telemetry.incCounter('upload_fallback_failures'); } catch(e){}
      } catch (uploadErr) {
        console.error('Telegram sendPhoto upload fallback failed', uploadErr && uploadErr.message ? uploadErr.message : uploadErr);
      }
    }
  } catch (err) {
    console.error('Telegram sendPhoto network error', err && err.message ? err.message : err);
  }
}

export default { sendPhotoWithCaption };
