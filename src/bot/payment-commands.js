/**
 * BETRIXAI Telegram Bot Payment Commands
 * Integrates NCBA manual reconciliation with Telegraf bot
 * 
 * Commands:
 * /pay - Show payment instructions
 * /premium - Show premium upgrade button
 * /receipt <code> - Submit M-Pesa receipt for verification
 * /approve <code> - Admin: Approve receipt
 * /pending - Admin: List pending receipts
 * /status - Admin: Show payment stats
 */

import ncbaFlow from "./ncba-payment-flow.js";
import { Logger } from "../utils/logger.js";

const logger = new Logger("PaymentCommands");

/**
 * Register all payment commands with Telegraf bot instance
 */
export function registerPaymentCommands(bot) {
  /**
   * /pay - Display payment instructions
   */
  bot.command("pay", async (ctx) => {
    try {
      const instructions = ncbaFlow.getPaymentInstructions();
      await ctx.reply(instructions, { parse_mode: "Markdown" });
    } catch (err) {
      logger.error("Error in /pay command", err);
      ctx.reply("❌ An error occurred. Please try again.");
    }
  });

  /**
   * /premium - Show premium upgrade button
   */
  bot.command("premium", async (ctx) => {
    try {
      const button = ncbaFlow.getPremiumButton();
      await ctx.reply("Upgrade to *BETRIXAI Premium* 🚀", {
        reply_markup: button,
        parse_mode: "Markdown",
      });
    } catch (err) {
      logger.error("Error in /premium command", err);
      ctx.reply("❌ An error occurred. Please try again.");
    }
  });

  /**
   * /receipt <code> - Submit M-Pesa receipt for verification
   */
  bot.command("receipt", async (ctx) => {
    try {
      const receiptCode = ctx.message.text.split(" ").slice(1).join(" ");

      if (!receiptCode) {
        return ctx.reply(
          "❌ Please provide your M-Pesa receipt code.\n\nExample: `/receipt QBC123XYZ`",
          { parse_mode: "Markdown" }
        );
      }

      const result = await ncbaFlow.processReceiptSubmission(receiptCode);

      if (result.success) {
        ctx.reply(result.message, { parse_mode: "Markdown" });
        // Unlock premium features for user (integrate with your DB)
        logger.info(`✅ Premium unlocked for user ${ctx.from.id}`);
      } else {
        ctx.reply(result.message, { parse_mode: "Markdown" });
      }
    } catch (err) {
      logger.error("Error in /receipt command", err);
      ctx.reply("❌ An error occurred. Please try again.");
    }
  });

  /**
   * /approve <code> - Admin: Approve receipt
   */
  bot.command("approve", async (ctx) => {
    try {
      const receiptCode = ctx.message.text.split(" ").slice(1).join(" ");

      if (!receiptCode) {
        return ctx.reply(
          "❌ Usage: `/approve <M-PesaCode>`\n\nExample: `/approve QBC123XYZ`",
          { parse_mode: "Markdown" }
        );
      }

      const result = ncbaFlow.approveReceipt(receiptCode, ctx.from.id);

      if (result.success) {
        ctx.reply(result.message, { parse_mode: "Markdown" });
        logger.info(`✅ Admin ${ctx.from.id} approved receipt ${receiptCode}`);
      } else {
        ctx.reply(result.message, { parse_mode: "Markdown" });
      }
    } catch (err) {
      logger.error("Error in /approve command", err);
      ctx.reply("❌ An error occurred. Please try again.");
    }
  });

  /**
   * /pending - Admin: List pending receipts
   */
  bot.command("pending", async (ctx) => {
    try {
      const result = ncbaFlow.getPendingReceipts(ctx.from.id);

      if (result.success) {
        ctx.reply(result.message, { parse_mode: "Markdown" });
      } else {
        ctx.reply(result.message, { parse_mode: "Markdown" });
      }
    } catch (err) {
      logger.error("Error in /pending command", err);
      ctx.reply("❌ An error occurred. Please try again.");
    }
  });

  /**
   * /status - Admin: Show payment statistics
   */
  bot.command("status", async (ctx) => {
    try {
      const isAdmin = ncbaFlow.adminIds.includes(String(ctx.from.id));

      if (!isAdmin) {
        return ctx.reply("❌ Unauthorized. Only admins can view status.");
      }

      const approved = ncbaFlow.getApprovedCount();
      const pending = ncbaFlow.getPendingCount();

      const message = `
📊 *NCBA Payment Status*

✅ Approved Receipts: \`${approved}\`
⏳ Pending Receipts: \`${pending}\`
💾 Paybill: \`${ncbaFlow.paybill}\`
🏦 NCBA Account: \`${ncbaFlow.ncbaAccount}\`

Use:
\`/pending\` - View pending receipts
\`/approve <code>\` - Approve a receipt
\`/reconcile\` - Trigger manual reconciliation
      `.trim();

      ctx.reply(message, { parse_mode: "Markdown" });
    } catch (err) {
      logger.error("Error in /status command", err);
      ctx.reply("❌ An error occurred. Please try again.");
    }
  });

  /**
   * /reconcile - Admin: Trigger manual NCBA statement import
   */
  bot.command("reconcile", async (ctx) => {
    try {
      const isAdmin = ncbaFlow.adminIds.includes(String(ctx.from.id));

      if (!isAdmin) {
        return ctx.reply("❌ Unauthorized. Only admins can trigger reconciliation.");
      }

      await ctx.reply("🔄 Starting NCBA reconciliation...", {
        parse_mode: "Markdown",
      });

      const csvPath =
        process.env.NCBA_STATEMENT_PATH || "./ncba_statement.csv";
      const result = await ncbaFlow.importNCBAStatements(csvPath);

      if (result.success) {
        await ctx.reply(
          `✅ Reconciliation complete! Imported \`${result.imported}\` new receipts.`,
          { parse_mode: "Markdown" }
        );
      }
    } catch (err) {
      logger.error("Error in /reconcile command", err);
      ctx.reply(`❌ Reconciliation failed: ${err.message}`);
    }
  });

  /**
   * /export - Admin: Export approved receipts as backup
   */
  bot.command("export", async (ctx) => {
    try {
      const isAdmin = ncbaFlow.adminIds.includes(String(ctx.from.id));

      if (!isAdmin) {
        return ctx.reply("❌ Unauthorized. Only admins can export data.");
      }

      const backup = ncbaFlow.exportApprovedReceipts();

      await ctx.reply(
        `📋 *Approved Receipts Backup*\n\n\`\`\`json\n${JSON.stringify(backup, null, 2)}\n\`\`\``,
        { parse_mode: "Markdown" }
      );

      logger.info(`✅ Admin ${ctx.from.id} exported approved receipts`);
    } catch (err) {
      logger.error("Error in /export command", err);
      ctx.reply("❌ An error occurred. Please try again.");
    }
  });

  /**
   * /help - Payment help information
   */
  bot.command("help_payment", async (ctx) => {
    const helpText = `
🆘 *BETRIXAI Payment Help*

❓ *How to pay:*
1. Send money via M-Pesa
   Paybill: \`${ncbaFlow.paybill}\`
   Account: \`${ncbaFlow.ncbaAccount}\`
   Amount: ${ncbaFlow.currency} ${ncbaFlow.defaultAmount}

2. Copy your M-Pesa receipt code (e.g., \`QBC123XYZ\`)

3. Send to the bot: \`/receipt QBC123XYZ\`

4. If approved → Premium unlocked! ✅
   If pending → Admin will approve soon ⏳

💡 *Tips:*
• Your receipt code is on your M-Pesa confirmation
• Processing usually takes 5-10 minutes
• Contact support if it takes longer

📞 *Need help?*
Reply to this message or use /support
    `.trim();

    await ctx.reply(helpText, { parse_mode: "Markdown" });
  });

  logger.info("✅ All payment commands registered");
}

/**
 * Initialize daily NCBA reconciliation scheduler
 */
export function initializePaymentScheduler(csvFilePath = null) {
  try {
    ncbaFlow.scheduleDailyReconciliation(csvFilePath);
    logger.info("✅ Payment scheduler initialized");
  } catch (err) {
    logger.error("Failed to initialize payment scheduler", err);
    throw err;
  }
}

/**
 * Get NCBA flow instance (for external use)
 */
export function getNCBAFlow() {
  return ncbaFlow;
}
