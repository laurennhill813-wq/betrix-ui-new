import 'dotenv/config';
import { Telegraf, Scenes, session, Markup } from 'telegraf';
import express from 'express';
import bodyParser from 'body-parser';
import { Pool } from 'pg';
import { upsertUser, createPayment, getUserById, getRecentPayments, getPaymentByProviderCheckout, getPaymentByTxRef, updatePaymentStatus } from './db.js';
import { initiateStkPush, handleMpesaCallback } from './payments.js';
import football, { setAggregator } from './football.js';
import { getRedis } from '../../src/lib/redis-factory.js';
import { SportsAggregator } from '../../src/services/sports-aggregator.js';
import { handleFootballOdds } from './handlers/odds-football.js';
import { handleBasketballOdds } from './handlers/odds-basketball.js';
import { handleDebugEvent } from './handlers/debug-event.js';
import { handlePrefetchStatus } from './handlers/prefetch-status.js';

// Initialize a SportsAggregator instance (shared Redis)
const redisClient = getRedis();
const sportsAgg = new SportsAggregator(redisClient);
setAggregator(sportsAgg);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('Missing TELEGRAM_BOT_TOKEN in environment');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// BETRIXX analysis command wiring
import { analyseFixtureWithBetrixx } from '../services/betrixx_analysis.js';
import { groqChat } from '../services/llm_groq.js';
import persona from '../ai/persona.js';

// --- Admin /health command guard ---
const ADMIN_USER_ID = process.env.ADMIN_TELEGRAM_ID ? String(process.env.ADMIN_TELEGRAM_ID) : null;

// Simple session middleware (keeps minimal signup state)
bot.use(session());

function mainKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('⚽ Football', 'sport:football')],
    [Markup.button.callback('🔐 Sign up / Profile', 'signup:start')],
    [Markup.button.callback('💳 Pay 300 KES', 'pay:start')]
  ]);
}

function payKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('M-Pesa (Lipana)', 'pay:method:lipana'), Markup.button.callback('M-Pesa (Daraja)', 'pay:method:mpesa')]
  ]);
}

async function pollPaymentStatusAndNotify(ctx, tx_ref, timeoutSeconds = 180) {
  const interval = 3000; // 3s
  const maxAttempts = Math.ceil(timeoutSeconds * 1000 / interval);
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const p = await getPaymentByTxRef(tx_ref);
      const status = p?.status;
      if (status && (status === 'success' || status === 'failed')) {
        if (status === 'success') {
          await ctx.reply('Payment confirmed — thank you! Your account is now active.');
          try { await upsertUser({ user_id: ctx.from.id, status: 'active' }); } catch (e) { /* ignore */ }
        } else {
          await ctx.reply('Payment failed or was cancelled. Please try again.');
        }
        return p;
      }
    } catch (err) {
      console.error('Error polling payment status', err);
    }
    await new Promise(r => setTimeout(r, interval));
  }
  await ctx.reply('No confirmation received yet. We will notify you when the payment completes.');
  return null;
}

bot.action('pay:start', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('Choose payment method:', payKeyboard());
});

bot.action('pay:method:lipana', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.paymentMethod = 'lipana';
  await ctx.reply('You chose Lipana M-Pesa. We will use M-Pesa STK to collect 300 KES.');
  // trigger payment flow
  const fakeCtx = ctx; // reuse same ctx
  await (async function trigger() {
    const userId = ctx.from.id;
    let msisdn = ctx.session?.msisdn || null;
    if (!msisdn) {
      try { const u = await getUserById(userId); if (u && u.msisdn) msisdn = u.msisdn; } catch (e) { /* ignore */ }
    }
    if (!msisdn) {
      await ctx.reply('Please send your phone number first (e.g. 2547XXXXXXXX)');
      ctx.session.payAfterNumber = true;
      return;
    }
    await ctx.reply('Initiating STK push — please complete the prompt on your phone. I will wait for confirmation...');
    try {
      const { tx_ref } = await initiateStkPush({ user_id: userId, msisdn, amount: 300 });
      ctx.session.lastPayment = { tx_ref, amount: 300 };
      await ctx.reply(`STK Push initiated. Reference: ${tx_ref}. Please complete the prompt on your phone.`, Markup.inlineKeyboard([
        [Markup.button.callback('❌ Cancel payment', 'pay:cancel')],
        [Markup.button.callback('🔁 Retry payment', 'pay:retry')]
      ]));
      await pollPaymentStatusAndNotify(ctx, tx_ref, 180);
    } catch (err) {
      console.error('STK push error', err);
      await ctx.reply('Failed to initiate payment. Please try again later.');
    }
  })();
});

bot.action('pay:method:mpesa', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.paymentMethod = 'mpesa';
  await ctx.reply('You chose Daraja M-Pesa. We will use M-Pesa STK to collect 300 KES.');
  // same trigger logic as lipana
  const userId = ctx.from.id;
  let msisdn = ctx.session?.msisdn || null;
  if (!msisdn) {
    try { const u = await getUserById(userId); if (u && u.msisdn) msisdn = u.msisdn; } catch (e) { /* ignore */ }
  }
  if (!msisdn) {
    await ctx.reply('Please send your phone number first (e.g. 2547XXXXXXXX)');
    ctx.session.payAfterNumber = true;
    return;
  }
  await ctx.reply('Initiating STK push — please complete the prompt on your phone. I will wait for confirmation...');
  try {
    const { tx_ref } = await initiateStkPush({ user_id: userId, msisdn, amount: 300 });
    ctx.session.lastPayment = { tx_ref, amount: 300 };
    await ctx.reply(`STK Push initiated. Reference: ${tx_ref}. Please complete the prompt on your phone.`, Markup.inlineKeyboard([
      [Markup.button.callback('❌ Cancel payment', 'pay:cancel')],
      [Markup.button.callback('🔁 Retry payment', 'pay:retry')]
    ]));
    await pollPaymentStatusAndNotify(ctx, tx_ref, 180);
  } catch (err) {
    console.error('STK push error', err);
    await ctx.reply('Failed to initiate payment. Please try again later.');
  }
});


// Match details handler (best-effort id lookup)
bot.action(/match:(.+):football/, async (ctx) => {
  await ctx.answerCbQuery();
  const matchId = ctx.match[1];
  const all = await football.loadMatches();
  const found = all.find(m => String(m.id) === String(matchId) || String(m.match_id) === String(matchId) || String(m.fixture?.id) === String(matchId) || (`${m.home?.id || ''}:${m.away?.id || ''}`) === String(matchId));
  if (!found) {
    await ctx.editMessageText(`Match not found. Showing list instead.`, { reply_markup: Markup.inlineKeyboard([[Markup.button.callback('🔙 Back', 'sport:football')]]).reply_markup });
    return;
  }
  const detail = football.formatMatchDetail(found);
  await ctx.editMessageText(detail, { reply_markup: Markup.inlineKeyboard([[Markup.button.callback('🔙 Back', 'sport:football')]]).reply_markup });
});

bot.on('text', async (ctx, next) => {
  const s = ctx.session.signup;
  if (!s) return next();

  const text = ctx.message.text.trim();
  if (s.step === 1) {
    s.full_name = text;
    s.step = 2;
    await ctx.reply('Thanks. What is your phone number (e.g. 2547XXXXXXXX)?');
    return;
  }
  if (s.step === 2) {
    s.msisdn = text;
    s.step = 3;
    await ctx.reply('Optional: What country are you in? (or send "skip")');
    return;
  }
  if (s.step === 3) {
    s.country = text.toLowerCase() === 'skip' ? null : text;
    // persist user
    const user = {
      user_id: ctx.from.id,
      full_name: s.full_name,
      msisdn: s.msisdn,
      country: s.country,
      status: 'trial'
    };
    try {
      await upsertUser(user);
      await ctx.reply('Profile saved! You can now pay to unlock full access.', payKeyboard());
    } catch (err) {
      console.error('Error saving user', err);
      await ctx.reply('Sorry, something went wrong saving your profile. Try again later.');
    }
    ctx.session.signup = null;
    return;
  }
  return next();
});

// Payment action - initiate STK push
bot.action('pay:stk', async (ctx) => {
  await ctx.answerCbQuery();
  // load user data (in real app, query DB)
  const userId = ctx.from.id;
  // For the minimal scaffold, read msisdn from session or prompt
  const msisdn = ctx.session?.msisdn || null;
  // Try DB if not in session
  if (!msisdn) {
    try {
      const u = await getUserById(userId);
      if (u && u.msisdn) ctx.session.msisdn = u.msisdn;
    } catch (err) {
      console.error('Error reading user for msisdn fallback', err);
    }
  }
  if (!ctx.session?.msisdn) {
    await ctx.reply('Please send your phone number first (e.g. 2547XXXXXXXX)');
    ctx.session.payAfterNumber = true;
    return;
  }

  try {
    const { tx_ref } = await initiateStkPush({ user_id: userId, msisdn, amount: 300 });
    ctx.session.lastPayment = { tx_ref, amount: 300 };
    await ctx.reply(`STK Push initiated. Reference: ${tx_ref}. Complete the prompt on your phone.`, Markup.inlineKeyboard([
      [Markup.button.callback('❌ Cancel payment', 'pay:cancel')],
      [Markup.button.callback('🔁 Retry payment', 'pay:retry')]
    ]));
  } catch (err) {
    console.error('STK push error', err);
    await ctx.reply('Failed to initiate payment. Please try again later.');
  }
});

// If user previously indicated they will pay after giving number
bot.hears(/^[0-9]{9,12}$/, async (ctx) => {
  const possible = ctx.message.text.trim();
  if (ctx.session?.payAfterNumber) {
    ctx.session.payAfterNumber = false;
    ctx.session.msisdn = possible;
    // auto-trigger payment according to chosen method (default lipana)
    await ctx.reply('Thanks — initiating payment...');
    try {
      const { tx_ref } = await initiateStkPush({ user_id: ctx.from.id, msisdn: possible, amount: 300 });
      ctx.session.lastPayment = { tx_ref, amount: 300 };
      await ctx.reply(`STK Push initiated. Reference: ${tx_ref}. Check your phone.`, Markup.inlineKeyboard([
        [Markup.button.callback('❌ Cancel payment', 'pay:cancel')],
        [Markup.button.callback('🔁 Retry payment', 'pay:retry')]
      ]));
      // poll and notify
      await pollPaymentStatusAndNotify(ctx, tx_ref, 180);
    } catch (err) {
      console.error(err);
      await ctx.reply('Could not start payment. Please try again later.');
    }
    return;
  }
});

// Allow users to cancel or retry while waiting for STK
bot.action('pay:cancel', async (ctx) => {
  await ctx.answerCbQuery();
  const last = ctx.session?.lastPayment;
  if (!last || !last.tx_ref) {
    await ctx.reply('No pending payment found to cancel.');
    return;
  }
  try {
    await updatePaymentStatus(last.tx_ref, 'failed', null, { cancelled_by: ctx.from.id });
    ctx.session.lastPayment = null;
    await ctx.reply('Payment cancelled. If you were charged, contact support.');
  } catch (err) {
    console.error('Failed to cancel payment', err);
    await ctx.reply('Could not cancel the payment. Please try again or contact support.');
  }
});

bot.action('pay:retry', async (ctx) => {
  await ctx.answerCbQuery();
  const last = ctx.session?.lastPayment;
  if (!last || !last.tx_ref) {
    await ctx.reply('No recent payment to retry.');
    return;
  }
  let msisdn = ctx.session?.msisdn || null;
  if (!msisdn) {
    try { const u = await getUserById(ctx.from.id); if (u && u.msisdn) msisdn = u.msisdn; } catch (e) { /* ignore */ }
  }
  if (!msisdn) {
    await ctx.reply('No phone number found. Please send your phone number (e.g. 2547XXXXXXXX) to retry.');
    ctx.session.payAfterNumber = true;
    return;
  }
  try {
    const { tx_ref } = await initiateStkPush({ user_id: ctx.from.id, msisdn, amount: last.amount || 300 });
    ctx.session.lastPayment = { tx_ref, amount: last.amount || 300 };
    await ctx.reply(`Retry initiated. Reference: ${tx_ref}. Please complete the prompt on your phone.`, Markup.inlineKeyboard([
      [Markup.button.callback('❌ Cancel payment', 'pay:cancel')],
      [Markup.button.callback('🔁 Retry payment', 'pay:retry')]
    ]));
    await pollPaymentStatusAndNotify(ctx, tx_ref, 180);
  } catch (err) {
    console.error('Retry STK error', err);
    await ctx.reply('Retry failed. Please try again later.');
  }
});

// Simple middleware to enforce active status for commands (example)
bot.use(async (ctx, next) => {
  // allow /start and admin health
  if (ctx.updateType === 'message' && ctx.message && ctx.message.text) {
    const t = ctx.message.text.trim();
    if (t.startsWith('/start')) return next();
    if (t.startsWith('/health')) return next();
  }

  // For callback queries and other commands, check DB for user status
  const userId = ctx.from && ctx.from.id;
  if (!userId) return next();
  try {
    const user = await getUserById(userId);
    if (user && user.status && user.status !== 'active') {
      // If user is not active, prompt payment flow
      await ctx.reply('Your account is not active. Please pay 300 KES to unlock full access.', payKeyboard());
      return; // short-circuit
    }
  } catch (err) {
    console.error('Error checking user status', err);
  }
  return next();
});

// Admin health command (restricted by ADMIN_TELEGRAM_ID env var)
bot.command('health', async (ctx) => {
  if (!ADMIN_USER_ID || String(ctx.from.id) !== ADMIN_USER_ID) {
    await ctx.reply('Unauthorized');
    return;
  }
  // Check Redis and SportsAggregator health
  try {
    const r = await redisClient.ping();
    const live = await sportsAgg.getAllLiveMatches();
    const fixtures = await sportsAgg.getFixtures();
    await ctx.reply(`Health OK\nRedis: ${r}\nLive matches: ${live?.length || 0}\nFixtures cached: ${fixtures?.length || 0}`);
  } catch (err) {
    await ctx.reply('Health check failed: ' + String(err.message || err));
  }
});

// Analyse fixture via BETRIXX (Groq-powered). Usage: /analyse_fixture <fixtureId>
bot.command('analyse_fixture', async (ctx) => {
  try {
    const parts = (ctx.message && ctx.message.text) ? ctx.message.text.trim().split(/\s+/).filter(Boolean) : [];
    const fixtureId = parts[1];
    if (!fixtureId) return await ctx.reply('Usage: /analyse_fixture <fixtureId>');

    await ctx.reply('🧠 Analysing this fixture with BETRIXX...');

    // try to fetch fixture from aggregator cache (supports upcoming/live/past fixtures)
    let fixture = null;
    try {
      const all = await sportsAgg.getFixtures();
      fixture = (all || []).find(f => String(f.id) === String(fixtureId) || String(f.fixture?.id) === String(fixtureId));
    } catch (e) {
      // fallthrough, we'll try alternative lookups
    }

    if (!fixture) {
      // try live matches
      try {
        const live = await sportsAgg.getAllLiveMatches?.() || await sportsAgg.getLiveMatches?.() || [];
        fixture = (live || []).find(m => String(m.id) === String(fixtureId) || String(m.fixture?.id) === String(fixtureId));
      } catch (e) { /* ignore */ }
    }

    if (!fixture) return await ctx.reply("I couldn't find that fixture. Check the ID and try again.");

    try {
      const analysis = await analyseFixtureWithBetrixx(fixture, { max_tokens: 1800 });
      if (!analysis || String(analysis).trim().length === 0) return await ctx.reply('BETRIXX could not generate analysis right now. Try again shortly.');
      // Split long analyses into Telegram-safe chunks and send sequentially
      const full = String(analysis || '');
      const chunkSize = 3800;
      for (let i = 0; i < full.length; i += chunkSize) {
        await ctx.reply(full.slice(i, i + chunkSize));
      }
    } catch (err) {
      console.error('analyse_fixture error (AI):', err?.message || err);
      await ctx.reply('Something went wrong while analysing that fixture.');
    }
  } catch (err) {
    console.error('analyse_fixture handler error:', err?.message || err);
    try { await ctx.reply('Error: analysis failed.'); } catch(_) {}
  }
});

// Admin command to list recent payments
bot.command('payments', async (ctx) => {
  if (!ADMIN_USER_ID || String(ctx.from.id) !== ADMIN_USER_ID) {
    await ctx.reply('Unauthorized');
    return;
  }
  try {
    const items = await getRecentPayments(12);
    if (!items || items.length === 0) {
      await ctx.reply('No payments found.');
      return;
    }
    const lines = items.map(p => {
      const when = p.created_at ? new Date(p.created_at).toISOString().replace('T', ' ').replace('Z','') : '';
      const phone = p.phone_number || (p.metadata && p.metadata.msisdn) || '';
      return `• ${p.tx_ref || p.id} — ${p.status} — ${p.amount} ${p.currency || ''} — ${phone} — ${when}`;
    });
    // Send in chunks if too long
    const chunkSize = 10;
    for (let i = 0; i < lines.length; i += chunkSize) {
      await ctx.reply('\n' + lines.slice(i, i + chunkSize).join('\n'));
    }
  } catch (err) {
    console.error('Failed to list payments', err);
    await ctx.reply('Failed to fetch payments: ' + String(err.message || err));
  }
});

// --- Wire odds commands to the new aggregator-backed handlers ---
bot.command('nfl', async (ctx) => {
  try {
    await handleFootballOdds(ctx);
  } catch (err) {
    console.error('Error in /nfl command', err);
    await ctx.reply('Sorry, could not fetch NFL odds right now.');
  }
});

bot.command('nba', async (ctx) => {
  try {
    await handleBasketballOdds(ctx);
  } catch (err) {
    console.error('Error in /nba command', err);
    await ctx.reply('Sorry, could not fetch NBA odds right now.');
  }
});

bot.command('odds', async (ctx) => {
  try {
    const parts = (ctx.message && ctx.message.text) ? ctx.message.text.split(' ').filter(Boolean) : [];
    if (parts.length > 1) {
      const arg = parts[1].toLowerCase();
      if (arg.startsWith('nba')) return await handleBasketballOdds(ctx);
      if (arg.startsWith('nfl') || arg.startsWith('football') || arg.startsWith('soccer')) return await handleFootballOdds(ctx);
    }
    // Default to football odds snapshot
    await handleFootballOdds(ctx);
  } catch (err) {
    console.error('Error in /odds command', err);
    await ctx.reply('Sorry, could not fetch odds right now.');
  }
});

// Admin debug command to inspect an event across providers
bot.command('debug_event', async (ctx) => {
  try {
    await handleDebugEvent(ctx);
  } catch (err) {
    console.error('Error in /debug_event command', err);
    await ctx.reply('Debug command failed.');
  }
});

// Admin command: show prefetch/provider status and cached key counts
bot.command('prefetch_status', async (ctx) => {
  try {
    await handlePrefetchStatus(ctx);
  } catch (err) {
    console.error('Error in /prefetch_status command', err);
    await ctx.reply('Failed to fetch prefetch status.');
  }
});

// Conversational handler: route casual chat through BETRIX persona and
// handle lightweight analysis intents (e.g., "Liverpool vs Man City").
bot.on('text', async (ctx) => {
  try {
    const text = String(ctx.message && ctx.message.text || '').trim();
    if (!text) return;
    // Ignore explicit commands
    if (text.startsWith('/')) return;

    const lower = text.toLowerCase();

    // Lightweight analysis intent detection
    const analysisKeywords = ['analyse', 'analyze', 'analysis', 'predict', 'who will win', 'who wins', 'probability', 'odds'];
    const mentionsVs = /\bvs?\b| v | vs\./i.test(text);
    const hasAnalysisKeyword = analysisKeywords.some(k => lower.includes(k));
    const looksLikeFixtureId = /\b\d{4,}\b/.test(text);

    if (hasAnalysisKeyword || mentionsVs || looksLikeFixtureId) {
      // If a numeric fixture id is present try to fetch and analyse
      const idMatch = text.match(/(\d{4,})/);
      if (idMatch) {
        const fid = idMatch[1];
        await ctx.reply('🧠 Looking up that fixture and running a BETRIXX analysis...');
        let fixture = null;
        try {
          const all = await sportsAgg.getFixtures();
          fixture = (all || []).find(f => String(f.id) === fid || String(f.fixture?.id) === fid);
        } catch (e) { /* ignore */ }
        if (!fixture) {
          try {
            const live = await sportsAgg.getAllLiveMatches?.() || await sportsAgg.getLiveMatches?.() || [];
            fixture = (live || []).find(m => String(m.id) === fid || String(m.fixture?.id) === fid);
          } catch (e) { /* ignore */ }
        }
        if (!fixture) {
          await ctx.reply("I couldn't find that fixture ID. Send `/analyse_fixture <fixtureId>` or paste the match like 'Liverpool vs Man City'.");
          return;
        }
        try {
          const analysis = await analyseFixtureWithBetrixx(fixture);
          const full = String(analysis || '');
          // Split into 4000-char chunks for Telegram and send sequentially
          const chunkSize = 3800;
          for (let i = 0; i < full.length; i += chunkSize) {
            const part = full.slice(i, i + chunkSize);
            await ctx.reply(part);
          }
          return;
        } catch (err) {
          console.error('Text-handler analysis error', err);
          await ctx.reply('Failed to generate analysis. Try /analyse_fixture <fixtureId>');
          return;
        }
      }

      // If mentions a "vs" or analysis keyword but no id, ask for clarification
      if (mentionsVs || hasAnalysisKeyword) {
        await ctx.reply('Do you want a quick BETRIXX take on a match? Send a fixture ID or type like "Liverpool vs Man City" and I will analyse it.');
        return;
      }
    }

    // Default: general conversational reply using BETRIX persona
    await ctx.replyWithChatAction('typing');
    const system = persona.getSystemPrompt();
    const userPrompt = `User: ${text}\n\nRespond in a lively, punchy BETRIXX voice. Use emojis naturally to add personality (e.g. ⚽️, 🔥, ✅). Keep replies engaging but not verbose; ask a friendly follow-up when useful.`;
    try {
      const resp = await groqChat({ system, user: userPrompt, model: process.env.GROQ_MODEL, temperature: 0.8, max_tokens: 800 });
      if (resp && String(resp).trim().length > 0) {
        await ctx.reply(String(resp).slice(0, 4000));
      } else {
        await ctx.reply('Sorry — I could not think of a reply right now. Try again in a moment.');
      }
    } catch (err) {
      console.error('Groq conversational error', err);
      await ctx.reply('Sorry — I hit an error while trying to reply.');
    }
  } catch (err) {
    console.error('text-handler error', err);
    try { await ctx.reply('Sorry, something went wrong while I tried to reply.'); } catch (_) {}
  }
});

// --- Small express server to receive provider webhooks (M-Pesa callback) ---
const app = express();
app.use(bodyParser.json());

app.post('/webhook/mpesa', async (req, res) => {
  const payload = req.body || {};
  // Handle Safaricom Daraja STK push callback structure if present
  try {
    const stk = payload?.Body?.stkCallback || payload?.stkCallback || null;
    if (stk && stk?.CheckoutRequestID) {
      const checkout = stk.CheckoutRequestID;
      const resultCode = stk.ResultCode;
      const resultDesc = stk.ResultDesc || stk.ResultDescription || null;
      // find payment by provider checkout id
      const payment = await getPaymentByProviderCheckout(checkout);
      if (!payment) {
        console.warn('Webhook: could not find payment for checkout', checkout);
        return res.json({ ok: true, note: 'no payment found' });
      }
      const status = (resultCode === 0 || resultCode === '0') ? 'success' : 'failed';
      const provider_tx_id = stk?.CallbackMetadata?.Item?.find?.(i => i.Name === 'MpesaReceiptNumber')?.Value || null;
      const metadata = { daraja: stk, raw: payload };
      const updated = await handleMpesaCallback({ tx_ref: payment.tx_ref, status, provider_tx_id, metadata });
      if (updated && updated.status === 'success' && updated.user_id) {
        try {
          await bot.telegram.sendMessage(updated.user_id, `Payment received. Thank you — your account is now active.`);
          await upsertUser({ user_id: updated.user_id, status: 'active' });
        } catch (err) {
          console.error('Failed to notify user after payment', err);
        }
      }
      return res.json({ ok: true, updated });
    }

    // Generic fallback expecting tx_ref
    const tx_ref = payload.tx_ref || payload.reference || payload.checkoutRequestID || null;
    const status = payload.status || payload.result || null;
    const provider_tx_id = payload.provider_tx_id || payload.transaction_id || null;
    const metadata = payload.metadata || payload;
    if (!tx_ref) return res.status(400).json({ error: 'missing tx_ref' });
    const updated = await handleMpesaCallback({ tx_ref, status, provider_tx_id, metadata });
    if (updated && updated.status === 'success' && updated.user_id) {
      try {
        await bot.telegram.sendMessage(updated.user_id, `Payment received. Thank you — your account is now active.`);
        await upsertUser({ user_id: updated.user_id, status: 'active' });
      } catch (err) {
        console.error('Failed to notify user after payment', err);
      }
    }
    return res.json({ ok: true, updated });
  } catch (err) {
    console.error('Webhook handling error', err);
    return res.status(500).json({ error: 'internal' });
  }
});

// Bot's internal webhook handler runs on 3001 by default to avoid colliding
// with the standalone `server.cjs` webhook process which commonly uses port 3000.
const webhookPort = process.env.WEBHOOK_PORT ? Number(process.env.WEBHOOK_PORT) : (process.env.PORT ? Number(process.env.PORT) : 3001);
app.listen(webhookPort, () => console.log(`Webhook server listening on port ${webhookPort}`));

bot.launch();

console.log('Bot started.');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
