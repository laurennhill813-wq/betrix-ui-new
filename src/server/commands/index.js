/*
 * src/server/commands/index.js
 * Simple command router: /PING, /help, /bet (placeholder)
 */
module.exports = function commandRouter(app) {
  // register commands for Telegram (optional server-side)
  app.post("/webhook/telegram", async (req, res) => {
    // the actual webhook handler mounts this router; this file provides command dispatch
    const update = req.body || {};
    // Ensure full update is logged so we can extract chat.id from UI logs
    try {
      console.log("[TELEGRAM UPDATE RAW - UI]", JSON.stringify(update, null, 2));
    } catch (e) {
      console.log('[TELEGRAM UPDATE RAW - UI] <unserializable>');
    }
    const text = (update.message && update.message.text) ? update.message.text.trim() : "";
    // quick ack
    res.status(200).send("OK");

    // background processing
    (async () => {
      try {
        const chatId = update.message?.chat?.id;
        if (!chatId) return;
        const token = process.env.TELEGRAM_BOT_TOKEN;

        // Minimal main menu payload to respond directly from the webhook (compatibility fallback).
        const mainMenuPayload = {
          chat_id: chatId,
          text: `🌀 *BETRIX* - Premium Sports Analytics\n\nYour AI-powered sports betting companion.\nGet live odds, predictions, and analysis.\n\n*What would you like to do?*`,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🤖 Talk to BETRIX AI', callback_data: 'mod_ai_chat' },
                { text: '✅ Sign up', callback_data: 'signup_start' }
              ],
              [
                { text: '▶ Live Matches', callback_data: 'live_games' },
                { text: '📋 Sports', callback_data: 'sports' }
              ],
              [
                { text: '🏆 Standings', callback_data: 'standings' },
                { text: '📊 Odds & Analysis', callback_data: 'odds_analysis' }
              ],
              [
                { text: '👤 My Profile', callback_data: 'profile' },
                { text: '⭐ Favorites', callback_data: 'favorites' }
              ],
              [ { text: '👑 Subscribe/Upgrade', callback_data: 'subscription' } ],
              [
                { text: '📰 News', callback_data: 'news' },
                { text: '❓ Help & Support', callback_data: 'help' }
              ]
            ]
          }
        };

        // If specific commands match, override the mainMenuPayload text accordingly
        if (/^\/PING\b/i.test(text)) {
          mainMenuPayload.text = 'PONG';
          delete mainMenuPayload.reply_markup;
        } else if (/^\/HELP\b/i.test(text)) {
          mainMenuPayload.text = 'BETRIX commands: /PING, /HELP, /BET <stake> <selection>';
          delete mainMenuPayload.reply_markup;
        } else if (/^\/BET\b/i.test(text)) {
          mainMenuPayload.text = 'Received bet request. Processing... (this is a placeholder)';
          delete mainMenuPayload.reply_markup;
        }

        const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mainMenuPayload)
        });
        const data = await resp.json();
        console.log("OUTGOING-RESPONSE", JSON.stringify({ ok: data.ok, description: data.description || null, payload: mainMenuPayload }));
      } catch (err) {
        console.error("COMMAND-PROCESS-ERR", err && (err.stack || err.message));
      }
    })();
  });
};
