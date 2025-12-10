/**
 * Overwrite: a minimal, clean callbacks handler.
/**
 * BETRIX Callback Handlers - Consolidated Single File
 *
 * This file provides a compact, robust router for Telegram inline keyboard
 * callbacks. It uses the existing `news-service` and `sportsgameodds` services
 * and returns payloads suitable for `telegram.editMessageText` or a fallback
 * `telegram.sendMessage` (handled by caller).
 */
import { Logger } from '../utils/logger.js';
import {
  mainMenu,
  sportsMenu,
  subscriptionMenu,
  paymentMethodsMenu,
  profileMenu,
  helpMenu
} from './menu-system.js';
import { createPaymentOrder, getPaymentInstructions } from './payment-router.js';
import * as newsService from '../services/news-service.js';
import * as sportsgameodds from '../services/sportsgameodds.js';

const logger = new Logger('CallbackHandlers');
void logger;

// --- Helpers ---
function mkEdit(chatId, text, reply_markup) {
  return { method: 'editMessageText', chat_id: chatId, text, reply_markup, parse_mode: 'Markdown' };
}

function mkSend(chatId, text) {
  return { chat_id: chatId, text, parse_mode: 'Markdown' };
}

// --- Menu handler ---
function handleMenuCallback(data, chatId) {
  const menuMap = {
    'menu_main': mainMenu,
    'menu_live': { text: '⚽ *Select a Sport for Live Matches:*', reply_markup: sportsMenu.reply_markup },
    'menu_odds': { text: '📊 *Select a Sport for Odds & Analysis:*', reply_markup: sportsMenu.reply_markup },
    'menu_standings': { text: '🏆 *Select a League for Standings:*', reply_markup: sportsMenu.reply_markup },
    'menu_news': { text: '📰 *Latest Sports News*', reply_markup: mainMenu.reply_markup },
    'menu_profile': profileMenu,
    'menu_vvip': subscriptionMenu,
    'menu_help': helpMenu
  };
  const menu = menuMap[data];
  if (!menu) return mkSend(chatId, '🤔 Menu not found');
  return mkEdit(chatId, menu.text || 'Menu', menu.reply_markup || {});
}

// --- League / Event / Odds handlers ---
async function handleLeagueCallback(data, chatId, redis) {
  const leagueId = String(data).replace(/^league_/, '').trim();
  try {
    const events = await sportsgameodds.fetchAllEvents({ league: leagueId, redis, forceFetch: false });
    const keyboard = { inline_keyboard: [] };
    if (Array.isArray(events) && events.length) {
      for (let i = 0; i < Math.min(8, events.length); i++) {
        const ev = events[i];
        const id = ev.id || ev.eventId || ev._id || String(i);
        const home = ev.home?.name || ev.home_team || ev.home || 'Home';
        const away = ev.away?.name || ev.away_team || ev.away || 'Away';
        keyboard.inline_keyboard.push([{ text: `${home} vs ${away}`.slice(0, 40), callback_data: `event_${leagueId}_${id}` }]);
      }
    } else {
      keyboard.inline_keyboard.push([{ text: 'No upcoming events', callback_data: 'menu_standings' }]);
    }
    keyboard.inline_keyboard.push([{ text: '🔙 Back', callback_data: 'menu_standings' }]);
    return mkEdit(chatId, `🏟️ *${leagueId}*\n\nEvents:`, keyboard);
  } catch (err) {
    logger.warn('handleLeagueCallback error', err?.message || String(err));
    return mkSend(chatId, '❌ Error loading league events');
  }
}

async function handleEventCallback(data, chatId, redis) {
  const parts = data.split('_');
  if (parts.length < 3) return mkSend(chatId, 'Invalid event selection');
  const league = parts[1];
  const eventId = parts.slice(2).join('_');
  try {
    let odds = null;
    try { odds = await sportsgameodds.fetchOdds({ league, eventId, redis, forceFetch: false }); } catch (e) { logger.warn('fetchOdds failed', e?.message || String(e)); }
    if (!odds || Object.keys(odds || {}).length === 0) {
      try { const all = await sportsgameodds.fetchAllOdds({ league, eventIDs: eventId, redis, forceFetch: false }); odds = Array.isArray(all) ? all[0] : all; } catch (e) { logger.warn('fetchAllOdds fallback failed', e?.message || String(e)); }
    }
    const ev = odds?.event || odds?.match || (odds && (odds.event || odds)) || {};
    const home = ev.home?.name || ev.home_team || ev.home || 'Home';
    const away = ev.away?.name || ev.away_team || ev.away || 'Away';
    const text = `*${home}* vs *${away}*`;
    const keyboard = { inline_keyboard: [[{ text: '📊 View Odds', callback_data: `odds_${league}_${eventId}` }], [{ text: '🔙 Back', callback_data: `league_${league}` }]] };
    return mkEdit(chatId, text, keyboard);
  } catch (err) {
    logger.warn('handleEventCallback error', err?.message || String(err));
    return mkSend(chatId, '❌ Error loading event');
  }
}

async function handleOddsCallback(data, chatId, redis) {
  const parts = data.split('_');
  if (parts.length < 3) return mkSend(chatId, 'Invalid odds selection');
  const league = parts[1];
  const eventId = parts.slice(2).join('_');
  try {
    let odds = null;
    try { odds = await sportsgameodds.fetchOdds({ league, eventId, redis, forceFetch: false }); } catch (e) { logger.warn('fetchOdds failed', e?.message || String(e)); }
    if (!odds || Object.keys(odds || {}).length === 0) { try { const all = await sportsgameodds.fetchAllOdds({ league, eventIDs: eventId, redis, forceFetch: false }); odds = Array.isArray(all) ? all[0] : all; } catch (e) { logger.warn('fetchAllOdds fallback failed', e?.message || String(e)); } }
    const markets = odds?.markets || odds?.market || [];
    let text = `📊 *Odds for ${eventId}*`;
    if (!markets || (Array.isArray(markets) && !markets.length)) text += '\n\nNo structured markets available.';
    const keyboard = { inline_keyboard: [[{ text: '🔙 Back to Event', callback_data: `event_${league}_${eventId}` }]] };
    return mkEdit(chatId, text, keyboard);
  } catch (err) {
    logger.warn('handleOddsCallback error', err?.message || String(err));
    return mkSend(chatId, '❌ Error loading odds');
  }
}

// --- News handlers ---
async function handleNewsArticleCallback(data, chatId, redis) {
  const id = String(data).replace(/^news_/, '');
  try {
    const article = await newsService.getById(id, { redis });
    if (!article) return mkSend(chatId, 'Article not found');
    const text = `📰 *${article.title || 'Article'}*\n\n${article.summary || article.description || article.content || 'Read more at the source.'}`;
    const keyboard = { inline_keyboard: [[{ text: 'Open in Browser', url: article.url || undefined }], [{ text: '🔙 Back to News', callback_data: 'menu_news' }]] };
    return mkEdit(chatId, text, keyboard);
  } catch (err) {
    logger.warn('handleNewsArticleCallback', err?.message || String(err));
    return mkSend(chatId, '❌ Error loading article');
  }
}

// --- Subscription / Payment handlers (minimal safe implementations) ---
function handleSubscriptionCallback(data, chatId) {
  const tier = String(data).replace(/^sub_/, '');
  const price = getTierAmount(tier);
  const text = `You selected *${getTierDisplayName(tier)}* - Amount: *KES ${price}*`;
  const keyboard = { inline_keyboard: [[{ text: 'Proceed to Pay', callback_data: `pay_PAYPAL_${tier}` }], [{ text: '🔙 Back', callback_data: 'menu_vvip' }]] };
  return mkEdit(chatId, text, keyboard);
}

async function handlePaymentCallback(data, chatId, _userId, redis, services) {
  // Example callback: pay_PAYPAL_PRO  or pay_BINANCE_VVIP
  const parts = data.split('_');
  const method = parts[1];
  const tier = parts.slice(2).join('_');
  try {
    const order = await createPaymentOrder({ method, tier, redis, services });
    const instr = getPaymentInstructions(order, method);
    const keyboard = { inline_keyboard: [[{ text: 'Open Payment', url: instr.url || undefined }], [{ text: '🔙 Back', callback_data: 'menu_vvip' }]] };
    return mkEdit(chatId, `Payment created. Order: ${order.id || 'N/A'}`, keyboard);
  } catch (err) {
    logger.warn('handlePaymentCallback error', err?.message || String(err));
    return mkSend(chatId, '❌ Error initiating payment');
  }
}

// --- Profile / Help ---
function handleProfileCallback(data, chatId) {
  return mkEdit(chatId, '*Profile*\n\nManage your preferences here.', profileMenu.reply_markup);
}

function handleHelpCallback(data, chatId) {
  return mkEdit(chatId, '*Help*\n\nUse /menu to open the main menu.', helpMenu.reply_markup);
}

// --- Small utility helpers used above ---
function getTierAmount(tier) {
  const amounts = { PRO: 899, VVIP: 2699, PLUS: 8999, FREE: 0 };
  return amounts[tier] || 2699;
}

function getTierDisplayName(tier) {
  const names = { PRO: 'Pro Tier 📊', VVIP: 'VVIP Tier 👑', PLUS: 'BETRIX Plus 💎', FREE: 'Free Tier' };
  return names[tier] || tier;
}

function getMethodName(method) {
  const names = {
    TILL: `🏪 Safaricom Till #${process.env.MPESA_TILL || '606215'}`,
    MPESA: '📱 M-Pesa (STK)',
    PAYPAL: '💳 PayPal',
    BINANCE: '₿ Binance Pay',
    SWIFT: '🏦 Bank Transfer'
  };
  return names[method] || method;
}

// --- Main exported router ---
export async function handleCallback(data, chatId, userId, redis, services = {}) {
  logger.info('Callback received', { userId, data });
  try {
    if (!data || typeof data !== 'string') return mkSend(chatId, 'Invalid action');
    if (data.startsWith('menu_')) return handleMenuCallback(data, chatId);
    if (data.startsWith('league_')) return await handleLeagueCallback(data, chatId, redis);
    if (data.startsWith('event_')) return await handleEventCallback(data, chatId, redis);
    if (data.startsWith('odds_')) return await handleOddsCallback(data, chatId, redis);
    if (data.startsWith('news_')) return await handleNewsArticleCallback(data, chatId, redis);
    if (data.startsWith('sub_')) return handleSubscriptionCallback(data, chatId);
    if (data.startsWith('pay_')) return await handlePaymentCallback(data, chatId, userId, redis, services);
    if (data.startsWith('profile_')) return handleProfileCallback(data, chatId);
    if (data.startsWith('help_')) return handleHelpCallback(data, chatId);
    return mkSend(chatId, 'Unknown action');
  } catch (err) {
    logger.error('Final handleCallback failed', err);
    return mkSend(chatId, '❌ Error processing callback');
  }
}

export default { handleCallback };
      chat_id: chatId,
