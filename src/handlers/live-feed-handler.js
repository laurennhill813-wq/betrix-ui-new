/**
 * Live Feed Command Handler
 * Handles Telegram commands for live matches, fixtures, and sports updates
 * Uses SportMonks API with proper data formatting
 */

import { Logger } from "../utils/logger.js";
import { MatchFormatter } from "../utils/match-formatter.js";
import UserService from "../services/user.js";
import { getUpcomingFixtures, getTeams, sportEmoji } from "../services/sportradar-client.js";

const logger = new Logger("LiveFeedHandler");

export class LiveFeedHandler {
  constructor(bot, sportsAggregator, redis) {
    this.bot = bot;
    this.aggregator = sportsAggregator;
    this.redis = redis;
    this.userSvc = new UserService(redis);
  }

  /**
   * Handle /live command - show all live matches
   */
  async handleLiveCommand(msg) {
    const chatId = msg.chat.id;

    try {
      logger.info(`/live command from ${chatId}`);

      // Get all live matches
      const matches = await this.aggregator.getAllLiveMatches();

      if (!matches || matches.length === 0) {
        return await this.bot.sendMessage(
          chatId,
          "🌀 No live matches at this moment.\n\n" +
            "Check /fixtures for upcoming games or /subscribe for live updates!",
          { parse_mode: "HTML" },
        );
      }

      const message = MatchFormatter.formatLiveMatches(matches);

      // Send with keyboard
      await this.bot.sendMessage(chatId, message, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔄 Refresh", callback_data: "cmd_live_refresh" }],
            [{ text: "📅 Fixtures", callback_data: "cmd_fixtures" }],
            [{ text: "📊 Summary", callback_data: "cmd_summary" }],
          ],
        },
      });
    } catch (e) {
      logger.error("handleLiveCommand error:", e.message);
      await this.bot.sendMessage(
        chatId,
        "❌ Error fetching live matches. Please try again.",
        { parse_mode: "HTML" },
      );
    }
  }

  /**
   * Handle /fixtures command - show upcoming fixtures
   */
  async handleFixturesCommand(msg) {
    const chatId = msg.chat.id;

    try {
      logger.info(`/fixtures command from ${chatId}`);
      // Parse optional sport argument: /fixtures <sport>
      const args = String(msg.text || "").split(" ").slice(1).filter(Boolean);
      const sport = (args[0] || "football").toLowerCase();

      // Check user access state
      const userId = msg.from?.id || chatId;
      const isActive = await this.userSvc.isActive(userId).catch(() => false);
      if (!isActive) {
        return await this.bot.sendMessage(
          chatId,
          "🔒 This feature is for active users. Please complete signup or payment to unlock. Type /signup or /pay.",
          { parse_mode: "HTML" },
        );
      }

      let fixtures = [];
      if (!sport || sport === "football" || sport === "soccer") {
        fixtures = await this.aggregator.getFixtures();
      } else {
        // Use aggregator multi-sport endpoint when available, else fallback to Sportradar client
        try {
          fixtures =
            typeof this.aggregator.getUpcomingBySport === "function"
              ? await this.aggregator.getUpcomingBySport(sport)
              : await getUpcomingFixtures(sport);
        } catch (e) {
          fixtures = await getUpcomingFixtures(sport);
        }
      }

      if (!fixtures || fixtures.length === 0) {
        return await this.bot.sendMessage(
          chatId,
          `${sportEmoji(sport)} No upcoming fixtures available for ${sport.toUpperCase()}.`,
          { parse_mode: "HTML" },
        );
      }

      // Normalize and format simple list for multi-sport output
      const lines = fixtures.slice(0, 20).map((f) => {
        const home = f.home || f.teams?.home?.name || "Home";
        const away = f.away || f.teams?.away?.name || "Away";
        const dt = f.startTime ? new Date(f.startTime).toLocaleString() : f.start_time || "TBD";
        return `${sportEmoji(sport)} ${home} vs ${away} — ${dt}`;
      });

      const message = `📅 Upcoming ${sport.toUpperCase()} fixtures:\n\n${lines.join("\n")}`;

      await this.bot.sendMessage(chatId, message, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔄 Refresh", callback_data: "cmd_fixtures_refresh" }],
            [{ text: "🔴 Live Now", callback_data: "cmd_live" }],
            [{ text: "📊 Summary", callback_data: "cmd_summary" }],
          ],
        },
      });
    } catch (e) {
      logger.error("handleFixturesCommand error:", e.message);
      await this.bot.sendMessage(
        chatId,
        "❌ Error fetching fixtures. Please try again.",
        { parse_mode: "HTML" },
      );
    }
  }

  /**
   * /teams <sport> - list real teams for a sport
   */
  async handleTeamsCommand(msg) {
    const chatId = msg.chat.id;
    try {
      const args = String(msg.text || "").split(" ").slice(1).filter(Boolean);
      const sport = (args[0] || "football").toLowerCase();

      // Access check
      const userId = msg.from?.id || chatId;
      const isActive = await this.userSvc.isActive(userId).catch(() => false);
      if (!isActive) {
        return await this.bot.sendMessage(
          chatId,
          "🔒 This feature is for active users. Please complete signup or payment to unlock. Type /signup or /pay.",
          { parse_mode: "HTML" },
        );
      }

      let teams = [];
      try {
        teams = await getTeams(sport);
      } catch (e) {
        teams = [];
      }

      if (!teams || teams.length === 0) {
        return await this.bot.sendMessage(chatId, `${sportEmoji(sport)} No teams found for ${sport.toUpperCase()}.`, { parse_mode: "HTML" });
      }

      const names = teams.slice(0, 50).map((t) => `• ${t.name || t.display_name || t.title}`);
      const message = `${sportEmoji(sport)} Teams (${names.length} shown):\n\n${names.join("\n")}`;
      await this.bot.sendMessage(chatId, message, { parse_mode: "HTML" });
    } catch (e) {
      logger.error("handleTeamsCommand error:", e?.message || String(e));
      await this.bot.sendMessage(chatId, "❌ Error fetching teams.", { parse_mode: "HTML" });
    }
  }

  /**
   * Handle /standings command - show league standings
   */
  async handleStandingsCommand(msg) {
    const chatId = msg.chat.id;
    const args = msg.text.split(" ").slice(1);
    const leagueId = args[0] || 39; // Default to Premier League

    try {
      logger.info(`/standings command from ${chatId} for league ${leagueId}`);

      const standings = await this.aggregator.getStandings(leagueId);

      if (!standings || standings.length === 0) {
        return await this.bot.sendMessage(
          chatId,
          "📋 No standings available for this league.",
          { parse_mode: "HTML" },
        );
      }

      const message = MatchFormatter.formatStandings(standings);

      await this.bot.sendMessage(chatId, message, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🔄 Refresh",
                callback_data: `cmd_standings_${leagueId}`,
              },
            ],
            [{ text: "🔴 Live", callback_data: "cmd_live" }],
            [{ text: "📅 Fixtures", callback_data: "cmd_fixtures" }],
          ],
        },
      });
    } catch (e) {
      logger.error("handleStandingsCommand error:", e.message);
      await this.bot.sendMessage(
        chatId,
        "❌ Error fetching standings. Please try again.",
        { parse_mode: "HTML" },
      );
    }
  }

  /**
   * Handle /summary command - show overall feed summary
   */
  async handleSummaryCommand(msg) {
    const chatId = msg.chat.id;

    try {
      logger.info(`/summary command from ${chatId}`);

      // Get all data
      const [liveMatches, fixtures, standings] = await Promise.all([
        this.aggregator.getAllLiveMatches(),
        this.aggregator.getFixtures(),
        this.aggregator.getStandings(39),
      ]);
      void standings;

      // Count by status
      const live = (liveMatches || []).filter(
        (m) => m.status === "LIVE",
      ).length;
      const upcoming = (fixtures || []).filter(
        (f) => f.status === "SCHEDULED",
      ).length;
      const finished = (liveMatches || []).filter(
        (m) => m.status === "FINISHED",
      ).length;

      const message =
        MatchFormatter.formatSummary(live, upcoming, finished) +
        "\n\n📊 Data from SportMonks & Football-Data";

      await this.bot.sendMessage(chatId, message, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔴 Live Matches", callback_data: "cmd_live" }],
            [{ text: "📅 Fixtures", callback_data: "cmd_fixtures" }],
            [{ text: "📋 Standings", callback_data: "cmd_standings_39" }],
          ],
        },
      });
    } catch (e) {
      logger.error("handleSummaryCommand error:", e.message);
      await this.bot.sendMessage(
        chatId,
        "❌ Error fetching summary. Please try again.",
        { parse_mode: "HTML" },
      );
    }
  }

  /**
   * Handle match detail request
   */
  async handleMatchDetail(msg, matchId) {
    const chatId = msg.chat.id;

    try {
      const match = await this.aggregator.getMatchById(matchId, "football");

      if (!match) {
        return await this.bot.sendMessage(chatId, "❌ Match not found.", {
          parse_mode: "HTML",
        });
      }

      const detail =
        `<b>${match.home}</b> ${match.homeScore || "?"} - ${match.awayScore || "?"} <b>${match.away}</b>\n\n` +
        `Status: <b>${match.status}</b>\n` +
        `Time: ${match.time}\n` +
        `League: ${match.league}\n` +
        `Venue: ${match.venue}`;

      await this.bot.sendMessage(chatId, detail, {
        parse_mode: "HTML",
        reply_markup: MatchFormatter.getMatchKeyboard(match),
      });
    } catch (e) {
      logger.error("handleMatchDetail error:", e.message);
      await this.bot.sendMessage(chatId, "❌ Error loading match details.", {
        parse_mode: "HTML",
      });
    }
  }

  /**
   * Handle callback queries for inline buttons
   */
  async handleCallback(query) {
    const chatId = query.message.chat.id;
    const data = query.data;

    try {
      if (data === "cmd_live_refresh") {
        await this.bot.editMessageText("⏳ Loading live matches...", {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: "HTML",
        });
        await this.handleLiveCommand({ chat: { id: chatId }, text: "/live" });
      } else if (data === "cmd_fixtures_refresh") {
        await this.handleFixturesCommand({
          chat: { id: chatId },
          text: "/fixtures",
        });
      } else if (data === "cmd_live") {
        await this.handleLiveCommand({ chat: { id: chatId }, text: "/live" });
      } else if (data === "cmd_fixtures") {
        await this.handleFixturesCommand({
          chat: { id: chatId },
          text: "/fixtures",
        });
      } else if (data === "cmd_summary") {
        await this.handleSummaryCommand({
          chat: { id: chatId },
          text: "/summary",
        });
      } else if (data.startsWith("cmd_standings_")) {
        const leagueId = data.split("_")[2];
        await this.handleStandingsCommand({
          chat: { id: chatId },
          text: `/standings ${leagueId}`,
        });
      }

      // Answer callback query
      await this.bot.answerCallbackQuery(query.id);
    } catch (e) {
      logger.error("handleCallback error:", e.message);
      await this.bot.answerCallbackQuery(query.id, {
        text: "❌ Error processing request",
        show_alert: true,
      });
    }
  }

  /**
   * Register all command handlers with the bot
   */
  registerHandlers() {
    this.bot.onText(/^\/live(\s|$)/, (msg) => this.handleLiveCommand(msg));
    this.bot.onText(/^\/fixtures(\s|$)/, (msg) =>
      this.handleFixturesCommand(msg),
    );
    this.bot.onText(/^\/teams(\s|$)/, (msg) => this.handleTeamsCommand(msg));
    this.bot.onText(/^\/standings(\s|$)/, (msg) =>
      this.handleStandingsCommand(msg),
    );
    this.bot.onText(/^\/summary(\s|$)/, (msg) =>
      this.handleSummaryCommand(msg),
    );

    this.bot.on("callback_query", (query) => this.handleCallback(query));

    logger.info("✅ Live feed command handlers registered");
  }
}

export default LiveFeedHandler;
