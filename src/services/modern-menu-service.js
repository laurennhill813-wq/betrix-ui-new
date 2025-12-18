/**
 * BETRIX Modern Menu Service - Premium UX with inline buttons
 * Modern patterns, clear sections, all features visible
 */

import { BrandingService } from "./branding-service.js";

class ModernMenuService {
  /**
   * Main Dashboard Menu - Clean and organized
   */
  static mainMenu() {
    return {
      text: `${BrandingService.ICONS.brand} <b>BETRIX Dashboard</b>

━━━━━━━━━━━━━━━━━━━━━━━
🔥 <b>TODAY'S FEATURED</b>
━━━━━━━━━━━━━━━━━━━━━━━
${BrandingService.ICONS.live} Live Matches
${BrandingService.ICONS.odds} Hot Odds
${BrandingService.ICONS.tips} AI Analysis

━━━━━━━━━━━━━━━━━━━━━━━
⚽ <b>SPORTS ZONE</b>
━━━━━━━━━━━━━━━━━━━━━━━
${BrandingService.ICONS.live} Live Matches
${BrandingService.ICONS.standings} League Tables
${BrandingService.ICONS.odds} Betting Odds
${BrandingService.ICONS.analyze} Match Analysis
${BrandingService.ICONS.predict} AI Predictions

━━━━━━━━━━━━━━━━━━━━━━━
🆓 <b>FREE FEATURES</b>
━━━━━━━━━━━━━━━━━━━━━━━
🎭 Memes & Fun
💰 Crypto Prices
📰 Sports News
📡 Headlines (RSS)
💬 Reddit Trends
🌦️ Weather Impact
⭐ Stadium Info
🎯 Trending Bets
📊 Live Commentary

━━━━━━━━━━━━━━━━━━━━━━━
💡 <b>INTELLIGENCE</b>
━━━━━━━━━━━━━━━━━━━━━━━
${BrandingService.ICONS.coach} Betting Coach
${BrandingService.ICONS.tips} Strategy Tips
${BrandingService.ICONS.insights} Personalized Picks

━━━━━━━━━━━━━━━━━━━━━━━
👑 <b>PREMIUM (VVIP)</b>
━━━━━━━━━━━━━━━━━━━━━━━
${BrandingService.ICONS.vvip} Professional Dossier
${BrandingService.ICONS.vvip} Deep Trends
${BrandingService.ICONS.vvip} Elite Coaching

━━━━━━━━━━━━━━━━━━━━━━━
⚙️ <b>ACCOUNT & SUPPORT</b>
━━━━━━━━━━━━━━━━━━━━━━━
${BrandingService.ICONS.status} My Profile
${BrandingService.ICONS.pricing} Subscribe Now
${BrandingService.ICONS.help} Commands & Help

💬 Chat with BETRIX: Just type anything!`,
      keyboard: [
        [
          {
            text: `${BrandingService.ICONS.live} LIVE`,
            callback_data: "menu:live",
          },
          {
            text: `${BrandingService.ICONS.odds} ODDS`,
            callback_data: "menu:odds",
          },
        ],
        [
          {
            text: `${BrandingService.ICONS.tips} TIPS`,
            callback_data: "menu:tips",
          },
          {
            text: `${BrandingService.ICONS.analyze} ANALYZE`,
            callback_data: "menu:analyze",
          },
        ],
        [
          { text: "🎭 MEMES", callback_data: "menu:meme" },
          { text: "💰 CRYPTO", callback_data: "menu:crypto" },
        ],
        [
          { text: "📰 NEWS", callback_data: "menu:news" },
          { text: "📡 HEADLINES", callback_data: "menu:headlines" },
        ],
        [
          { text: "💬 REDDIT", callback_data: "menu:reddit" },
          { text: "⭐ STADIUM", callback_data: "menu:stadium" },
        ],
        [
          { text: "🎯 BET IDEAS", callback_data: "menu:trending_bets" },
          { text: "🌦️ WEATHER", callback_data: "menu:weather" },
        ],
        [
          {
            text: `${BrandingService.ICONS.status} PROFILE`,
            callback_data: "menu:profile",
          },
          {
            text: `${BrandingService.ICONS.pricing} UPGRADE`,
            callback_data: "menu:pricing",
          },
        ],
      ],
    };
  }

  /**
   * Sports Zone Menu
   */
  static sportsMenu() {
    return `${BrandingService.ICONS.live} <b>⚽ SPORTS ZONE</b>

━━━━━━━━━━━━━━━━━━━━━━━
🔥 MOST WATCHED
━━━━━━━━━━━━━━━━━━━━━━━
${BrandingService.ICONS.live} /live - Active Now
${BrandingService.ICONS.standings} /standings - Tables

━━━━━━━━━━━━━━━━━━━━━━━
📊 ANALYSIS & DATA
━━━━━━━━━━━━━━━━━━━━━━━
${BrandingService.ICONS.odds} /odds - Betting Odds
${BrandingService.ICONS.analyze} /analyze - AI Analysis
${BrandingService.ICONS.predict} /predict - Predictions

━━━━━━━━━━━━━━━━━━━━━━━
📋 FIXTURES & TRACKING
━━━━━━━━━━━━━━━━━━━━━━━
/fixtures - Big Matches
/watch [id] - Set Alerts

<b>💬 Need help?</b> /help`;
  }

  /**
   * Free Features Menu
   */
  static freeFeaturesMenu() {
    return `🆓 <b>FREE FEATURES (No Limits!)</b>

━━━━━━━━━━━━━━━━━━━━━━━
🎭 FUN & ENGAGEMENT
━━━━━━━━━━━━━━━━━━━━━━━
🎭 /meme - Funny Betting Reactions
📰 /news - Latest Sports Headlines
📊 /quote - Inspirational Quotes

━━━━━━━━━━━━━━━━━━━━━━━
💰 MARKETS & MONEY
━━━━━━━━━━━━━━━━━━━━━━━
💰 /crypto [symbol] - Bitcoin/Ethereum/XRP
🎯 /trending_bets - Popular Bet Types
/bet_rec - Bet Recommendation

━━━━━━━━━━━━━━━━━━━━━━━
📡 REAL-TIME DATA
━━━━━━━━━━━━━━━━━━━━━━━
📡 /headlines - RSS Sports Headlines
💬 /reddit - Reddit Sports Trends
📊 /trending - What's Hot Globally

━━━━━━━━━━━━━━━━━━━━━━━
🏟️ MATCH INTELLIGENCE
━━━━━━━━━━━━━━━━━━━━━━━
⭐ /stadium [name] - Stadium Info
🎯 /fixtures - Upcoming Big Matches
📻 /live - Live Match Commentary

━━━━━━━━━━━━━━━━━━━━━━━
💡 KNOWLEDGE
━━━━━━━━━━━━━━━━━━━━━━━
💡 /fact - Sports Trivia
🎓 /betting_fact - Pro Betting Tips
/tip - Strategy Wisdom

🚀 <b>All features unlocked - use them all, anytime!</b>`;
  }

  /**
   * Premium Features Menu
   */
  static premiumMenu() {
    return `👑 <b>PREMIUM FEATURES (VVIP ONLY)</b>

━━━━━━━━━━━━━━━━━━━━━━━
🏆 PROFESSIONAL ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━
/dossier - 500+ word expert analysis
/coach - Personal betting coach
/trends - Seasonal performance data

━━━━━━━━━━━━━━━━━━━━━━━
💎 EXCLUSIVE PERKS
━━━━━━━━━━━━━━━━━━━━━━━
✓ Zero ads
✓ 100 commands/min (vs 30)
✓ Early predictions
✓ Pro analytics
✓ Priority support

━━━━━━━━━━━━━━━━━━━━━━━
💰 PRICING
━━━━━━━━━━━━━━━━━━━━━━━
📅 Daily: KES 200 / USD 2
📅 Weekly: KES 800 / USD 6
📅 Monthly: KES 2,500 / USD 20

👉 /upgrade to unlock now`;
  }

  /**
   * Help & Commands Menu
   */
  static helpMenu() {
    return `${BrandingService.ICONS.help} <b>COMMAND REFERENCE</b>

━━━━━━━━━━━━━━━━━━━━━━━
🚀 GETTING STARTED
━━━━━━━━━━━━━━━━━━━━━━━
/start - Welcome guide
/menu - Main menu
/help - This list

━━━━━━━━━━━━━━━━━━━━━━━
⚽ SPORTS (FREE)
━━━━━━━━━━━━━━━━━━━━━━━
/live - Active matches
/standings [league] - Tables
/odds [match] - Odds
/analyze [team1 vs team2] - Analysis
/predict [teams] - AI predictions

━━━━━━━━━━━━━━━━━━━━━━━
🆓 ALL FREE (Unlimited)
━━━━━━━━━━━━━━━━━━━━━━━
/meme /crypto /news /tip /fact
/headlines /reddit /trending /quote
/stadium /fixtures /trending_bets
/betting_fact /live_commentary

━━━━━━━━━━━━━━━━━━━━━━━
👤 ACCOUNT
━━━━━━━━━━━━━━━━━━━━━━━
/status - Profile
/history - Transactions
/language [en/sw/fr] - Lang
/refer - Earn rewards

━━━━━━━━━━━━━━━━━━━━━━━
💼 BUSINESS
━━━━━━━━━━━━━━━━━━━━━━━
/pricing - See plans
/upgrade - Buy premium
/pay - Make payment

💬 <b>Or just chat naturally!</b> BETRIX understands conversation.`;
  }

  /**
   * Account Menu
   */
  static accountMenu(user) {
    const tier = user?.tier || "free";
    const tierEmoji = tier === "vvip" ? "👑" : tier === "member" ? "⭐" : "🆓";

    return `${BrandingService.ICONS.status} <b>MY PROFILE</b>

━━━━━━━━━━━━━━━━━━━━━━━
👤 <b>ACCOUNT INFO</b>
━━━━━━━━━━━━━━━━━━━━━━━
${tierEmoji} <b>Tier:</b> ${tier.toUpperCase()}
📊 <b>Bets:</b> ${user?.betsPlaced || 0}
✅ <b>Wins:</b> ${user?.wins || 0}
💰 <b>Total Staked:</b> KES ${user?.totalStaked || 0}

━━━━━━━━━━━━━━━━━━━━━━━
🎯 <b>ACHIEVEMENTS</b>
━━━━━━━━━━━━━━━━━━━━━━━
🏆 ${user?.achievements?.length || 0} badges earned

━━━━━━━━━━━━━━━━━━━━━━━
⚙️ <b>SETTINGS</b>
━━━━━━━━━━━━━━━━━━━━━━━
/language - Change language
/country - Update location
/verify - Phone verification
/refer - Invite friends

━━━━━━━━━━━━━━━━━━━━━━━
💳 <b>PAYMENTS</b>
━━━━━━━━━━━━━━━━━━━━━━━
/history - Transaction log
/pay - Make payment
/pricing - Upgrade options

━━━━━━━━━━━━━━━━━━━━━━━
❓ <b>SUPPORT</b>
━━━━━━━━━━━━━━━━━━━━━━━
/help - Commands
/support - Get help
/report - Report issue`;
  }

  /**
   * Inline keyboard buttons
   */
  static inlineKeyboard(type = "main") {
    const keyboards = {
      main: {
        inline_keyboard: [
          [
            {
              text: `${BrandingService.ICONS.live} Live`,
              callback_data: "menu:live",
            },
            {
              text: `${BrandingService.ICONS.odds} Odds`,
              callback_data: "menu:odds",
            },
          ],
          [
            { text: "🎭 Memes", callback_data: "menu:meme" },
            { text: "💰 Crypto", callback_data: "menu:crypto" },
          ],
          [
            { text: "📰 News", callback_data: "menu:news" },
            { text: "📡 Headlines", callback_data: "menu:headlines" },
          ],
          [
            {
              text: `${BrandingService.ICONS.pricing} Upgrade`,
              callback_data: "menu:upgrade",
            },
            {
              text: `${BrandingService.ICONS.help} Help`,
              callback_data: "menu:help",
            },
          ],
        ],
      },
      sports: {
        inline_keyboard: [
          [
            {
              text: `${BrandingService.ICONS.live} Live`,
              callback_data: "action:live",
            },
            {
              text: `${BrandingService.ICONS.standings} Tables`,
              callback_data: "action:standings",
            },
          ],
          [
            {
              text: `${BrandingService.ICONS.odds} Odds`,
              callback_data: "action:odds",
            },
            {
              text: `${BrandingService.ICONS.analyze} Analyze`,
              callback_data: "action:analyze",
            },
          ],
        ],
      },
      free: {
        inline_keyboard: [
          [
            { text: "🎭 Memes", callback_data: "free:meme" },
            { text: "💰 Crypto", callback_data: "free:crypto" },
          ],
          [
            { text: "📰 News", callback_data: "free:news" },
            { text: "📡 Headlines", callback_data: "free:headlines" },
          ],
          [
            { text: "💬 Reddit", callback_data: "free:reddit" },
            { text: "⭐ Stadium", callback_data: "free:stadium" },
          ],
        ],
      },
    };
    return keyboards[type] || keyboards.main;
  }
}

export { ModernMenuService };
