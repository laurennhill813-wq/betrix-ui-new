/*
 * src/server/commands/index.js
 * Telegram webhook handler with quick commands, Azure AI integration, and lightweight rate-limiting.
 */
import { AzureAIService } from '../../services/azure-ai.js';
import { getRedis } from '../../lib/redis-factory.js';
import { handleCommand } from '../../handlers/commands.js';
import { handleCallback } from '../../handlers/callbacks.js';
import TelegramService from '../../services/telegram.js';

// Singleton Azure AI service (will be marked disabled when config missing)
const aiService = new AzureAIService(
  process.env.AZURE_OPENAI_ENDPOINT,
  process.env.AZURE_OPENAI_KEY,
  process.env.AZURE_OPENAI_DEPLOYMENT,
  process.env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview'
);

// Redis instance (factory returns MockRedis when no REDIS_URL)
let redis;
try { redis = getRedis(); } catch (e) { console.warn('Could not initialize redis for command router', e && e.message); redis = null; }

// TelegramService instance will be created lazily once we have a token
let telegramService = null;

export default function commandRouter(app) {
  // register commands for Telegram (optional server-side)
  app.post("/webhook/telegram", async (req, res) => {
    // Acknowledge immediately so Telegram won't retry
    res.sendStatus(200);

    const update = req.body || {};
    // Support both message updates and callback_query updates (inline buttons)
    const isMessage = !!update.message;
    const isCallback = !!update.callback_query;
    if (!isMessage && !isCallback) return;

    // Normalize fields for downstream handlers
    let text = '';
    let chatId = null;
    let userId = null;
    let callbackQuery = null;

    if (isMessage) {
      text = update.message.text ? String(update.message.text).trim() : '';
      chatId = update.message?.chat?.id;
      userId = update.message?.from?.id || update.from?.id || chatId;
    } else if (isCallback) {
      callbackQuery = update.callback_query;
      chatId = callbackQuery?.message?.chat?.id;
      userId = callbackQuery?.from?.id || chatId;
      text = '';
    }
    if (!chatId) return;

    // Background processing
    (async () => {
      try {
        const token = process.env.TELEGRAM_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
        if (!token) {
          console.error('Telegram token not configured');
          return;
        }
        if (!telegramService) telegramService = new TelegramService(token);

        // Quick built-in commands (not rate-limited)
        if (/^\/PING\b/i.test(text)) {
          await telegramService.sendMessage(chatId, 'pong');
          console.log('INCOMING-UPDATE', { chatId, text: '/PING' });
          return;
        }

        if (/^\/HELP\b/i.test(text)) {
          const help = 'Available commands: /start, /menu, /fixtures, /odds, /predictions, /profile, /subscribe.';
          await telegramService.sendMessage(chatId, help);
          console.log('INCOMING-UPDATE', { chatId, text: '/HELP' });
          return;
        }

        console.log('INCOMING-UPDATE', { chatId, text });

        // Handle some aliases and quick handlers first (ensure commands map correctly)
        if (/^\/vip\b/i.test(text)) {
          // map /vip to the existing VVIP handler
          text = '/vvip';
        }

        if (/^\/about\b/i.test(text)) {
          // quick about response consistent with branding
          try {
            await telegramService.sendMessage(chatId, '🌀 BETRIX - Premium Sports Analytics\n\nBETRIX helps you find value bets and trends. Visit betrix.app for more.');
            console.log('[SLASH_OUTGOING_OK]', chatId);
          } catch (e) { console.error('[SLASH_OUTGOING_ERR] about send failed', e && (e.stack || e.message)); }
          return;
        }

        if (/^\/meme\b/i.test(text)) {
          // Delegate to NewFeaturesHandlers for /meme (modern feature)
          try {
            const mod = await import('../../handlers-new-features.js').catch(() => null);
            const NewFeaturesHandlers = mod && (mod.NewFeaturesHandlers || mod.default) ? (mod.NewFeaturesHandlers || mod.default) : null;
            if (NewFeaturesHandlers) {
              const nf = new NewFeaturesHandlers(telegramService, null, null);
              await nf.handleMeme(chatId);
              console.log('[SLASH_OUTGOING_OK]', chatId);
              return;
            }
          } catch (e) { console.error('[SLASH_HANDLER_ERR] meme', e && (e.stack || e.message)); }
          // Fallback: continue to main handler
        }

        if (/^\/refer\b/i.test(text)) {
          try {
            let user = {};
            try { user = redis ? (await redis.hgetall(`user:${userId}`) || {}) : {}; } catch (e) { /* ignore */ }
            const ref = user.referral_code || `ref_${userId}_${Date.now()}`;
            await telegramService.sendMessage(chatId, `🎁 Referral Code: ${ref}`);
            console.log('[SLASH_OUTGOING_OK]', chatId);
          } catch (e) { console.error('[SLASH_OUTGOING_ERR] refer send failed', e && (e.stack || e.message)); }
          return;
        }

        // If it's a slash command, delegate to the consolidated command handlers
        if (text.startsWith('/')) {
          try {
            const userId = update.from?.id || update.message?.from?.id || chatId;
            const result = await handleCommand(text, chatId, userId, redis, null);
            try {
              console.log('[COMMAND_RESULT]', JSON.stringify({ chatId, command: text, hasResult: !!result, type: typeof result, hasText: !!(result && result.text) }));
            } catch (e) { /* ignore logging errors */ }
            if (result && result.method === 'sendMessage') {
              // Legacy form used by some handlers
              const dest = result.chat_id || chatId;
              console.log('[SLASH_SEND] legacy sendMessage form ->', dest);
              try {
                await telegramService.sendMessage(dest, result.text || '', { reply_markup: result.reply_markup, parse_mode: result.parse_mode || 'HTML' });
                console.log('[SLASH_OUTGOING_OK]', dest);
              } catch (e) {
                console.error('[SLASH_OUTGOING_ERR] legacy send failed', e && (e.stack || e.message));
              }
            } else if (result && typeof result === 'object' && result.text) {
              const dest = result.chat_id || chatId;
              console.log('[SLASH_SEND] object result ->', dest, 'textLen=', (result.text||'').length);
              try {
                await telegramService.sendMessage(dest, result.text, { reply_markup: result.reply_markup, parse_mode: result.parse_mode || 'HTML' });
                console.log('[SLASH_OUTGOING_OK]', dest);
              } catch (e) {
                console.error('[SLASH_OUTGOING_ERR] sendMessage failed', e && (e.stack || e.message));
                // Fallback: attempt raw fetch to Telegram API to capture any different error
                try {
                  console.log('[SLASH_FALLBACK] attempting raw fetch to Telegram API');
                  const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: dest, text: result.text, parse_mode: result.parse_mode || 'HTML', reply_markup: result.reply_markup })
                  });
                  const data = await resp.json().catch(()=>null);
                  console.log('[SLASH_FALLBACK_RESP]', JSON.stringify({ ok: data?.ok ?? null, description: data?.description || null }));
                } catch (fbErr) {
                  console.error('[SLASH_FALLBACK_ERR] raw fetch failed', fbErr && (fbErr.stack || fbErr.message));
                }
              }
            } else if (typeof result === 'string') {
              console.log('[SLASH_SEND] string result ->', chatId);
              try {
                await telegramService.sendMessage(chatId, result);
                console.log('[SLASH_OUTGOING_OK]', chatId);
              } catch (e) {
                console.error('[SLASH_OUTGOING_ERR] sendMessage string failed', e && (e.stack || e.message));
              }
            }
          } catch (cmdErr) {
            console.error('Command handler error', cmdErr && (cmdErr.stack || cmdErr.message));
            try { await telegramService.sendMessage(chatId, '❌ Error processing command. Try /menu'); } catch(e){}
          }
          return;
        }

        // Handle callback_query (inline button actions)
        if (callbackQuery) {
          try {
            const cbData = String(callbackQuery.data || '');
            const result = await handleCallback(cbData, chatId, userId, redis, null);

            // result may request editing the existing message or sending a new one
            if (result && result.method === 'editMessageText') {
              const msgId = callbackQuery.message && callbackQuery.message.message_id;
              try {
                await telegramService.editMessage(chatId, msgId, result.text || '', result.reply_markup || null);
              } catch (e) {
                console.error('editMessage failed for callback', e && (e.stack || e.message));
              }
            } else if (result && result.method === 'answerCallbackQuery') {
              try {
                await telegramService.answerCallback(callbackQuery.id, result.text || '', !!result.show_alert);
              } catch (e) { console.error('answerCallback failed', e && (e.stack || e.message)); }
            } else if (result && result.text) {
              // Fallback: send a message to the chat
              await telegramService.sendMessage(chatId, result.text, { reply_markup: result.reply_markup, parse_mode: result.parse_mode || 'Markdown' });
            }
          } catch (cbErr) {
            console.error('Callback handler error', cbErr && (cbErr.stack || cbErr.message));
            try { await telegramService.answerCallback(callbackQuery.id, '⚠️ Action failed', false); } catch (_) {}
          }
          return;
        }

        // NOTE: rate-limiting must only apply to AI/chat-style replies.
        // We will apply a dedicated AI rate key just before calling the AI service below.

        // Build reply: prefer Azure AI when configured
        let replyText = `You said: ${text}`;
        if (aiService.isHealthy && aiService.isHealthy()) {
          // AI-specific rate limiter (do not apply to commands / menu actions)
          const aiRateKey = `tg:ai:rate:${chatId}`;
          try {
            if (redis) {
              const existingAi = await redis.get(aiRateKey);
              if (existingAi) {
                try {
                  await telegramService.sendMessage(chatId, 'Please wait a few seconds before sending another message.');
                } catch (e) { /* swallow */ }
                console.log('RATE-LIMITED', { chatId });
                return;
              }
              if (typeof redis.setex === 'function') {
                await redis.setex(aiRateKey, 5, '1');
              } else {
                await redis.set(aiRateKey, '1');
                try { await redis.expire(aiRateKey, 5); } catch (e) { /* ignore */ }
              }
            }
          } catch (rlErr) {
            console.warn('AI rate limiter error (continuing):', rlErr && rlErr.message);
          }

          try {
            replyText = await aiService.chat(text, { system: 'You are Betrix, a helpful sports assistant. Be concise and friendly.' });
          } catch (aiErr) {
            console.error('Azure AI error:', aiErr && (aiErr.stack || aiErr.message));
            // If rate limited by Azure, enqueue and inform user
            const isRate = (aiErr && String(aiErr.message || '').toLowerCase().includes('rate')) || (aiErr && aiErr.status === 429);
            if (isRate && redis) {
              try {
                const payload = JSON.stringify({ chatId, text, ts: Date.now() });
                await redis.rpush('ai:queue', payload);
                try { await telegramService.sendMessage(chatId, 'AI is currently busy — your request has been queued and will be processed shortly.'); } catch(e){}
                console.log('ENQUEUED-AI', { chatId });
                return;
              } catch (qErr) {
                console.error('Failed to enqueue AI request', qErr && (qErr.stack || qErr.message));
              }
            }
            // fallback to echo
            replyText = `You said: ${text}`;
          }
        }

        // Send the reply
        try {
          // Use TelegramService to send replies so outgoing events are logged centrally
          console.log('[OUTGOING_ATTEMPT] send reply to', chatId);
          await telegramService.sendMessage(chatId, replyText, { parse_mode: 'HTML' });
          console.log('[OUTGOING_OK] reply sent to', chatId);
        } catch (sendErr) {
          console.error('[OUTGOING_ERR] Failed to send Telegram reply', sendErr && (sendErr.stack || sendErr.message));
        }

      } catch (err) {
        console.error('COMMAND-PROCESS-ERR', err && (err.stack || err.message));
      }
    })();
  });
};

