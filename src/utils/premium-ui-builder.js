/**
 * Premium UI Builder - BETRIX Supreme Brand Experience
 * Comprehensive formatting and interactive elements for superior UX
 */

import { Logger } from '../utils/logger.js';
import safeName from './safe-name.js';
import * as sanitize from './telegram-sanitize.js';

const logger = new Logger('PremiumUIBuilder');
void logger; // Silence unused logger warning

// BETRIX Brand Constants
export const BETRIX_BRAND = {
  EMOJI: '🌀',
  NAME: 'BETRIX',
  TAGLINE: 'AI-Powered Sports Analytics & Betting Intelligence',
  COLOR_ACCENT: '✨',
  BADGE_PREMIUM: '👑',
  BADGE_ELITE: '💎',
  BADGE_PRO: '📊',
  BADGE_VIP: '⭐'
};

/**
 * Build premium header with dynamic tier indicator
 */
export function buildBetrixHeader(tier = 'FREE', user = null) {
  const tierEmoji = {
    'FREE': '🆓',
    'PRO': '📊',
    'VVIP': '👑',
    'PLUS': '💎'
  }[tier] || '🆓';

  const name = user ? user.name || 'User' : 'Guest';
  
  return `${BETRIX_BRAND.EMOJI} *${BETRIX_BRAND.NAME}* ${tierEmoji}\n` +
         `${BETRIX_BRAND.TAGLINE}\n` +
         `👤 Welcome, *${name}*`;
}

/**
 * Build premium section divider
 */
export function buildSectionDivider(title) {
  return `\n${'─'.repeat(40)}\n*${title}*\n${'─'.repeat(40)}\n`;
}

/**
 * Build match card with comprehensive stats
 */
export function buildMatchCard(match, index = 1, includeOdds = true) {
  if (!match) return '';

  let home = safeName(match.home || match.homeTeam || (match.raw && match.raw.home_team) || (match.raw && match.raw.homeTeam), 'Home');
  let away = safeName(match.away || match.awayTeam || (match.raw && match.raw.away_team) || (match.raw && match.raw.awayTeam), 'Away');
  
  // Additional fallback from raw data for teams
  if ((home === 'Home' || !home) && match.raw) {
    home = (match.raw.teams && match.raw.teams.home && match.raw.teams.home.name) || 
           (match.raw.teams && match.raw.teams[0] && match.raw.teams[0].name) || 
           match.raw.main_team || match.home || 'Home';
  }
  if ((away === 'Away' || !away) && match.raw) {
    away = (match.raw.teams && match.raw.teams.away && match.raw.teams.away.name) || 
           (match.raw.teams && match.raw.teams[1] && match.raw.teams[1].name) || 
           match.raw.visitor_team || match.away || 'Away';
  }
  
  const score = match.score || `${(match.homeScore !== undefined && match.homeScore !== null) ? match.homeScore : '-'}-${(match.awayScore !== undefined && match.awayScore !== null) ? match.awayScore : '-'}`;
  const status = match.status || match.match_status || 'SCHEDULED';
  const time = normalizeDateTime(match) || match.time || match.minute || 'TBD';

  let card = `${index}️⃣ *${home}* vs *${away}*\n`;
  
  // Score line
  if (status === 'LIVE' || status === 'live' || status === 'IN_PLAY') {
    card += `🔴 \`${score}\` ⏱ ${time}\n`;
  } else if (status === 'FINISHED' || status === 'FT' || status === 'finished') {
    card += `✅ \`${score}\` 🏁 FT\n`;
  } else {
    card += `⏳ \`${score}\` 📅 ${time}\n`;
  }

  // League/Competition info
  if (match.league || match.competition) {
    card += `🏆 *${safeName(match.league || match.competition, '')}*\n`;
  }

  // Odds if available
  if (includeOdds && (match.homeOdds || match.odds)) {
    const homeOdds = match.homeOdds || match.odds?.home || '-';
    const drawOdds = match.drawOdds || match.odds?.draw || '-';
    const awayOdds = match.awayOdds || match.odds?.away || '-';
    card += `💰 Odds: \`${homeOdds}\` • \`${drawOdds}\` • \`${awayOdds}\`\n`;
  }

  // Key stats if available
  if (match.stats || match.possession) {
    card += buildMatchStats(match);
  }

  return card;
}

/**
 * Build match statistics display
 */
export function buildMatchStats(match) {
  let stats = '';

  if (match.possession) {
    const homePos = match.possession.home || match.possession.homeTeam || 0;
    const awayPos = match.possession.away || match.possession.awayTeam || 0;
    const homeBar = '█'.repeat(Math.round(homePos / 5)) + '░'.repeat(20 - Math.round(homePos / 5));
    const awayBar = '█'.repeat(Math.round(awayPos / 5)) + '░'.repeat(20 - Math.round(awayPos / 5));
    stats += `⚙️ Possession:\n${homeBar} ${homePos}%\n${awayBar} ${awayPos}%\n`;
  }

  if (match.stats) {
    const s = match.stats;
    stats += `📈 Stats:\n`;
    if (s.shots) stats += `🎯 Shots: ${s.shots.home || 0} - ${s.shots.away || 0}\n`;
    if (s.shotsOnTarget) stats += `🎯 On Target: ${s.shotsOnTarget.home || 0} - ${s.shotsOnTarget.away || 0}\n`;
    if (s.corners) stats += `🔃 Corners: ${s.corners.home || 0} - ${s.corners.away || 0}\n`;
    if (s.fouls) stats += `🚫 Fouls: ${s.fouls.home || 0} - ${s.fouls.away || 0}\n`;
    if (s.yellowCards) stats += `🟨 Yellow: ${s.yellowCards.home || 0} - ${s.yellowCards.away || 0}\n`;
    if (s.redCards) stats += `🔴 Red: ${s.redCards.home || 0} - ${s.redCards.away || 0}\n`;
  }

  return stats;
}

// Small helper: try multiple common fields for a date/time and return a human string or null
function normalizeDateTime(item) {
  try {
    if (!item) return null;
    const candidates = [item.kickoff, item.kickoff_at, item.utcDate, item.utc_date, item.date, item.time, item.starting_at, item.timestamp, item.ts, item.start];
    for (const c of candidates) {
      if (!c && c !== 0) continue;
      // numbers: seconds or ms
      if (typeof c === 'number') {
        const d = new Date(c < 1e12 ? c * 1000 : c);
        if (!isNaN(d.getTime())) return d.toLocaleString();
      }
      if (typeof c === 'string') {
        if (/^\d{10}$/.test(c)) {
          const d = new Date(Number(c) * 1000);
          if (!isNaN(d.getTime())) return d.toLocaleString();
        }
        if (/^\d{13}$/.test(c)) {
          const d = new Date(Number(c));
          if (!isNaN(d.getTime())) return d.toLocaleString();
        }
        const d = new Date(c);
        if (!isNaN(d.getTime())) return d.toLocaleString();
      }
    }
  } catch (e) {
    // ignore
  }
  return null;
}

/**
 * Build interactive action buttons for a match
 */
export function buildMatchActionButtons(matchId, leagueId = null, userTier = 'FREE') {
  const buttons = [];

  // Analyze button (for VVIP users)
  if (userTier !== 'FREE') {
    buttons.push({
      text: '🤖 AI Analyze',
      // Use upcoming token so handler resolves scheduled fixtures reliably
      callback_data: `analyze_match_upcoming_${matchId}`
    });
  }

  // Odds button
  buttons.push({
    text: '💰 Compare Odds',
    callback_data: `odds_compare_${matchId}`
  });

  // Favorite button
  buttons.push({
    text: '⭐ Add to Fav',
    callback_data: `fav_add_${matchId}`
  });

  // Bet slip button
  buttons.push({
    text: '🎟️ Add to Slip',
    callback_data: `slip_add_${matchId}`
  });

  // Refresh button
  buttons.push({
    text: '🔄 Refresh',
    callback_data: `match_refresh_${matchId}`
  });

  // Split into rows of 2
  const rows = [];
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2));
  }

  return rows;
}

/**
 * Build fixtures list for a league/competition
 */
export function buildFixturesDisplay(fixtures, league = 'League', view = 'upcoming') {
  if (!fixtures || fixtures.length === 0) {
    return `🏟️ *${league} ${view.toUpperCase()}*\n\n📭 No ${view} matches scheduled.`;
  }

  let display = buildSectionDivider(`${league} - ${view.toUpperCase()}`);

  fixtures.slice(0, 15).forEach((f, i) => {
    const status = (f.status === 'LIVE' || f.status === 'live' || f.status === 'IN_PLAY') ? '🔴' : '📅';
    const dt = normalizeDateTime(f) || f.time || f.date || 'TBD';
    let home = safeName(f.home || f.homeTeam || f.home_name || (f.raw && f.raw.home && f.raw.home.name), 'Home');
    let away = safeName(f.away || f.awayTeam || f.away_name || (f.raw && f.raw.away && f.raw.away.name), 'Away');
    if (!home) home = 'TBA';
    if (!away) away = 'TBA';
    const score = f.score || (f.homeScore !== undefined && f.homeScore !== null ? `${f.homeScore}-${f.awayScore}` : '─');

    display += `${i + 1}. ${status} \`${score}\` *${home}* vs *${away}*\n`;
    if (dt) display += `   ⏱ ${dt}\n`;
    display += '\n';
  });

  return display;
}

/**
 * Build league selector keyboard
 */
export function buildLeagueSelectorKeyboard(sport = 'football', tier = 'FREE') {
  void tier;
  const leagues = {
    'football': [
      { text: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League', callback_data: 'league_39' },
      { text: '🇪🇸 La Liga', callback_data: 'league_140' },
      { text: '🇮🇹 Serie A', callback_data: 'league_135' },
      { text: '🇩🇪 Bundesliga', callback_data: 'league_78' },
      { text: '🇫🇷 Ligue 1', callback_data: 'league_61' },
      { text: '🌍 Champions League', callback_data: 'league_2' },
      { text: '🌍 Europa League', callback_data: 'league_3' }
    ],
    'basketball': [
      { text: '🏀 NBA', callback_data: 'league_nba' },
      { text: '🇪🇺 EuroLeague', callback_data: 'league_euroleague' }
    ],
    'tennis': [
      { text: '🎾 ATP', callback_data: 'league_atp' },
      { text: '🎾 WTA', callback_data: 'league_wta' }
    ]
  };

  const sportLeagues = leagues[sport] || leagues['football'];
  
  // Build keyboard rows of 2 buttons
  const keyboard = [];
  for (let i = 0; i < sportLeagues.length; i += 2) {
    keyboard.push(sportLeagues.slice(i, i + 2));
  }

  // Add back button
  keyboard.push([{ text: '🔙 Back', callback_data: 'menu_live' }]);

  return keyboard;
}

/**
 * Build bet analysis display (for AI predictions)
 */
export function buildBetAnalysis(match, analysis = {}) {
  // Compose a lively MarkdownV2 message. Escape dynamic fields so callers
  // can send with `parse_mode: 'MarkdownV2'` safely.
  const homeEsc = sanitize.escapeMarkdownV2(safeName(match.home, 'Home'));
  const awayEsc = sanitize.escapeMarkdownV2(safeName(match.away, 'Away'));

  let text = `🧠🤖 *BETRIX — AI Bet Analysis* \n\n`;
  text += `🎟️ *${homeEsc}* vs *${awayEsc}*\n\n`;

  if (analysis.prediction) {
    text += `🎯 *Prediction:* ${sanitize.escapeMarkdownV2(String(analysis.prediction))}\n`;
  }

  if (analysis.confidence || analysis.confidence === 0) {
    const conf = Math.round(Number(analysis.confidence) || 0);
    const bar = '█'.repeat(Math.round(conf / 5)) + '░'.repeat(20 - Math.round(conf / 5));
    const emoji = conf >= 75 ? '🔥' : (conf >= 50 ? '⭐' : '⚪');
    text += `📊 *Confidence:* ${bar} ${conf}% ${emoji}\n`;
  }

  // Preferred bets / value bets table
  const bets = analysis.preferredBets && analysis.preferredBets.length ? analysis.preferredBets : (analysis.valueBets || []);
  if (bets && bets.length > 0) {
    text += `\n💎 *Preferred Bets* — top suggestions:\n`;
    // Build a simple monospace table for readability inside a code block
    const header = `No | Bet                     | Odds   | Conf | Stake\n`;
    let rows = '';
    bets.forEach((bet, i) => {
      const name = sanitize.escapeMarkdownV2(String(bet.option || bet.name || bet.title || ''));
      const odds = sanitize.escapeMarkdownV2(String(bet.odds || bet.price || '-'));
      const confNum = (typeof bet.confidence === 'number') ? Math.round(bet.confidence * 100) : (bet.confidence ? String(bet.confidence) : '');
      const conf = sanitize.escapeMarkdownV2(String(confNum));
      const stake = sanitize.escapeMarkdownV2(String(bet.suggested_stake_pct || bet.stake || bet.recommendedStake || '-'));
      const no = String(i + 1).padEnd(2);
      const betName = (name + ' '.repeat(22)).substring(0, 22);
      const oddsCell = (odds + ' '.repeat(6)).substring(0, 6);
      const confCell = (conf + ' '.repeat(4)).substring(0, 4);
      rows += `${no} | ${betName} | ${oddsCell} | ${confCell} | ${stake}\n`;
    });
    text += '```\n' + header + rows + '```\n';
    text += `\n🔔 Tip: Treat these as informational suggestions — gamble responsibly.`;
  }

  if (analysis.reasoning) {
    text += `\n📝 *Analysis Summary:*\n${sanitize.escapeMarkdownV2(String(analysis.reasoning))}\n`;
  }

  if (analysis.riskLevel) {
    text += `\n⚠️ *Risk Level:* ${sanitize.escapeMarkdownV2(String(analysis.riskLevel))}\n`;
  }

  text += `\n_Disclaimer: AI predictions are for informational purposes. Bet responsibly._`;

  return text;
}

/**
 * Build fixtures/upcoming matches display
 */
export function buildUpcomingFixtures(fixtures = [], league = '', daysBefore = 7, opts = { showActions: false, userTier: 'FREE', page: 1, pageSize: 20 }) {
  if (!fixtures || fixtures.length === 0) {
    return { text: `📭 No upcoming fixtures in the next ${daysBefore} days.`, reply_markup: null };
  }

  // Ensure league header is a safe string (could be object from cache)
  const leagueLabel = safeName(league, 'All Leagues');

  const sorted = fixtures.sort((a, b) => {
    const timeA = new Date(a.date || a.time || 0).getTime();
    const timeB = new Date(b.date || b.time || 0).getTime();
    return timeA - timeB;
  });

  const page = Number(opts.page || 1) || 1;
  const pageSize = Number(opts.pageSize || 20) || 20;
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const sliceStart = (currentPage - 1) * pageSize;
  const pageMatches = sorted.slice(sliceStart, sliceStart + pageSize);

  let display = `📅 *Upcoming Fixtures - ${leagueLabel}* — page ${currentPage}/${totalPages}\n\n`;

  const keyboard = [];

  pageMatches.forEach((f, i) => {
    const idx = sliceStart + i + 1;
    let home = safeName(f.home || f.homeTeam || f.home_name || (f.raw && f.raw.home && f.raw.home.name), 'TBA');
    let away = safeName(f.away || f.awayTeam || f.away_name || (f.raw && f.raw.away && f.raw.away.name), 'TBA');
    if (!home) home = 'TBA';
    if (!away) away = 'TBA';

    const dt = normalizeDateTime(f);
    let dateStr = 'TBA';
    let timeStr = '';
    if (dt) {
      // split date/time by locale
      const parts = dt.split(',');
      dateStr = parts[0] || dt;
      timeStr = parts[1] ? parts.slice(1).join(',').trim() : '';
    }

    display += `• ${home} vs ${away} — ${dateStr}${timeStr ? ' ' + timeStr : ''}\n`;

    // Primary selector row: opens match details so user can then Analyze
    const matchId = f.id || f.fixtureId || encodeURIComponent(`${home.replace(/\s+/g,'_')}_${away.replace(/\s+/g,'_')}_${idx}`);
    const sportKey = league || 'football';
    keyboard.push([{ text: `🔎 ${home} vs ${away}`, callback_data: `match:${matchId}:${sportKey}` }]);

    if (opts.showActions) {
      // Secondary action row: Analyze, Odds, Fav — Analyze available to all users
      const actionRow = [];
      actionRow.push({ text: '🤖 Analyze', callback_data: `analyze_match_upcoming_${matchId}` });
      actionRow.push({ text: '💰 Odds', callback_data: `odds_compare_${matchId}` });
      actionRow.push({ text: '⭐ Fav', callback_data: `fav_add_${matchId}` });
      keyboard.push(actionRow);
    }
  });

  // Navigation row
  const navRow = [];
  const sportKey = league || 'all';
  if (currentPage > 1) navRow.push({ text: '◀ Prev', callback_data: `sport:${sportKey}:upcoming:${currentPage - 1}` });
  navRow.push({ text: `🔄 Refresh`, callback_data: `sport:${sportKey}:upcoming:${currentPage}` });
  if (currentPage < totalPages) navRow.push({ text: 'Next ▶', callback_data: `sport:${sportKey}:upcoming:${currentPage + 1}` });
  if (navRow.length > 0) keyboard.push(navRow);

  // Bottom actions
  const bottomRow = [];
  bottomRow.push({ text: '🏟 Pick Sport', callback_data: 'sports' });
  bottomRow.push({ text: '🔙 Back', callback_data: 'menu_main' });
  keyboard.push(bottomRow);

  return { text: display, reply_markup: opts.showActions ? { inline_keyboard: keyboard } : { inline_keyboard: keyboard } };
}

/**
 * Build premium subscription comparison
 */
export function buildSubscriptionComparison() {
  return `${buildSectionDivider('🌀 BETRIX Subscription Tiers')}

*⭐ FREE TIER*
• 🔓 Community Access
• 📊 Basic Live Scores
• 💰 Delayed Odds (5 min)
• 🆓 Price: FREE

*📊 PRO TIER - KES 899/month*
• 🔓 All FREE features
• ⚡ Real-time Odds
• 🤖 Basic AI Analysis
• 📈 Match Statistics
• 🔔 Push Notifications

*👑 VVIP TIER - KES 2,699/month*
• 🔓 All PRO features
• 🔮 Advanced AI Predictions (85%+ accuracy)
• 📊 Arbitrage Detection
• 🎯 Fixed Match Tips
• 💎 Priority Support
• 📱 Mobile App Access

*💎 BETRIX Plus - KES 8,999/month*
• 🔓 All VVIP features
• 🔥 Exclusive Strategies
• 🌍 Multi-sport Analysis
• 📊 Custom Alerts
• 🏆 VIP Event Access
• 👥 Private Community

_Use code BETRIX10 for 10% off your first month!_`;
}

/**
 * Build error message with recovery options
 */
export function buildErrorMessage(error, tier = 'FREE') {
  let msg = `❌ *Error*\n\n`;
  void tier;

  if (error.includes('quota') || error.includes('limit')) {
    msg += `⚠️ API Quota reached. Retrying in a moment...`;
  } else if (error.includes('auth') || error.includes('unauthorized')) {
    msg += `🔐 Authentication failed. Please contact support.`;
  } else if (error.includes('upgrade')) {
    msg += `👑 This feature requires a VVIP subscription.\n\nTap "Subscribe" to unlock premium features!`;
  } else {
    msg += `Something went wrong. Please try again later.`;
  }

  msg += `\n\n_Error: ${error.substring(0, 50)}..._`;

  return msg;
}

/**
 * Build live match ticker (compact display for multiple matches)
 */
export function buildLiveMatchTicker(matches = []) {
  if (!matches || matches.length === 0) {
    return '🔴 No live matches at the moment.';
  }

  let ticker = `🔴 *LIVE NOW*\n\n`;

  matches.slice(0, 8).forEach((m) => {
    const score = (m.homeScore !== undefined && m.homeScore !== null) ? `${m.homeScore}-${m.awayScore}` : '─';
    const time = normalizeDateTime(m) || m.time || '...';
    let home = safeName(m.home || m.homeTeam || m.home_name || (m.raw && m.raw.home && m.raw.home.name), 'Home');
    let away = safeName(m.away || m.awayTeam || m.away_name || (m.raw && m.raw.away && m.raw.away.name), 'Away');
    if (!home) home = 'TBA';
    if (!away) away = 'TBA';

    // Stadium/venue if present - avoid numeric-only IDs
    let venue = null;
    if (m.venue || m.stadium || m.venue_name) venue = safeName(m.venue || m.stadium || m.venue_name, '');
    if (!venue && (m.venue_id || m.stadium_id)) {
      const id = m.venue_id || m.stadium_id;
      if (typeof id === 'number' && id > 0) venue = `Stadium #${id}`;
    }

    ticker += `⚽ \`${score}\` *${home}* vs *${away}* \n   ⏱ ${time}`;
    if (venue) ticker += `\n   🏟 ${venue}`;
    ticker += `\n`;
  });

  if (matches.length > 8) {
    ticker += `\n... and ${matches.length - 8} more matches live!`;
  }

  return ticker;
}

/**
 * Build stat comparison between two teams
 */
export function buildTeamComparison(home, away, homeStats = {}, awayStats = {}) {
  home = safeName(home, 'Home');
  away = safeName(away, 'Away');

  let comparison = `⚖️ *Team Comparison*\n\n`;
  comparison += `*${home}* vs *${away}*\n\n`;

  const stats = [
    { key: 'form', label: '📊 Form', home: homeStats.form, away: awayStats.form },
    { key: 'avgGoals', label: '⚽ Avg Goals', home: homeStats.avgGoals, away: awayStats.avgGoals },
    { key: 'winRate', label: '✅ Win Rate', home: homeStats.winRate, away: awayStats.winRate },
    { key: 'injuries', label: '🏥 Injuries', home: homeStats.injuries, away: awayStats.injuries }
  ];

  stats.forEach(stat => {
    if (stat.home !== undefined && stat.away !== undefined) {
      comparison += `${stat.label}\n`;
      comparison += `${home.substring(0, 15)}: ${stat.home}\n`;
      comparison += `${away.substring(0, 15)}: ${stat.away}\n\n`;
    }
  });

  return comparison;
}

/**
 * Build notification alert
 */
export function buildNotificationAlert(type, data) {
  const alerts = {
    'goal': `⚽ *GOAL!* ${data.scorer} just scored!\n*${safeName(data.home, 'Home')}* ${data.score} *${safeName(data.away, 'Away')}*`,
    'redcard': `🔴 *RED CARD!* ${data.player} has been sent off!`,
    'yellowcard': `🟨 *YELLOW CARD* for ${data.player}`,
    'status': `📡 *Match Status Update*\n${data.status}`,
    'odds_update': `💰 *Odds Updated!*\n${safeName(data.home, 'Home')} @ ${data.homeOdds}\nDraw @ ${data.drawOdds}\n${safeName(data.away, 'Away')} @ ${data.awayOdds}`
  };

  return alerts[type] || `📡 *Notification*\n${JSON.stringify(data)}`;
}

export default {
  BETRIX_BRAND,
  buildBetrixHeader,
  buildSectionDivider,
  buildMatchCard,
  buildMatchStats,
  buildMatchActionButtons,
  buildFixturesDisplay,
  buildLeagueSelectorKeyboard,
  buildBetAnalysis,
  buildUpcomingFixtures,
  buildSubscriptionComparison,
  buildErrorMessage,
  buildLiveMatchTicker,
  buildTeamComparison,
  buildNotificationAlert
};
