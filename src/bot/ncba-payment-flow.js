/**
 * BETRIXAI Telegram Bot Payment Flow
 * Paybill: 880100 | Account: 1006989273 (NCBA)
 * 
 * No external APIs required. Manual M-Pesa receipt verification
 * with daily NCBA statement reconciliation via CSV import.
 */

import fs from "fs";
import csv from "csv-parser";
import cron from "node-cron";
import { Logger } from "../utils/logger.js";

const logger = new Logger("NCBAPaymentFlow");

class NCBAPaymentFlow {
  constructor() {
    this.approvedReceipts = new Set();
    this.pendingReceipts = [];
    this.paybill = "880100";
    this.ncbaAccount = "1006989273";
    this.currency = "KSh";
    this.defaultAmount = 100;
    this.adminIds = (process.env.ADMIN_IDS || "").split(",").filter(Boolean);
  }

  /**
   * Step 1: Send payment instructions to user
   */
  getPaymentInstructions() {
    return (
      "💳 *BETRIXAI Premium Payment*\n\n" +
      "🏦 *Pay via M-Pesa:*\n" +
      `Paybill: \`${this.paybill}\`\n` +
      `Account: \`${this.ncbaAccount}\`\n` +
      `Amount: ${this.currency} ${this.defaultAmount}\n\n` +
      "After payment, send your M-Pesa receipt code:\n" +
      "`/receipt <M-PesaCode>`\n\n" +
      "Example: `/receipt QBC123XYZ`"
    );
  }

  /**
   * Step 2: Validate and process receipt submission
   */
  async processReceiptSubmission(receiptCode) {
    if (!receiptCode || receiptCode.length < 3) {
      return {
        success: false,
        message: "❌ Invalid receipt code. Please provide a valid M-Pesa code.",
      };
    }

    const isApproved = this.approvedReceipts.has(receiptCode.toUpperCase());

    if (isApproved) {
      return {
        success: true,
        message: "✅ *Payment confirmed!* Premium features unlocked.",
      };
    } else {
      // Add to pending for admin review
      this.pendingReceipts.push({
        code: receiptCode.toUpperCase(),
        timestamp: new Date().toISOString(),
      });

      return {
        success: false,
        message:
          "⏳ Receipt pending admin approval. We'll notify you once confirmed.",
        pending: true,
      };
    }
  }

  /**
   * Step 3: Admin approval flow
   */
  approveReceipt(receiptCode, adminId) {
    if (!this.adminIds.includes(String(adminId))) {
      return {
        success: false,
        message: "❌ Unauthorized. Only admins can approve receipts.",
      };
    }

    const code = receiptCode.toUpperCase();
    if (this.approvedReceipts.has(code)) {
      return {
        success: false,
        message: `⚠️ Receipt ${code} is already approved.`,
      };
    }

    this.approvedReceipts.add(code);

    // Remove from pending
    this.pendingReceipts = this.pendingReceipts.filter(
      (r) => r.code !== code
    );

    return {
      success: true,
      message: `✅ Receipt \`${code}\` approved successfully.`,
    };
  }

  /**
   * Step 4: Get list of pending receipts (admin only)
   */
  getPendingReceipts(adminId) {
    if (!this.adminIds.includes(String(adminId))) {
      return { success: false, message: "❌ Unauthorized." };
    }

    if (this.pendingReceipts.length === 0) {
      return { success: true, message: "✅ No pending receipts.", data: [] };
    }

    const formatted = this.pendingReceipts
      .map(
        (r, idx) =>
          `${idx + 1}. \`${r.code}\` - ${new Date(r.timestamp).toLocaleString()}`
      )
      .join("\n");

    return {
      success: true,
      message: `📋 *Pending Receipts:*\n${formatted}`,
      data: this.pendingReceipts,
    };
  }

  /**
   * Step 5: Daily Reconciliation - Import NCBA Statements from CSV
   * 
   * CSV Format expected:
   * ReceiptCode,Amount,Date,Description
   * QBC123XYZ,100,2024-12-29,M-Pesa Payment
   */
  importNCBAStatements(filePath) {
    return new Promise((resolve, reject) => {
      const newReceipts = [];

      fs.createReadStream(filePath)
        .pipe(csv())
        .on("data", (row) => {
          const receiptCode = row.ReceiptCode || row["Receipt Code"];
          const amount = row.Amount || row["amount"];
          const date = row.Date || row["date"];

          if (receiptCode) {
            const code = receiptCode.toString().toUpperCase().trim();

            // Add to approved if not already there
            if (!this.approvedReceipts.has(code)) {
              this.approvedReceipts.add(code);
              newReceipts.push(code);
              logger.info(`✅ Imported receipt: ${code}`);
            }
          }
        })
        .on("end", () => {
          logger.info(
            `✅ NCBA reconciliation complete. Imported ${newReceipts.length} new receipts.`
          );
          resolve({ success: true, imported: newReceipts.length });
        })
        .on("error", (err) => {
          logger.error(`❌ CSV import error: ${err.message}`);
          reject(err);
        });
    });
  }

  /**
   * Step 6: Schedule Daily Reconciliation (runs at midnight)
   */
  scheduleDailyReconciliation(csvFilePath = null) {
    const filePath =
      csvFilePath ||
      process.env.NCBA_STATEMENT_PATH ||
      "./ncba_statement.csv";

    // Run daily at 00:00 (midnight)
    cron.schedule("0 0 * * *", async () => {
      logger.info("🔄 Starting scheduled daily NCBA reconciliation...");

      if (!fs.existsSync(filePath)) {
        logger.warn(
          `⚠️ NCBA CSV file not found at ${filePath}. Skipping reconciliation.`
        );
        return;
      }

      try {
        const result = await this.importNCBAStatements(filePath);
        logger.info(
          `✅ Daily reconciliation completed. Imported ${result.imported} receipts.`
        );
      } catch (err) {
        logger.error(`❌ Daily reconciliation failed: ${err.message}`);
      }
    });

    logger.info(`✅ Daily NCBA reconciliation scheduled at 00:00`);
  }

  /**
   * Step 7: Get Premium Button/Link
   */
  getPremiumButton() {
    return {
      inline_keyboard: [
        [
          {
            text: "💳 Pay via NCBA M-Pesa",
            url: "https://www.ncbagroup.com/",
          },
        ],
        [
          {
            text: "❓ How to Pay",
            callback_data: "help_payment",
          },
        ],
      ],
    };
  }

  /**
   * Verify if receipt is approved
   */
  isReceiptApproved(receiptCode) {
    return this.approvedReceipts.has(receiptCode.toUpperCase());
  }

  /**
   * Get approved receipts count
   */
  getApprovedCount() {
    return this.approvedReceipts.size;
  }

  /**
   * Get pending receipts count
   */
  getPendingCount() {
    return this.pendingReceipts.length;
  }

  /**
   * Clear all receipts (admin debug only)
   */
  clearAllReceipts(adminId) {
    if (!this.adminIds.includes(String(adminId))) {
      return { success: false, message: "❌ Unauthorized." };
    }

    this.approvedReceipts.clear();
    this.pendingReceipts = [];

    return {
      success: true,
      message: "✅ All receipt records cleared.",
    };
  }

  /**
   * Export approved receipts as JSON (for backup)
   */
  exportApprovedReceipts() {
    return {
      exported_at: new Date().toISOString(),
      count: this.approvedReceipts.size,
      receipts: Array.from(this.approvedReceipts),
    };
  }

  /**
   * Load approved receipts from JSON backup
   */
  importApprovedReceipts(receiptsArray) {
    if (!Array.isArray(receiptsArray)) {
      throw new Error("Invalid receipts array format");
    }

    receiptsArray.forEach((code) => {
      this.approvedReceipts.add(code.toUpperCase());
    });

    logger.info(
      `✅ Imported ${receiptsArray.length} approved receipts from backup`
    );
    return { success: true, imported: receiptsArray.length };
  }
}

// Export singleton instance
export default new NCBAPaymentFlow();
