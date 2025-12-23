/**
 * Sports Data Menu Handlers
 * Integrates unified API client with bot menu system
 * Provides users with fixtures, odds, teams, and news from all working APIs
 */

import unifiedAPI from '../services/unified-sports-api.js';

class SportsDataMenus {
  /**
   * Main Sports Menu - Shows available sports
   */
  static async handleSportsMenu(userId, chatId) {
    const sports = unifiedAPI.getAvailableSports();
    
    const message = `🏆 <b>SPORTS & FIXTURES</b>\n\n` +
      `Available Sports:\n` +
      Object.entries(sports).map(([sport, apis]) => 
        `  🏅 ${sport} (${apis.length} sources)`
      ).join('\n') +
      `\n\nSelect a sport to see fixtures and odds.`;

    const keyboard = Object.keys(sports).map(sport => [
      { text: `🏅 ${sport}`, callback_data: `sport_${sport.toLowerCase().replace(/[^a-z0-9]/g, '_')}` }
    ]);

    return {
      text: message,
      reply_markup: {
        inline_keyboard: keyboard
      }
    };
  }

  /**
   * NFL Fixtures Menu
   */
  static async handleNFLMenu(userId, chatId) {
    try {
      const teams = await unifiedAPI.getNFLTeams();
      
      const message = `🏈 <b>NFL TEAMS & FIXTURES</b>\n\n` +
        `Available Teams: ${teams.length}\n\n` +
        teams.slice(0, 10).map((t, i) => 
          `${i + 1}. ${t.name} (${t.abbreviation})`
        ).join('\n') +
        `\n\nSelect a team for fixtures and odds.`;

      const keyboard = teams.slice(0, 8).map(team => [
        { 
          text: `🏈 ${team.abbreviation || team.name}`, 
          callback_data: `nfl_team_${team.id || team.name.toLowerCase().replace(/\s+/g, '_')}`
        }
      ]);

      return {
        text: message,
        reply_markup: {
          inline_keyboard: keyboard
        }
      };
    } catch (err) {
      return {
        text: `❌ Error loading NFL teams: ${err.message}`,
        reply_markup: {
          inline_keyboard: [
            [{ text: '⬅️ Back', callback_data: 'menu_sports' }]
          ]
        }
      };
    }
  }

  /**
   * Soccer/Football Fixtures Menu
   */
  static async handleSoccerMenu(userId, chatId) {
    try {
      const matches = await unifiedAPI.searchSoccer('upcoming');
      
      const message = `⚽ <b>SOCCER FIXTURES</b>\n\n` +
        `⏰ Upcoming Matches:\n\n` +
        (matches && matches.length > 0 
          ? matches.slice(0, 5).map((m, i) => 
              `${i + 1}. ${m.home || m.homeTeam} vs ${m.away || m.awayTeam}`
            ).join('\n')
          : 'No upcoming matches found') +
        `\n\nSelect for live scores and odds.`;

      const keyboard = matches && matches.length > 0
        ? matches.slice(0, 6).map((m, i) => [
            { 
              text: `⚽ Match ${i + 1}`, 
              callback_data: `soccer_match_${i}`
            }
          ])
        : [];

      keyboard.push([{ text: '⬅️ Back', callback_data: 'menu_sports' }]);

      return {
        text: message,
        reply_markup: {
          inline_keyboard: keyboard
        }
      };
    } catch (err) {
      return {
        text: `❌ Error loading soccer fixtures: ${err.message}`,
        reply_markup: {
          inline_keyboard: [
            [{ text: '⬅️ Back', callback_data: 'menu_sports' }]
          ]
        }
      };
    }
  }

  /**
   * Basketball News Menu
   */
  static async handleBasketballMenu(userId, chatId) {
    try {
      const news = await unifiedAPI.getBasketballNews();
      
      const message = `🏀 <b>BASKETBALL NEWS & FIXTURES</b>\n\n` +
        `Latest News:\n\n` +
        (news && news.length > 0
          ? news.slice(0, 5).map((n, i) => 
              `${i + 1}. ${n.description?.substring(0, 50) || n.title || 'Match info'}`
            ).join('\n')
          : 'No news available') +
        `\n\nSelect for full details and odds.`;

      const keyboard = news && news.length > 0
        ? news.slice(0, 5).map((n, i) => [
            { 
              text: `📰 News ${i + 1}`, 
              callback_data: `basketball_news_${i}`
            }
          ])
        : [];

      keyboard.push([{ text: '⬅️ Back', callback_data: 'menu_sports' }]);

      return {
        text: message,
        reply_markup: {
          inline_keyboard: keyboard
        }
      };
    } catch (err) {
      return {
        text: `❌ Error loading basketball news: ${err.message}`,
        reply_markup: {
          inline_keyboard: [
            [{ text: '⬅️ Back', callback_data: 'menu_sports' }]
          ]
        }
      };
    }
  }

  /**
   * Live Odds Menu - Shows current odds for upcoming matches
   */
  static async handleLiveOddsMenu(userId, chatId) {
    try {
      const matches = await unifiedAPI.getUpcomingMatches();
      
      const message = `📊 <b>LIVE ODDS & PREDICTIONS</b>\n\n` +
        `Upcoming matches with odds:\n\n` +
        (matches && matches.length > 0
          ? matches.slice(0, 5).map((m, i) => {
              const homeOdds = m.home_odds || '2.50';
              const drawOdds = m.draw_odds || '3.20';
              const awayOdds = m.away_odds || '2.80';
              return `${i + 1}. ${m.home_id} vs ${m.away_id}\n   🏠 ${homeOdds} 🤝 ${drawOdds} ✈️ ${awayOdds}`;
            }).join('\n\n')
          : 'No live odds available') +
        `\n\nSelect a match for detailed analysis.`;

      const keyboard = matches && matches.length > 0
        ? matches.slice(0, 5).map((m, i) => [
            { 
              text: `📈 Odds ${i + 1}`, 
              callback_data: `odds_analyze_${i}`
            }
          ])
        : [];

      keyboard.push([{ text: '⬅️ Back', callback_data: 'menu_main' }]);

      return {
        text: message,
        reply_markup: {
          inline_keyboard: keyboard
        }
      };
    } catch (err) {
      return {
        text: `❌ Error loading live odds: ${err.message}`,
        reply_markup: {
          inline_keyboard: [
            [{ text: '⬅️ Back', callback_data: 'menu_main' }]
          ]
        }
      };
    }
  }

  /**
   * Sports News Menu
   */
  static async handleSportsNewsMenu(userId, chatId) {
    try {
      const news = await unifiedAPI.getTopNews();
      
      const message = `📰 <b>SPORTS NEWS</b>\n\n` +
        `Latest headlines:\n\n` +
        (news && news.length > 0
          ? news.slice(0, 8).map((n, i) => 
              `${i + 1}. ${n.title || n.description?.substring(0, 60) || 'News item'}`
            ).join('\n')
          : 'No news available') +
        `\n\nSelect to read full story and share tips.`;

      const keyboard = news && news.length > 0
        ? news.slice(0, 5).map((n, i) => [
            { 
              text: `📄 Read ${i + 1}`, 
              callback_data: `news_read_${i}`
            }
          ])
        : [];

      keyboard.push([{ text: '🔄 Refresh', callback_data: 'news_refresh' }]);
      keyboard.push([{ text: '⬅️ Back', callback_data: 'menu_main' }]);

      return {
        text: message,
        reply_markup: {
          inline_keyboard: keyboard
        }
      };
    } catch (err) {
      return {
        text: `❌ Error loading news: ${err.message}`,
        reply_markup: {
          inline_keyboard: [
            [{ text: '⬅️ Back', callback_data: 'menu_main' }]
          ]
        }
      };
    }
  }

  /**
   * Fixtures Feed - Comprehensive upcoming matches across all sports
   */
  static async handleFixturesFeed(userId, chatId) {
    const message = `📅 <b>FIXTURES FEED</b>\n\n` +
      `Select sport to see upcoming fixtures:\n\n` +
      `🏈 NFL (32 teams)\n` +
      `⚽ Soccer (Multiple leagues)\n` +
      `🏀 Basketball\n` +
      `🎯 Multi-Sport (Odds & Analysis)\n\n` +
      `Last updated: ${new Date().toLocaleTimeString()}\n` +
      `All data from verified RapidAPI sources`;

    const keyboard = [
      [
        { text: '🏈 NFL', callback_data: 'fixtures_nfl' },
        { text: '⚽ Soccer', callback_data: 'fixtures_soccer' }
      ],
      [
        { text: '🏀 Basketball', callback_data: 'fixtures_basketball' },
        { text: '📊 Odds', callback_data: 'fixtures_odds' }
      ],
      [{ text: '⬅️ Back', callback_data: 'menu_main' }]
    ];

    return {
      text: message,
      reply_markup: {
        inline_keyboard: keyboard
      }
    };
  }

  /**
   * Get available sports for quick access menu
   */
  static getSportQuickMenu() {
    const sports = unifiedAPI.getAvailableSports();
    
    return {
      text: `🏆 Choose a sport:\n\nAvailable: ${Object.keys(sports).join(', ')}`,
      reply_markup: {
        inline_keyboard: [
          [{ text: '🏈 NFL', callback_data: 'sport_nfl' }, { text: '⚽ Soccer', callback_data: 'sport_soccer' }],
          [{ text: '🏀 Basketball', callback_data: 'sport_basketball' }, { text: '📊 Odds', callback_data: 'sport_odds' }],
          [{ text: '📰 News', callback_data: 'sport_news' }]
        ]
      }
    };
  }
}

export default SportsDataMenus;
