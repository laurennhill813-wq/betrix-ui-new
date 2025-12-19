import fs from "fs";
import fsPromises from "fs/promises";
import FormData from "form-data";
import fetch from "./lib/fetch.js";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.BOT_BROADCAST_CHAT_ID;

if (!TELEGRAM_BOT_TOKEN)
  console.warn("TELEGRAM_BOT_TOKEN not set - Telegram sends will be disabled");
if (!TELEGRAM_CHAT_ID)
  console.warn(
    "BOT_BROADCAST_CHAT_ID not set - Telegram sends will be disabled",
  );

export async function sendPhotoToTelegram(filePath, caption = "") {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID)
    throw new Error("Telegram env vars not set");

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
  const form = new FormData();

  form.append("chat_id", String(TELEGRAM_CHAT_ID));
  if (caption) form.append("caption", caption);
  form.append("photo", fs.createReadStream(filePath));

  const headers = form.getHeaders();
  const res = await fetch(url, { method: "POST", body: form, headers });
  const json = await res.json().catch(() => ({}));

  if (json && json.ok) {
    // cleanup the temp file
    try {
      await fsPromises.unlink(filePath);
    } catch (e) {
      console.warn(
        "Failed to remove temp file after telegram upload:",
        e && e.message ? e.message : e,
      );
    }
  }

  return json;
}

export default { sendPhotoToTelegram };
