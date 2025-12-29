/**
 * BETRIXAI Bot Integration Example
 * 
 * This file demonstrates how to integrate the NCBA payment flow
 * with your Telegraf bot instance. Copy the relevant sections
 * into your main bot file (src/app.js or src/bot/server.js)
 */

// ============================================================================
// STEP 1: IMPORT ALL PAYMENT MODULES
// ============================================================================

import { Telegraf } from "telegraf";
import { registerPaymentCommands, initializePaymentScheduler, getNCBAFlow } from "./payment-commands.js";
import cronScheduler from "./cron-scheduler.js";
import { Logger } from "../utils/logger.js";

const logger = new Logger("BetrixApp");

// ============================================================================
// STEP 2: INITIALIZE BOT
// ============================================================================

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

// ============================================================================
// STEP 3: REGISTER PAYMENT COMMANDS
// ============================================================================

// This automatically registers:
// /pay, /premium, /receipt, /approve, /pending, /status, /reconcile, /export
registerPaymentCommands(bot);

// ============================================================================
// STEP 4: INITIALIZE PAYMENT SCHEDULER (Daily Reconciliation at 00:00)
// ============================================================================

const ncbaStatementPath = process.env.NCBA_STATEMENT_PATH || "./ncba_statement.csv";
initializePaymentScheduler(ncbaStatementPath);

// ============================================================================
// STEP 5: SETUP ADDITIONAL CRON TASKS (OPTIONAL)
// ============================================================================

const paymentFlow = getNCBAFlow();

// Weekly stats report (Sundays at 09:00)
cronScheduler.scheduleWeeklyReport(paymentFlow, bot);

// Monthly backup (1st of month at 10:00)
cronScheduler.scheduleMonthlyBackup(paymentFlow, "./backups");

// ============================================================================
// STEP 6: ERROR HANDLING
// ============================================================================

bot.catch((err, ctx) => {
  logger.error("Bot error:", err);
  if (ctx) {
    ctx.reply("❌ An unexpected error occurred. Please try again later.");
  }
});

// ============================================================================
// STEP 7: MIDDLEWARE (OPTIONAL - for logging & rate limiting)
// ============================================================================

// Log all incoming messages
bot.use((ctx, next) => {
  logger.debug(`📨 Message from ${ctx.from.id}: ${ctx.message?.text || "[media]"}`);
  return next();
});

// ============================================================================
// STEP 8: REGISTER OTHER BOT COMMANDS (your existing handlers)
// ============================================================================

// Example: Help command
bot.command("start", (ctx) => {
  ctx.reply(
    "👋 Welcome to BETRIXAI!\n\n" +
    "📊 /predictions - Get football predictions\n" +
    "💳 /pay - Upgrade to Premium\n" +
    "❓ /help - Show all commands"
  );
});

bot.command("help", (ctx) => {
  ctx.reply(
    "🆘 *BETRIXAI Help*\n\n" +
    "⚽ *Predictions*\n" +
    "/predictions - Get AI predictions\n\n" +
    "💳 *Payment*\n" +
    "/pay - Show payment instructions\n" +
    "/premium - Upgrade to premium\n" +
    "/receipt - Submit M-Pesa receipt\n\n" +
    "👤 *Account*\n" +
    "/profile - View your profile\n" +
    "/settings - Adjust settings\n\n" +
    "📞 *Support*\n" +
    "/support - Contact support\n" +
    "/faq - Frequently asked questions",
    { parse_mode: "Markdown" }
  );
});

// ... Add your other command handlers here ...

// ============================================================================
// STEP 9: HANDLE GRACEFUL SHUTDOWN
// ============================================================================

process.once("SIGINT", () => {
  logger.info("⏹️  Shutting down gracefully...");
  cronScheduler.stopAll();
  bot.stop("SIGINT");
  process.exit(0);
});

process.once("SIGTERM", () => {
  logger.info("⏹️  Shutting down gracefully...");
  cronScheduler.stopAll();
  bot.stop("SIGTERM");
  process.exit(0);
});

// ============================================================================
// STEP 10: LAUNCH BOT
// ============================================================================

bot.launch();

logger.info("✅ BETRIXAI Bot launched successfully");
logger.info(`✅ NCBA Payment System initialized`);
logger.info(`✅ Daily reconciliation scheduled for ${ncbaStatementPath}`);
logger.info(`✅ Cron tasks: ${cronScheduler.getTasks().join(", ")}`);

// ============================================================================
// ADVANCED: WEBHOOK MODE (for Render, Railway, etc.)
// ============================================================================

/*
// If running on a platform like Render that requires webhook mode:

import express from "express";

const app = express();
app.use(express.json());

const webhookUrl = process.env.WEBHOOK_URL; // https://yourapp.render.com/webhook
const port = process.env.PORT || 3000;

app.post("/webhook", (req, res) => {
  bot.handleUpdate(req.body, res);
});

app.listen(port, () => {
  logger.info(`✅ Webhook server running on port ${port}`);
  bot.telegram.setWebhook(webhookUrl);
  logger.info(`✅ Webhook set to ${webhookUrl}`);
});

// Keep scheduled tasks running
setInterval(() => {
  logger.debug(`[HEARTBEAT] Cron tasks active: ${cronScheduler.getTasks().join(", ")}`);
}, 60000); // Every minute
*/

// ============================================================================
// END OF INTEGRATION EXAMPLE
// ============================================================================

export default bot;
