/**
 * BETRIX Menu System - Consolidated
 * All menu definitions, formatters, and UI builders in one module
 * 
 * Exports:
 * - mainMenu, sportsMenu, subscriptionMenu, profileMenu, helpMenu
 * - format* functions for each content type
 */

import { Logger } from '../utils/logger.js';

const logger = new Logger('MenuSystem');
void logger;

const BETRIX_EMOJI = '🌀';
const BETRIX_HEADER = `${BETRIX_EMOJI} *BETRIX* - Premium Sports Analytics`;
const TILL_NUMBER = process.env.MPESA_TILL || process.env.SAFARICOM_TILL_NUMBER || '606215';

/**
 * Brand wrapper: ensures all UI text includes consistent header and optional footer
 */
export function brand(body, opts = {}) {
  const footer = opts.footer || `\n\n⚡ Visit https://betrix.app for more`;
  // Trim leading/trailing whitespace and ensure spacing
  const b = (body || '').toString().trim();
  return `${BETRIX_HEADER}\n\n${b}${opts.suppressFooter ? '' : footer}`;
}

// ============================================================================
// MAIN MENU
// ============================================================================

export const mainMenu = {
  text: brand(`Welcome back! 👋 Choose an option below or ask naturally (e.g. "Top picks tonight").`, { suppressFooter: true }),

  // Modern compact grid: two-column primary actions, single-row utilities
  reply_markup: {
    inline_keyboard: [
      [
        { text: '🔴 Live', callback_data: 'menu_live' },
        { text: '📊 Odds', callback_data: 'menu_odds' }
      ],
      [
        { text: '🏆 Standings', callback_data: 'menu_standings' },
        { text: '📰 News', callback_data: 'menu_news' }
      ],
      [
        { text: '💎 Subscribe', callback_data: 'menu_vvip' },
        { text: '👤 Profile', callback_data: 'menu_profile' }
      ],
      [
        { text: '❓ Help', callback_data: 'menu_help' },
        { text: '⚙️ Settings', callback_data: 'menu_help' }
      ]
    ]
  }
};

// ============================================================================
// SPORTS MENU
// ============================================================================

export const sportsMenu = {
  text: brand(`*Select a Sport:*`, { suppressFooter: true }),
  
  reply_markup: {
    inline_keyboard: [
      [
        { text: '⚽ Football', callback_data: 'sport_football' },
        { text: '🏀 Basketball', callback_data: 'sport_basketball' }
      ],
      [
        { text: '🎾 Tennis', callback_data: 'sport_tennis' },
        { text: '🏈 American Football', callback_data: 'sport_nfl' }
      ],
      [
        { text: '🏒 Ice Hockey', callback_data: 'sport_hockey' },
        { text: '⚾ Baseball', callback_data: 'sport_baseball' }
      ],
      [
        { text: '🔙 Back to Main', callback_data: 'menu_main' }
      ]
    ]
  }
};

// ============================================================================
// SUBSCRIPTION MENU (REDESIGNED)
// ============================================================================

export const subscriptionMenu = {
  text: brand(`🎉 Unlock Premium — simple plans, instant access.\n\nChoose a plan below. Payment methods shown after selection.`, { suppressFooter: true }),

  // Compact subscription card layout
  reply_markup: {
    inline_keyboard: [
      [ { text: '📊 Pro — KES 899/mo', callback_data: 'sub_pro' } ],
      [ { text: '👑 VVIP — KES 2,699/mo', callback_data: 'sub_vvip' } ],
      [ { text: '💎 PLUS — KES 8,999/mo', callback_data: 'sub_plus' } ],
      [ { text: '🔙 Back', callback_data: 'menu_main' } ]
    ]
  }
};

// ============================================================================
// PAYMENT METHODS MENU (NEW)
// ============================================================================

export const paymentMethodsMenu = (tier) => ({
  text: brand(`*Choose Payment Method for ${tier} Tier*\n\nSelect one of our secure payment options below:`, { suppressFooter: true }),
  
  reply_markup: {
    inline_keyboard: [
      [
        { text: `🏪 Safaricom Till #${TILL_NUMBER}`, callback_data: `pay_till_${tier}` },
        { text: '📱 M-Pesa STK', callback_data: `pay_mpesa_${tier}` }
      ],
      [
        { text: '💳 PayPal', callback_data: `pay_paypal_${tier}` },
        { text: '₿ Binance Pay', callback_data: `pay_binance_${tier}` }
      ],
      [
        { text: '🏦 Bank Transfer', callback_data: `pay_swift_${tier}` },
        { text: '🔙 Back', callback_data: 'menu_vvip' }
      ]
    ]
  }
});

// ============================================================================
// PROFILE MENU
// ============================================================================

export const profileMenu = {
  text: brand(`*Your Profile*\n\nManage your account, view stats, and preferences.`, { suppressFooter: true }),
  
  reply_markup: {
    inline_keyboard: [
      [
        { text: '📊 My Stats', callback_data: 'profile_stats' },
        { text: '💰 My Transactions', callback_data: 'profile_bets' }
      ],
      [
        { text: '⭐ Favorites', callback_data: 'profile_favorites' },
        { text: '⚙️ Settings', callback_data: 'profile_settings' }
      ],
      [
        { text: '🔙 Back to Main', callback_data: 'menu_main' }
      ]
    ]
  }
};

// ============================================================================
// HELP MENU
// ============================================================================

export const helpMenu = {
  text: brand(`*Quick Help*\n\n📱 *How to use BETRIX:*\n\n1️⃣ *Ask naturally:*\n   "Which games are live today?"\n   "Show me odds for Liverpool"\n   "What's the best bet this week?"\n\n2️⃣ *Use Commands:*\n   /live - See live games\n   /odds - Get current odds\n   /standings - League standings\n   /news - Latest news\n   /profile - Your account\n\n3️⃣ *Subscribe for premium:*\n   /vvip - Upgrade your plan\n\n📧 *Need Help?*\nContact: support@betrix.app\nResponse time: ~2 hours\n\n*What can I help with?*`, { suppressFooter: true }),
  
  reply_markup: {
    inline_keyboard: [
      [
        { text: '❓ FAQ', callback_data: 'help_faq' },
        { text: '🎮 Try Demo', callback_data: 'help_demo' }
      ],
      [
        { text: '📧 Contact Support', callback_data: 'help_contact' },
        { text: '🔙 Back', callback_data: 'menu_main' }
      ]
    ]
  }
};

// ============================================================================
// FORMATTERS - Live Games
// ============================================================================

export function formatLiveGames(games, sport = 'Football') {
  // Lively, helpful fallback when no live matches
  if (!games || games.length === 0) {
    return brand(`🔴 *No live ${sport.toLowerCase()} matches right now*\n\nSeems quiet at the moment — here's what you can do:\n• 🔎 Try /today to see upcoming fixtures.\n• 🔔 Turn on alerts for your favourite teams in /profile.\n• 📈 Check trending odds: /odds <fixture-id>\n\nI'll notify you when a match starts. Meanwhile, want a quick prediction demo? Type "analyze Liverpool vs Man City".`, { suppressFooter: true });
  }

  let text = brand(`🔴 *Live ${sport} Matches* (${games.length}) — quick highlights:\n\n`, { suppressFooter: true });

  for (let i = 0; i < Math.min(games.length, 10); i++) {
    const game = games[i];
    // Friendly formatting with emoji and short status
    const status = game.status || 'LIVE';
    const minute = game.minute ? ` • ${game.minute}'` : '';
    const fid = game.id ? ` (ID: ${game.id})` : '';
    text += `${i + 1}. *${game.home}* vs *${game.away}*${fid} — ${status}${minute}\n`;
    if (game.score) text += `   Score: ${game.score.home} - ${game.score.away}\n`;
    text += `   Tip: ${game.tip || 'No tip yet — run /analyze for a short preview'}\n\n`;
  }
  text += `⚡ Use /odds <fixture-id> to view current odds (example: /odds 12345), or run /analyze <home> vs <away> for a prediction.`;
  return text;
}

// ============================================================================
// FORMATTERS - Odds & Analysis
// ============================================================================

export function formatOdds(odds, fixtureId) {
  // Provide a lively, explanatory odds summary
  const bk = Array.isArray(odds?.bookmakers) ? odds.bookmakers.slice(0, 2) : [];

  const snapshot = (source) => {
    if (!source) return { home: 'N/A', draw: 'N/A', away: 'N/A', label: 'Market' };
    const label = source.title || source.name || (source.bk || 'Bookmaker');
    const market = source.markets?.[0] || source.bets?.[0] || null;
    if (market && market.outcomes) {
      const home = market.outcomes.find(o => /home|1/i.test(o.name))?.price ?? market.outcomes[0]?.price ?? 'N/A';
      const draw = market.outcomes.find(o => /draw|x/i.test(o.name))?.price ?? market.outcomes[1]?.price ?? 'N/A';
      const away = market.outcomes.find(o => /away|2/i.test(o.name))?.price ?? market.outcomes[2]?.price ?? 'N/A';
      return { home, draw, away, label };
    }
    return { home: source.home ?? 'N/A', draw: source.draw ?? 'N/A', away: source.away ?? 'N/A', label };
  };

  const aggregated = bk.map(snapshot);
  const primary = aggregated[0] || snapshot(odds);
  const secondary = aggregated[1] || null;

  let lines = brand(`💰 *Odds & Quick Analysis*\n\nMatch: ${fixtureId || 'Fixture details'}\n\n`, { suppressFooter: true });
  lines += `🏷️ *Odds Snapshot* (${primary.label}):\n• Home: ${primary.home} · Draw: ${primary.draw} · Away: ${primary.away}\n`;
  if (secondary) {
    lines += `• Compared with ${secondary.label}: Home ${secondary.home}, Draw ${secondary.draw}, Away ${secondary.away}\n`;
  }

  lines += `\n🔍 *Quick Insight:*\n• Recommendation: *${odds?.recommended || 'Compare markets'}*\n• Confidence: *${odds?.confidence || 'N/A'}*\n\n💡 Tip: Compare multiple bookmakers and look for >10% edge before staking.\nType /analyze <home> vs <away> for a short prediction, or upgrade to VVIP for full reports.`;

  return lines;
}

// ============================================================================
// FORMATTERS - Standings
// ============================================================================

export function formatStandings(league, leagueName = 'Premier League') {
  // Lively standings with short actionable note
  return brand(`🏆 *${leagueName} - Current Standings*\n\n1. Team A · MP:10 · W:7 · D:2 · L:1 · GD:+12 · Pts:23\n2. Team B · MP:10 · W:6 · D:3 · L:1 · GD:+10 · Pts:21\n3. Team C · MP:10 · W:6 · D:2 · L:2 · GD:+8  · Pts:20\n\n🔎 Want deeper analytics? Try /analyze <team1> vs <team2> or upgrade to VVIP for detailed trend reports.`, { suppressFooter: true });
}

// ============================================================================
// FORMATTERS - News
// ============================================================================

export function formatNews(articles = []) {
  if (!articles || articles.length === 0) {
    return brand(`📰 *Latest Sports News*\n\nNo fresh headlines right now — here's what's trending recently:\n• Transfer gossip: top 5 moves\n• Injury round-up: key players returning\n• Weekend previews: matches to watch\n\nType /news <id> to open a story. Want a curated digest? Upgrade to VVIP for personalized news.`, { suppressFooter: true });
  }

  let text = brand(`📰 *Latest Sports Headlines*\n\n`, { suppressFooter: true });
  for (let i = 0; i < Math.min(5, articles.length); i++) {
    const a = articles[i];
    text += `• ${a.title || 'Headline ' + (i+1)} — ${a.source || 'Source'}\n`;
  }
  text += `\n🔎 Use /news <id> to read full story or /help for support.`;
  return text;
}

// ============================================================================
// FORMATTERS - Profile
// ============================================================================

export function formatProfile(user) {
  const tier = user?.tier || 'FREE';
  const joined = user?.created_at || 'Unknown';
  const bets = Number(user?.total_bets || 0);
  const wins = Number(user?.total_wins || 0);
  const winRate = bets > 0 ? ((wins / bets) * 100).toFixed(1) : 0;
  const streak = user?.current_streak || 0;

  return brand(`👤 *Your Profile*\n\nID: \`${user?.id || 'N/A'}\`\n⭐ Tier: *${tier}*\n📅 Joined: ${joined}\n\n📊 *Performance*\n• Total Bets: ${bets}\n• Wins: ${wins}\n• Win Rate: ${winRate}%\n• Current Streak: ${streak} wins\n\n🎯 *Pro Tip:* Keep your stakes proportional to bankroll. Use /vvip for full analytics and personalized staking plans.\n\n🎁 Referral Code: \`${user?.referral_code || 'N/A'}\`\n\nNeed help? Tap /help or contact support@betrix.app`, { suppressFooter: true });
}

// ============================================================================
// UTILITY - Build Dynamic Menu
// ============================================================================

/**
 * Build a menu based on user tier
 * Shows different options based on subscription level
 */
export function buildTierAwareMenu(tier) {
  const baseButtons = [
    [
      { text: '⚽ Live Games', callback_data: 'menu_live' },
      { text: '📊 Odds & Analysis', callback_data: 'menu_odds' }
    ]
  ];
  
  if (tier === 'FREE') {
    baseButtons.push([
      { text: '💰 Upgrade to VVIP', callback_data: 'menu_vvip' }
    ]);
  } else if (['PRO', 'VVIP', 'PLUS'].includes(tier)) {
    baseButtons.push([
      { text: '🎯 Advanced Features', callback_data: 'menu_advanced' }
    ]);
  }
  
  baseButtons.push([
    { text: '👤 Profile', callback_data: 'menu_profile' },
    { text: '❓ Help', callback_data: 'menu_help' }
  ]);
  
  return {
    reply_markup: {
      inline_keyboard: baseButtons
    }
  };
}

export default {
  mainMenu,
  sportsMenu,
  subscriptionMenu,
  paymentMethodsMenu,
  profileMenu,
  helpMenu,
  formatLiveGames,
  formatOdds,
  formatStandings,
  formatNews,
  formatProfile,
  buildTierAwareMenu
};
