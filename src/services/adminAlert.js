// adminAlert.js
// Send Telegram alert to admin(s) on repeated failures
import fetch from "../lib/fetch.js";


const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_IDS = (process.env.ADMIN_TELEGRAM_ID || "").split(",").map(id => id.trim()).filter(Boolean);


export async function sendTelegramAdminAlert(message) {
  if (!BOT_TOKEN || !ADMIN_IDS.length) return;
  for (const chatId of ADMIN_IDS) {
    try {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "Markdown" })
      });
    } catch (e) {}
  }
}
