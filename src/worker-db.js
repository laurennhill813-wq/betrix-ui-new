#!/usr/bin/env node

/**
 * BETRIX Database-Integrated Worker
 * Complete integration with PostgreSQL, Redis, Bull queues
 */

import createRedisAdapter from './utils/redis-adapter.js';
import { getRedisAdapter } from './lib/redis-factory.js';
import { CONFIG, validateConfig } from "./config.js";
import { Logger } from "./utils/logger.js";
import { db } from "./database/db.js";
import { TelegramService } from "./services/telegram.js";
import { UserService } from "./services/user.js";
import { APIFootballService } from "./services/api-football.js";
import { GeminiService } from "./services/gemini.js";
import { BotHandlers } from "./handlers.js";
import { AdvancedHandler } from "./advanced-handler.js";
import { TierAwareHandlers } from "./handlers-tier.js";
import { SubscriptionGatekeeper } from "./middleware/subscription-gatekeeper.js";
import { SafaricomTillService } from "./services/safaricom-till.js";
import { OTPService } from "./services/otp-service.js";
import { ValidationMiddleware } from "./middleware/validation.js";
import { QueueService } from "./services/queue-service.js";
import { TransactionService } from "./services/transaction-service.js";
import { UIBuilder } from "./utils/ui-builder.js";
import { I18n } from "./utils/i18n.js";
import { startServer } from "./server.js";
import { NewFeaturesHandlers } from "./handlers-new-features.js";
import { WebFeaturesHandlers } from "./handlers-web-features.js";
import { BrandingService } from "./services/branding-service.js";

const logger = new Logger("DBWorker");

try {
  validateConfig();
  logger.info("✅ Configuration validated");
} catch (err) {
  logger.error("Configuration failed", err);
  process.exit(1);
}

// Initialize Redis (central adapter)
const redis = getRedisAdapter();
if (redis && typeof redis.on === 'function') {
  redis.on("connect", () => logger.info("✅ Redis connected"));
  redis.on("error", (err) => logger.error("Redis error", err));
} else {
  logger.info('Redis adapter initialized for DB worker');
}
const redisAdapter = typeof createRedisAdapter === 'function' ? createRedisAdapter(redis) : redis;

// Initialize services
const telegram = new TelegramService(CONFIG.TELEGRAM_TOKEN);
const userService = new UserService(redis);
const apiFootball = new APIFootballService(redis);
const gemini = new GeminiService(CONFIG.GEMINI.API_KEY);
const gatekeeper = new SubscriptionGatekeeper(userService, telegram);
const till = new SafaricomTillService(redis, CONFIG);
const otp = new OTPService();
const queue = new QueueService(redis);
const transactions = new TransactionService();

// Handlers
const basicHandlers = new BotHandlers(telegram, userService, apiFootball, gemini, redis);
const advancedHandler = new AdvancedHandler(basicHandlers, redis, telegram, userService, gemini);
const tierHandlers = new TierAwareHandlers(basicHandlers, gatekeeper, userService);
const newFeaturesHandlers = new NewFeaturesHandlers(telegram, userService, gemini);
const webFeaturesHandlers = new WebFeaturesHandlers(telegram);

logger.info("🚀 BETRIX Database Worker - All Services Initialized");
logger.info("✨ Premium Features: /meme, /crypto, /news, /tip");
logger.info("✨ Web Features: /headlines, /reddit, /quote, /fact, /fixtures, /trending_bets");

// Start HTTP server with webhook
startServer(telegram);

async function main() {
  logger.info("🌟 BETRIX Worker started - processing updates");

  while (true) {
    try {
      const update = await redisAdapter.lpop("telegram:updates");
      if (!update) {
        await new Promise((r) => setTimeout(r, 100));
        continue;
      }

      const data = JSON.parse(update);
      await handleUpdate(data);
    } catch (err) {
      logger.error("Worker error", err);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

async function handleUpdate(update) {
  try {
    if (update.message) {
      const { chat, from, text } = update.message;
      const userId = from.id;
      const chatId = chat.id;

      // Get user from database
      const user = await userService.getUser(userId) || {};
      const tier = await gatekeeper.getUserTier(userId);
      const language = user.language || "en";

      // Route command
      const { cmd, args } = parseCommand(text);

      if (cmd === "/start") {
        await startSignup(chatId, userId);
      } else if (cmd === "/verify") {
        await handlePhoneVerification(chatId, userId, args[0]);
      } else if (cmd === "/history") {
        await handleTransactionHistory(chatId, userId);
      } else if (cmd === "/language") {
        await handleLanguageChange(chatId, userId, args[0]);
      } else if (cmd.startsWith("/")) {
        await handleCommand(chatId, userId, cmd, args, tier, language);
      } else {
        // Natural language chat - route to Gemini AI
        await basicHandlers.chat(chatId, userId, text);
      }
    }
  } catch (err) {
    logger.error("Update error", err);
  }
}

function parseCommand(text) {
  const parts = String(text).trim().toLowerCase().split(/\s+/);
  return { cmd: parts[0], args: parts.slice(1) };
}

async function startSignup(chatId, userId) {
  const text = I18n.get("welcome") + "\n\nWhat's your name?";
  await telegram.sendMessage(chatId, text);
  await redisAdapter.setex(`signup:${userId}:state`, 300, "name");
}

async function handlePhoneVerification(chatId, userId, code) {
  const result = await otp.verifyOTP(userId, code);
  if (result.success) {
    await telegram.sendMessage(chatId, "✅ Phone verified!");
  } else {
    await telegram.sendMessage(chatId, `❌ ${result.error}`);
  }
}

async function handleTransactionHistory(chatId, userId) {
  const txns = await transactions.getTransactionHistory(userId);
  let text = "📊 <b>Transaction History</b>\n\n";
  txns.forEach((t, i) => {
    text += `${i + 1}. ${t.amount} - ${t.tier} (${t.status})\n`;
  });
  await telegram.sendMessage(chatId, text);
}

async function handleLanguageChange(chatId, userId, lang) {
  if (I18n.supportedLanguages().includes(lang)) {
    await userService.saveUser(userId, { language: lang });
    await telegram.sendMessage(chatId, `✅ Language changed to ${lang}`);
  } else {
    const langs = I18n.supportedLanguages().join(", ");
    await telegram.sendMessage(chatId, `Available: ${langs}`);
  }
}

async function handleCommand(chatId, userId, cmd, args, tier, language) {
  const commands = {
    // Main Menu
    "/menu": () => newFeaturesHandlers.enhancedMenu(chatId, userId),
    "/help": () => newFeaturesHandlers.enhancedHelp(chatId, userId),
    "/sports": () => newFeaturesHandlers.sportsMenu(chatId, userId),
    "/free": () => newFeaturesHandlers.freeFeaturesMenu(chatId, userId),
    "/premium": () => newFeaturesHandlers.premiumMenu(chatId, userId),
    "/pay": () => basicHandlers.pricing(chatId, userId),
    "/today": () => basicHandlers.todayMatches(chatId),
    "/pricing": () => basicHandlers.pricing(chatId, userId),
    "/status": () => basicHandlers.status(chatId, userId),
    
    // Premium Features (FREE!)
    "/meme": () => newFeaturesHandlers.handleMeme(chatId, userId),
    "/crypto": () => newFeaturesHandlers.handleCrypto(chatId, userId, args[0]),
    "/news": () => newFeaturesHandlers.handleNews(chatId, userId, args[0]),
    "/tip": () => newFeaturesHandlers.handleTip(chatId, userId),
    
    // Web Features (ALL FREE)
    "/headlines": () => webFeaturesHandlers.handleHeadlines(chatId),
    "/reddit": () => webFeaturesHandlers.handleReddit(chatId),
    "/trending": () => webFeaturesHandlers.handleTrending(chatId),
    "/quote": () => webFeaturesHandlers.handleQuote(chatId),
    "/fact": () => webFeaturesHandlers.handleFact(chatId),
    "/betting_fact": () => webFeaturesHandlers.handleBettingFact(chatId),
    "/stadium": () => webFeaturesHandlers.handleStadium(chatId, args[0] || "Old Trafford"),
    "/live": () => basicHandlers.liveMatches(chatId),
    "/fixtures": () => webFeaturesHandlers.handleFixtures(chatId),
    "/trending_bets": () => webFeaturesHandlers.handleTrendingBets(chatId),
    "/bet_rec": () => webFeaturesHandlers.handleBetRecommendation(chatId),
    "/standings": () => basicHandlers.standings(chatId, args[0]),
    "/odds": () => basicHandlers.odds(chatId, args[0]),
    
    // Core Commands
    "/analyze": () => tierHandlers.analysisWithTier(chatId, userId, args.join(" ")),
    "/predict": () => tierHandlers.predictionsWithTier(chatId, userId, args.join(" ")),
    "/tips": () => basicHandlers.tips(chatId),
  };

  if (commands[cmd]) {
    await commands[cmd]();
    logger.info(`✅ ${cmd} sent`);
  } else {
    const text = `${BrandingService.ICONS.error} <b>Unknown Command</b>\n\nUse /help for all commands or /menu to explore.`;
    await telegram.sendMessage(chatId, text);
    logger.info(`⚠️ Unknown: ${cmd}`);
  }
}

process.on("SIGTERM", async () => {
  logger.info("Shutting down...");
  await redis.quit();
  process.exit(0);
});

main().catch((err) => {
  logger.error("Fatal", err);
  process.exit(1);
});
