/**
 * BETRIX Complete Telegram Handler v3
 * Handles all commands, callbacks, and menu navigation
 * Every button properly connected to correct responses
 */

import { Logger } from '../utils/logger.js';
import * as completeMenus from './menu-handler-complete.js';
import { createCustomPaymentOrder } from './payment-router.js';
import lipana from '../lib/lipana-client.js';
import { Pool } from 'pg';
import SportMonksService from '../services/sportmonks-service.js';

const logger = new Logger('HandlerComplete');

function safeName(val, fallback = 'TBA') {
  try {
    if (val == null) return fallback;
    if (typeof val === 'string' || typeof val === 'number') return String(val);
    if (typeof val === 'object') {
      if (val.name) return String(val.name);
      if (val.fullName) return String(val.fullName);
      if (val.teamName) return String(val.teamName);
      // last resort: stringify
      return JSON.stringify(val);
    }
    return String(val);
  } catch (e) {
    return fallback;
  }
}

/**
 * Fetch live matches from SportMonks
 */
async function getLiveMatches(services = {}, sport = 'football') {
  try {
    void sport;
    // Prefer injected sportsAggregator if available (provides caching and fixtures integration)
    if (services && services.sportsAggregator && typeof services.sportsAggregator.getAllLiveMatches === 'function') {
      return await services.sportsAggregator.getAllLiveMatches();
    }

    const sportMonks = new SportMonksService();
    const matches = await sportMonks.getLivescores();
    
    if (!matches || matches.length === 0) return [];

    return matches.map(m => ({
      id: m.id || String(Math.random()),
      home: m.home_team || m.home || 'Unknown',
      away: m.away_team || m.away || 'Unknown',
      homeScore: m.homeScore !== undefined ? m.homeScore : m.score?.home,
      awayScore: m.awayScore !== undefined ? m.awayScore : m.score?.away,
      time: m.time || m.status || 'LIVE',
      league: m.league || 'Unknown League',
      homeOdds: m.homeOdds || '1.95',
      drawOdds: m.drawOdds || '3.60',
      awayOdds: m.awayOdds || '4.10',
      prediction: m.prediction || '50/50',
      provider: 'SportMonks'
    }));
  } catch (e) {
    logger.warn('getLiveMatches error', e?.message);
    return [];
  }
}

/**
 * Handle /start command - show main menu
 */
export async function handleStart(chatId, _services = {}) {
  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: completeMenus.mainMenu.text,
    reply_markup: completeMenus.mainMenu.reply_markup,
    parse_mode: 'Markdown'
  };
}

/**
 * Handle /menu command - show main menu
 */
export async function handleMenu(chatId, _services = {}) {
  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: completeMenus.mainMenu.text,
    reply_markup: completeMenus.mainMenu.reply_markup,
    parse_mode: 'Markdown'
  };
}

/**
 * Handle /live command - show sports selector or live games
 */
export async function handleLive(chatId, sport = null, services = {}) {
  if (!sport) {
    return {
      method: 'sendMessage',
      chat_id: chatId,
      text: completeMenus.sportsMenu.text,
      reply_markup: completeMenus.sportsMenu.reply_markup,
      parse_mode: 'Markdown'
    };
  }

  const matches = await getLiveMatches(services, sport);
  const menu = completeMenus.buildLiveGamesMenu(matches, sport, 1);

  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: menu.text,
    reply_markup: menu.reply_markup,
    parse_mode: 'Markdown'
  };
}

/**
 * Handle callback queries for all menu interactions
 */
export async function handleCallbackQuery(cq, redis, services) {
  try {
    const data = cq.data || '';
    const chatId = cq.message?.chat?.id;
    const messageId = cq.message?.message_id;

    if (!chatId || !messageId) {
      return {
        method: 'answerCallbackQuery',
        callback_query_id: cq.id,
        text: '❌ Error: Invalid message',
        show_alert: true
      };
    }

    logger.info(`Callback: ${data}`);

    // ========================================================================
    // MAIN MENU
    // ========================================================================

    if (data === 'menu_main') {
      return {
        method: 'editMessageText',
        chat_id: chatId,
        message_id: messageId,
        text: completeMenus.mainMenu.text,
        reply_markup: completeMenus.mainMenu.reply_markup,
        parse_mode: 'Markdown'
      };
    }

    // ========================================================================
    // LIVE GAMES
    // ========================================================================

    if (data === 'live_games') {
      return {
        method: 'editMessageText',
        chat_id: chatId,
        message_id: messageId,
        text: completeMenus.sportsMenu.text,
        reply_markup: completeMenus.sportsMenu.reply_markup,
        parse_mode: 'Markdown'
      };
    }

    // Sport selection
    if (data.startsWith('sport:')) {
      const sport = data.split(':')[1];
      const matches = await getLiveMatches(services, sport);
      const menu = completeMenus.buildLiveGamesMenu(matches, sport, 1);

      return {
        method: 'editMessageText',
        chat_id: chatId,
        message_id: messageId,
        text: menu.text,
        reply_markup: menu.reply_markup,
        parse_mode: 'Markdown'
      };
    }

    // Live pagination
    if (data.startsWith('live:')) {
      const parts = data.split(':');
      const sport = parts[1];
      const page = parseInt(parts[2], 10) || 1;
      const matches = await getLiveMatches(services, sport);
      const menu = completeMenus.buildLiveGamesMenu(matches, sport, page);

      return {
        method: 'editMessageText',
        chat_id: chatId,
        message_id: messageId,
        text: menu.text,
        reply_markup: menu.reply_markup,
        parse_mode: 'Markdown'
      };
    }

    // Match details
    if (data.startsWith('match:')) {
      const parts = data.split(':');
      const matchId = parts[1];
      // Fetch match details from SportMonks
      const matches = await getLiveMatches(services, 'football');
      const match = matches.find(m => String(m.id) === matchId) || matches[0] || {};
      const menu = completeMenus.buildMatchDetailsMenu(match);

      return {
        method: 'editMessageText',
        chat_id: chatId,
        message_id: messageId,
        text: menu.text,
        reply_markup: menu.reply_markup,
        parse_mode: 'Markdown'
      };
    }

    // ========================================================================
    // ODDS & ANALYSIS
    // ========================================================================

    if (data === 'odds_analysis') {
      const matches = await getLiveMatches(services, 'football');
      const menu = completeMenus.buildOddsMenu(matches);

      return {
        method: 'editMessageText',
        chat_id: chatId,
        message_id: messageId,
        text: menu.text,
        reply_markup: menu.reply_markup,
        parse_mode: 'Markdown'
      };
    }

    if (data.startsWith('odds:')) {
      const matchId = data.split(':')[1];
      return {
        method: 'answerCallbackQuery',
        callback_query_id: cq.id,
        text: `📊 Detailed odds analysis for match ${matchId}. Available in VVIP tier.`,
        show_alert: false
      };
    }

    // ========================================================================
    // STANDINGS
    // ========================================================================

    if (data === 'standings') {
      const menu = completeMenus.buildStandingsMenu();

      return {
        method: 'editMessageText',
        chat_id: chatId,
        message_id: messageId,
        text: menu.text,
        reply_markup: menu.reply_markup,
        parse_mode: 'Markdown'
      };
    }

    if (data.startsWith('standings:')) {
      const league = data.split(':')[1];
      return {
        method: 'answerCallbackQuery',
        callback_query_id: cq.id,
        text: `🏆 ${league.toUpperCase()} standings. Coming soon!`,
        show_alert: false
      };
    }

    // ========================================================================
    // NEWS
    // ========================================================================

    if (data === 'news') {
      const menu = completeMenus.buildNewsMenu();

      return {
        method: 'editMessageText',
        chat_id: chatId,
        message_id: messageId,
        text: menu.text,
        reply_markup: menu.reply_markup,
        parse_mode: 'Markdown'
      };
    }

    // ========================================================================
    // FIXTURES / UPCOMING
    // ========================================================================

    if (data === 'menu_fixtures') {
      // use sportsAggregator to fetch upcoming fixtures
      let fixtures = [];
      try {
        if (services && services.sportsAggregator) {
          fixtures = await services.sportsAggregator.getFixtures().catch(() => []);
        }
      } catch (e) {
        logger.warn('Failed to fetch fixtures from aggregator', e?.message);
      }

      if (!fixtures || fixtures.length === 0) {
        return {
          method: 'editMessageText',
          chat_id: chatId,
          message_id: messageId,
          text: `📅 *Upcoming Fixtures*\n\nNo upcoming fixtures available at the moment.`,
          reply_markup: { inline_keyboard: [[{ text: '🏟 See Live Matches', callback_data: 'live_games' }, { text: '🔙 Back', callback_data: 'menu_main' }]] },
          parse_mode: 'Markdown'
        };
      }

      // Group by competition (use readable competition name).
      // Attempt to resolve numeric/ID-only competition values to a human name
      // using available fixture fields (competition.name, competition_name, leagueName, etc.).
      const groups = {};

      // Try to fetch a leagues index once to map numeric ids to names
      let leaguesIndex = null;
      try {
        if (services && services.sportsAggregator && typeof services.sportsAggregator.getLeagues === 'function') {
          const rawLeagues = await services.sportsAggregator.getLeagues().catch(() => null);
          if (Array.isArray(rawLeagues)) {
            leaguesIndex = {};
            rawLeagues.forEach(l => {
              if (!l) return;
              const id = l.id || l.league_id || l.leagueId || null;
              const name = (l.name || l.title || l.fullName || l.competition_name || l.leagueName || l.displayName || l.long_name);
              if (id != null) leaguesIndex[String(id)] = name || String(id);
            });
          }
        }
      } catch (e) { /* ignore */ }

      for (const f of fixtures) {
        const compObj = f.competition || f.league || null;

        const possibleName = (compObj && typeof compObj === 'object')
          ? (compObj.name || compObj.title || compObj.fullName || compObj.competition_name)
          : (f.competition_name || f.leagueName || f.competitionName || f.competitionTitle || compObj);

        let compName = safeName(possibleName || compObj || 'Other', 'Other');

        // If compName is just a numeric id (e.g. '8'), try to resolve via leaguesIndex or fixture labels
        if (/^\d+$/.test(String(compName).trim())) {
          const compId = String((compObj && (compObj.id || compObj)) || compName);
          if (leaguesIndex && leaguesIndex[compId]) {
            compName = leaguesIndex[compId];
          } else {
            const alt = f.competition && f.competition.name ? String(f.competition.name) : (f.leagueName || f.competition_name || f.competitionTitle || null);
            if (alt) compName = alt;
          }
        }

        groups[compName] = groups[compName] || [];
        groups[compName].push(f);
      }

      // Format date range for display
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const dateStr = now.toLocaleDateString();
      const tomorrowStr = tomorrow.toLocaleDateString();

      // Build simple text and keyboard where each fixture gets a button
      let text = `📅 *Upcoming Fixtures (${dateStr} - ${tomorrowStr})*\n\n`;
      const keyboard = [];
      Object.keys(groups).slice(0, 10).forEach(comp => {
        text += `🏆 *${comp}*\n`;
        groups[comp].slice(0, 8).forEach(f => {
          let home = safeName(f.home || f.homeTeam || (f.raw && f.raw.homeTeam) || (f.teams && f.teams.home) || f.homeName, 'Home');
          let away = safeName(f.away || f.awayTeam || (f.raw && f.raw.awayTeam) || (f.teams && f.teams.away) || f.awayName, 'Away');
          // Defensive normalization: avoid literal 'undefined' or empty strings
          if (!home || home === 'undefined') home = 'TBA';
          if (!away || away === 'undefined') away = 'TBA';
          let kickoff = 'TBA';
          try {
            // Normalize various common kickoff/date fields and handle unix seconds vs ms
            const tsCandidates = [f.kickoff, f.utcDate, f.kickoff_at, f.utc_date, f.date, f.time, f.starting_at, f.starting_at_timestamp, f.timestamp, f.ts];
            let d = null;
            for (const c of tsCandidates) {
              if (!c) continue;
              // If it's a number, it may be seconds; convert to ms when needed
              if (typeof c === 'number') {
                d = new Date(c < 1e12 ? c * 1000 : c);
              } else if (typeof c === 'string') {
                // numeric strings
                if (/^\d{10}$/.test(c)) d = new Date(Number(c) * 1000);
                else if (/^\d{13}$/.test(c)) d = new Date(Number(c));
                else d = new Date(c);
              }
              if (d && !isNaN(d.getTime())) break;
            }
            if (d && !isNaN(d.getTime())) kickoff = d.toLocaleString();
            else if (f.time) kickoff = String(f.time);
          } catch (e) { kickoff = 'TBA'; }

          text += `• ${home} vs ${away} — ${kickoff}\n`;
          keyboard.push([{ text: `${home} vs ${away}`, callback_data: `fixture:${f.id}` }]);
        });
        text += `\n`;
      });

      // Add a 'Show All' button to allow users to receive all fixtures (paginated)
      keyboard.push([
        { text: `📋 Show All (${fixtures.length})`, callback_data: 'fixtures_all' },
        { text: '🔙 Back', callback_data: 'menu_main' }
      ]);

      return {
        method: 'editMessageText',
        chat_id: chatId,
        message_id: messageId,
        text,
        reply_markup: { inline_keyboard: keyboard },
        parse_mode: 'Markdown'
      };
    }

    if (data.startsWith('fixture:')) {
      const fixtureId = data.split(':')[1];
      const fixtures = (services && services.sportsAggregator) ? await services.sportsAggregator.getFixtures() : [];
      const fixture = fixtures.find(f => String(f.id) === String(fixtureId));
      if (!fixture) {
        return { method: 'answerCallbackQuery', callback_query_id: cq.id, text: '⚠️ Fixture not found', show_alert: false };
      }
      const home = safeName(fixture.home || fixture.homeTeam || fixture.homeName, 'Home');
      const away = safeName(fixture.away || fixture.awayTeam || fixture.awayName, 'Away');
      const kickoff = (fixture.kickoff || fixture.time || fixture.utcDate) ? (fixture.kickoff ? new Date(fixture.kickoff).toLocaleString() : String(fixture.time || fixture.utcDate)) : 'TBA';
      const comp = safeName(fixture.competition || fixture.league, 'N/A');
      const text = `*Fixture: ${home} vs ${away}*\nKickoff: ${kickoff}\nCompetition: ${comp}\nVenue: ${fixture.venue || 'TBA'}\nStatus: ${fixture.status || 'SCHEDULED'}\nProvider: ${fixture.provider || 'Football-Data.org'}`;
      return {
        method: 'editMessageText',
        chat_id: chatId,
        message_id: messageId,
        text,
        reply_markup: { inline_keyboard: [[{ text: '🔎 Analyse Fixture', callback_data: `analyseFixture:${fixture.id}` }, { text: '🔙 Back', callback_data: 'menu_fixtures' }]] },
        parse_mode: 'Markdown'
      };
    }

    if (data.startsWith('analyseFixture:')) {
      const fixtureId = data.split(':')[1];
      // For now reuse fixture details and provide placeholder analysis
      try {
        const fixtures = (services && services.sportsAggregator) ? await services.sportsAggregator.getFixtures() : [];
        const fixture = fixtures.find(f => String(f.id) === String(fixtureId));
        if (!fixture) {
          return { method: 'answerCallbackQuery', callback_query_id: cq.id, text: '⚠️ Fixture not found for analysis', show_alert: false };
        }

        const home = safeName(fixture.home || fixture.homeTeam || fixture.homeName, 'Home');
        const away = safeName(fixture.away || fixture.awayTeam || fixture.awayName, 'Away');
        const leagueId = (fixture.competition && fixture.competition.id) || fixture.league || fixture.competition || null;

        // Prefer AI-based analysis if available
        try {
          const matchData = Object.assign({}, fixture, { home, away, leagueId });

          if (services && services.ai && typeof services.ai.analyzeSport === 'function' && (typeof services.ai.isHealthy !== 'function' || services.ai.isHealthy())) {
            let aiResult = null;
            try {
              aiResult = await services.ai.analyzeSport('football', matchData, 'Provide a short Telegram-friendly analysis, prediction and key stats.');
            } catch (errAi) {
              logger.warn('AI analyzeSport failed, falling back to odds analyzer', errAi?.message || errAi);
              aiResult = null;
            }

            if (aiResult) {
              let text = '';
              if (typeof aiResult === 'string') text = aiResult;
              else if (aiResult && typeof aiResult === 'object') {
                if (typeof aiResult.text === 'string') text = aiResult.text;
                else text = JSON.stringify(aiResult, null, 2);
              } else {
                text = String(aiResult);
              }

              // Truncate to avoid Telegram limits, keep Markdown-friendly fallback
              if (text.length > 4000) text = text.slice(0, 4000) + '\n\n...';

              return {
                method: 'editMessageText',
                chat_id: chatId,
                message_id: messageId,
                text,
                reply_markup: { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'menu_fixtures' }]] },
                parse_mode: 'Markdown'
              };
            }
          }

          // If AI not available or returned nothing, fall back to OddsAnalyzer if present
          if (services && services.oddsAnalyzer && typeof services.oddsAnalyzer.analyzeMatch === 'function') {
            const analysis = await services.oddsAnalyzer.analyzeMatch(home, away, leagueId);
            const text = (typeof services.oddsAnalyzer.formatForTelegram === 'function')
              ? services.oddsAnalyzer.formatForTelegram(analysis)
              : (`🔍 Analysis for ${home} vs ${away}\n${JSON.stringify(analysis).slice(0,1500)}`);

            return {
              method: 'editMessageText',
              chat_id: chatId,
              message_id: messageId,
              text,
              reply_markup: { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'menu_fixtures' }]] },
              parse_mode: 'Markdown'
            };
          }

          // Fallback: no analysis service available
          return { method: 'answerCallbackQuery', callback_query_id: cq.id, text: '⚠️ Analysis service not available', show_alert: false };
        } catch (errAnalysis) {
          logger.warn('analyseFixture handler failed', errAnalysis?.message || errAnalysis);
          return { method: 'answerCallbackQuery', callback_query_id: cq.id, text: '⚠️ Analysis failed', show_alert: false };
        }
      } catch (e) {
        logger.warn('analyseFixture handler failed', e?.message || e);
        return { method: 'answerCallbackQuery', callback_query_id: cq.id, text: '⚠️ Analysis failed', show_alert: false };
      }
    }

    // Send all fixtures in paginated messages (callback triggered by 'Show All')
    if (data === 'fixtures_all') {
      try {
        const fixtures = (services && services.sportsAggregator) ? await services.sportsAggregator.getFixtures() : [];
        if (!fixtures || fixtures.length === 0) {
          return { method: 'answerCallbackQuery', callback_query_id: cq.id, text: 'No fixtures available', show_alert: false };
        }

        // Build pages of up to 25 fixtures per message to avoid Telegram limits
        const pageSize = 25;
        const actions = [];
        for (let p = 0; p < Math.ceil(fixtures.length / pageSize); p++) {
          const slice = fixtures.slice(p * pageSize, (p + 1) * pageSize);
          let text = `📅 *Upcoming Fixtures (page ${p + 1} of ${Math.ceil(fixtures.length / pageSize)})*\n\n`;
          slice.forEach(f => {
            const home = safeName(f.home || f.homeTeam || f.homeName, 'TBA');
            const away = safeName(f.away || f.awayTeam || f.awayName, 'TBA');

            // derive kickoff similar to menu formatting
            let kickoff = 'TBA';
            try {
              const tsCandidates = [f.kickoff, f.utcDate, f.kickoff_at, f.utc_date, f.date, f.time, f.starting_at, f.starting_at_timestamp, f.timestamp, f.ts];
              let d = null;
              for (const c of tsCandidates) {
                if (!c) continue;
                if (typeof c === 'number') d = new Date(c < 1e12 ? c * 1000 : c);
                else if (typeof c === 'string') {
                  if (/^\d{10}$/.test(c)) d = new Date(Number(c) * 1000);
                  else if (/^\d{13}$/.test(c)) d = new Date(Number(c));
                  else d = new Date(c);
                }
                if (d && !isNaN(d.getTime())) break;
              }
              if (d && !isNaN(d.getTime())) kickoff = d.toLocaleString();
              else if (f.time) kickoff = String(f.time);
            } catch (e) { kickoff = 'TBA'; }

            text += `• ${home} vs ${away} — ${kickoff}\n`;
          });

          // Build inline keyboard so each match on the page can be selected for analysis
          const inline_keyboard = [];
          slice.forEach(f => {
            const home = safeName(f.home || f.homeTeam || f.homeName, 'TBA');
            const away = safeName(f.away || f.awayTeam || f.awayName, 'TBA');
            const shortHome = (home && home.length > 20) ? home.slice(0, 17) + '...' : home;
            const shortAway = (away && away.length > 20) ? away.slice(0, 17) + '...' : away;
            const btnText = `🔎 ${shortHome} v ${shortAway}`;
            inline_keyboard.push([{ text: btnText, callback_data: `analyseFixture:${f.id}` }]);
          });

          // Add a back button at the end of the keyboard for convenience
          inline_keyboard.push([{ text: '🔙 Back', callback_data: 'menu_fixtures' }]);

          actions.push({ method: 'sendMessage', chat_id: chatId, text, reply_markup: { inline_keyboard }, parse_mode: 'Markdown' });
        }

        // Return actions array so the caller will send multiple messages sequentially
        return actions;
      } catch (e) {
        logger.warn('fixtures_all handler failed', e?.message || e);
        return { method: 'answerCallbackQuery', callback_query_id: cq.id, text: 'Failed to send all fixtures', show_alert: false };
      }
    }

    if (data.startsWith('news:')) {
      const category = data.split(':')[1];
      return {
        method: 'answerCallbackQuery',
        callback_query_id: cq.id,
        text: `📰 ${category} news. Loading latest articles...`,
        show_alert: false
      };
    }

    // ========================================================================
    // PROFILE
    // ========================================================================

    if (data === 'profile') {
      const user = { name: 'User', tier: 'FREE', predictions: 0, winRate: '0', points: 0 };
      const menu = completeMenus.buildProfileMenu(user);

      return {
        method: 'editMessageText',
        chat_id: chatId,
        message_id: messageId,
        text: menu.text,
        reply_markup: menu.reply_markup,
        parse_mode: 'Markdown'
      };
    }

    if (data === 'profile:stats') {
      return {
        method: 'answerCallbackQuery',
        callback_query_id: cq.id,
        text: '📊 Your statistics. Feature coming soon!',
        show_alert: false
      };
    }

    if (data === 'profile:bets') {
      return {
        method: 'answerCallbackQuery',
        callback_query_id: cq.id,
        text: '💰 Your betting history. Feature coming soon!',
        show_alert: false
      };
    }

    if (data === 'profile:settings') {
      return {
        method: 'answerCallbackQuery',
        callback_query_id: cq.id,
        text: '⚙️ Settings. Coming soon!',
        show_alert: false
      };
    }

    if (data === 'profile:referrals') {
      return {
        method: 'answerCallbackQuery',
        callback_query_id: cq.id,
        text: '🎁 Referral rewards. Coming soon!',
        show_alert: false
      };
    }

    if (data === 'profile:history') {
      return {
        method: 'answerCallbackQuery',
        callback_query_id: cq.id,
        text: '📊 Betting history. Coming soon!',
        show_alert: false
      };
    }

    // ========================================================================
    // FAVORITES
    // ========================================================================

    if (data === 'favorites') {
      const menu = completeMenus.buildFavoritesMenu([]);

      return {
        method: 'editMessageText',
        chat_id: chatId,
        message_id: messageId,
        text: menu.text,
        reply_markup: menu.reply_markup,
        parse_mode: 'Markdown'
      };
    }

    if (data === 'favorites:add') {
      return {
        method: 'answerCallbackQuery',
        callback_query_id: cq.id,
        text: '➕ Search and add your favorite teams',
        show_alert: false
      };
    }

    if (data === 'favorites:remove') {
      return {
        method: 'answerCallbackQuery',
        callback_query_id: cq.id,
        text: '❌ Select a favorite to remove',
        show_alert: false
      };
    }

    // ========================================================================
    // SUBSCRIPTION & PAYMENT
    // ========================================================================

    if (data === 'subscription') {
      const menu = completeMenus.buildSubscriptionMenu();

      return {
        method: 'editMessageText',
        chat_id: chatId,
        message_id: messageId,
        text: menu.text,
        reply_markup: menu.reply_markup,
        parse_mode: 'Markdown'
      };
    }

    // Plan details
    if (data.startsWith('plan:')) {
      const planId = data.split(':')[1];
      const menu = completeMenus.buildPlanDetailsMenu(planId);

      return {
        method: 'editMessageText',
        chat_id: chatId,
        message_id: messageId,
        text: menu.text,
        reply_markup: menu.reply_markup,
        parse_mode: 'Markdown'
      };
    }

    // Fixed odds packs
    if (data.startsWith('pack:')) {
      const packId = data.split(':')[1];
      const pack = completeMenus.FIXED_ODDS_PACKS[packId.toUpperCase()] || {};
      const text = `🌀 *BETRIX* - ${pack.emoji} ${pack.name}\n\n` +
        `💵 Price: *${pack.price}* / ${pack.priceUSD}\n` +
        `📊 Tips Per Month: ${pack.tipsPerMonth}\n\n` +
        `✅ Fixed match predictions with high accuracy.\n` +
        `Ready to subscribe?`;

      return {
        method: 'editMessageText',
        chat_id: chatId,
        message_id: messageId,
        text,
        reply_markup: {
          inline_keyboard: [
            [{ text: `✅ Subscribe ${pack.emoji}`, callback_data: `subscribe:${packId}` }],
            [{ text: '💳 Payment', callback_data: 'payment' }],
            [{ text: '🔙 Back', callback_data: 'subscription' }]
          ]
        },
        parse_mode: 'Markdown'
      };
    }

    // Payment methods menu
    if (data === 'payment') {
      const menu = completeMenus.buildPaymentMenu();

      return {
        method: 'editMessageText',
        chat_id: chatId,
        message_id: messageId,
        text: menu.text,
        reply_markup: menu.reply_markup,
        parse_mode: 'Markdown'
      };
    }

    // Payment method details
    if (data.startsWith('pay:')) {
      const method = data.split(':')[1];
      const menu = completeMenus.buildPaymentDetailsMenu(method);

      return {
        method: 'editMessageText',
        chat_id: chatId,
        message_id: messageId,
        text: menu.text,
        reply_markup: menu.reply_markup,
        parse_mode: 'Markdown'
      };
    }

    // Payment confirmation
    if (data.startsWith('pay_confirm:')) {
      const method = data.split(':')[1];

      // Only handle MPESA/STK confirmation here; other methods are no-ops
      if (method === 'mpesa' || method === 'mpesa_stk' || method === 'lipana') {
        try {
          const userId = cq.from && cq.from.id ? cq.from.id : null;
          const chatId = cq.message && cq.message.chat && cq.message.chat.id ? cq.message.chat.id : null;

          // Attempt to read stored user profile for phone number
          let profile = {};
          try { profile = await redis.hgetall(`user:${userId}:profile`) || {}; } catch (e) { profile = {}; }
          const msisdn = profile && (profile.msisdn || profile.phone || profile.msisdn) ? (profile.msisdn || profile.phone) : null;

          if (!msisdn) {
            return {
              method: 'answerCallbackQuery',
              callback_query_id: cq.id,
              text: '📱 Please send your phone number first (e.g. 2547XXXXXXXX) so we can initiate the STK push.',
              show_alert: true
            };
          }

          const amount = 300; // default amount for quick-deposit flow

          // Create a short-lived payment order (custom amount)
          const order = await createCustomPaymentOrder(redis, userId, amount, 'MPESA');

          // Try to trigger Lipana STK push (best-effort)
          let providerCheckout = null;
          try {
            const callback = process.env.LIPANA_CALLBACK_URL || process.env.MPESA_CALLBACK_URL || process.env.MPESA_CALLBACK_URL || null;
            const resp = await lipana.stkPush({ amount, phone: msisdn, tx_ref: order.orderId, reference: order.orderId, callback_url: callback });
            providerCheckout = resp?.raw?.data?.transactionId || resp?.raw?.data?._id || null;
            if (providerCheckout) {
              // Persist a payments row for reconciliation and audit
              try {
                const connStr = process.env.DATABASE_URL || null;
                if (connStr) {
                  const pool = new Pool({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
                  const insertSql = `INSERT INTO payments(tx_ref, user_id, amount, status, metadata, created_at)
                    VALUES($1,$2,$3,$4,$5, now())`;
                  const metadata = { provider: 'LIPANA', provider_checkout_id: providerCheckout, orderId: order.orderId };
                  await pool.query(insertSql, [order.orderId, order.userId, order.totalAmount || amount, 'pending', JSON.stringify(metadata)]);
                  try { await pool.end(); } catch(e){ void e; }
                }
              } catch (ee) {
                logger.warn('Failed to persist payments row for STK push', ee?.message || String(ee));
              }
              // Store quick lookup mapping so webhook can resolve provider ref -> orderId
              try { await redis.setex(`payment:by_provider_ref:MPESA:${providerCheckout}`, 900, order.orderId); } catch (e) { void e; }
            }
          } catch (e) {
            logger.warn('Lipana STK push failed', e?.message || String(e));
          }

          // Reply to user indicating initiation
          const txRef = order.orderId;
          const replyText = `✅ STK push initiated for KES ${amount}.\nPlease check your phone and enter your M-Pesa PIN.\nTransaction ID: ${txRef}` + (providerCheckout ? `\nProvider checkout: ${providerCheckout}` : '');

          return {
            method: 'editMessageText',
            chat_id: chatId,
            message_id: cq.message.message_id,
            text: replyText,
            reply_markup: { inline_keyboard: [[{ text: '🔁 Retry payment', callback_data: 'pay:retry' }, { text: '❌ Cancel payment', callback_data: 'pay:cancel' }]] },
            parse_mode: 'Markdown'
          };
        } catch (err) {
          logger.warn('pay_confirm:mpesa handler failed', err?.message || String(err));
          return {
            method: 'answerCallbackQuery',
            callback_query_id: cq.id,
            text: '❌ Failed to initiate payment. Please try again later.',
            show_alert: true
          };
        }
      }

      return {
        method: 'answerCallbackQuery',
        callback_query_id: cq.id,
        text: `💳 Proceeding with ${method.toUpperCase()} payment...`,
        show_alert: false
      };
    }

    // Subscribe
    if (data.startsWith('subscribe:')) {
      const plan = data.split(':')[1];
      return {
        method: 'answerCallbackQuery',
        callback_query_id: cq.id,
        text: `✅ You selected ${plan}. Choose a payment method to proceed.`,
        show_alert: false
      };
    }

    // ========================================================================
    // HELP
    // ========================================================================

    if (data === 'help') {
      const menu = completeMenus.buildHelpMenu();

      return {
        method: 'editMessageText',
        chat_id: chatId,
        message_id: messageId,
        text: menu.text,
        reply_markup: menu.reply_markup,
        parse_mode: 'Markdown'
      };
    }

    if (data === 'help:faq') {
      const text = `🌀 *BETRIX* - FAQ\n\n` +
        `*Q: How do I get started?*\n` +
        `A: Tap ⚽ Live Games to see current matches.\n\n` +
        `*Q: What's included in VVIP?*\n` +
        `A: Unlimited AI analysis, real-time alerts, advanced predictions.\n\n` +
        `*Q: How do I pay?*\n` +
        `A: We accept Till, M-Pesa, PayPal, Binance, and Bank Transfer.\n\n` +
        `*Q: Can I cancel anytime?*\n` +
        `A: Yes, cancel in Settings with no penalties.`;

      return {
        method: 'editMessageText',
        chat_id: chatId,
        message_id: messageId,
        text,
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Back', callback_data: 'help' }]
          ]
        },
        parse_mode: 'Markdown'
      };
    }

    if (data === 'help:tutorial') {
      const text = `🌀 *BETRIX* - How to Use\n\n` +
        `1️⃣ *View Live Games* → Tap ⚽ Live Games\n` +
        `2️⃣ *Check Odds* → Tap 📊 Odds & Analysis\n` +
        `3️⃣ *League Standings* → Tap 🏆 Standings\n` +
        `4️⃣ *Latest News* → Tap 📰 News\n` +
        `5️⃣ *Subscribe* → Tap 👑 Subscribe for premium\n\n` +
        `💡 Tip: Use /live, /odds, /standings commands for quick access.`;

      return {
        method: 'editMessageText',
        chat_id: chatId,
        message_id: messageId,
        text,
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Back', callback_data: 'help' }]
          ]
        },
        parse_mode: 'Markdown'
      };
    }

    if (data === 'help:billing') {
      return {
        method: 'answerCallbackQuery',
        callback_query_id: cq.id,
        text: '💰 Billing support. Contact: support@betrix.app',
        show_alert: false
      };
    }

    if (data === 'help:contact') {
      return {
        method: 'answerCallbackQuery',
        callback_query_id: cq.id,
        text: '📧 Email: support@betrix.app\n💬 Live chat available 24/7',
        show_alert: true
      };
    }

    // ========================================================================
    // FALLBACK
    // ========================================================================

    return {
      method: 'answerCallbackQuery',
      callback_query_id: cq.id,
      text: `Unknown action: ${data}`,
      show_alert: false
    };
  } catch (e) {
    logger.warn('handleCallbackQuery error', e?.message);
    return {
      method: 'answerCallbackQuery',
      callback_query_id: cq.id,
      text: '❌ Error processing action',
      show_alert: true
    };
  }
}

/**
 * Export handlers for use in worker
 */
export default {
  handleStart,
  handleMenu,
  handleLive,
  handleCallbackQuery
};
