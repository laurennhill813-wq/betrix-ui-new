/**
 * Cron Scheduler for NCBA Daily Reconciliation
 * 
 * This module manages scheduled tasks for:
 * - Daily NCBA statement reconciliation (00:00 midnight)
 * - Weekly stats reporting (Sundays at 09:00)
 * - Monthly backups (1st of month at 10:00)
 */

import cron from "node-cron";
import fs from "fs";
import path from "path";
import { Logger } from "../utils/logger.js";

const logger = new Logger("CronScheduler");

class CronScheduler {
  constructor() {
    this.tasks = new Map();
    this.isRunning = false;
  }

  /**
   * Schedule daily NCBA reconciliation at midnight
   */
  scheduleDailyReconciliation(paymentFlow, csvFilePath) {
    const taskName = "daily-ncba-reconciliation";

    if (this.tasks.has(taskName)) {
      logger.warn(`⚠️ Task "${taskName}" already scheduled. Skipping.`);
      return;
    }

    // Run every day at 00:00 (midnight)
    const task = cron.schedule("0 0 * * *", async () => {
      logger.info("🔄 [CRON] Starting daily NCBA reconciliation...");

      try {
        if (!fs.existsSync(csvFilePath)) {
          logger.warn(
            `⚠️ [CRON] NCBA CSV file not found at ${csvFilePath}`
          );
          return;
        }

        const result = await paymentFlow.importNCBAStatements(csvFilePath);
        logger.info(
          `✅ [CRON] Daily reconciliation completed. Imported ${result.imported} receipts.`
        );
      } catch (err) {
        logger.error(
          `❌ [CRON] Daily reconciliation failed: ${err.message}`
        );
      }
    });

    this.tasks.set(taskName, task);
    logger.info(`✅ Scheduled "${taskName}" at 00:00 (midnight)`);
  }

  /**
   * Schedule weekly stats report (Sundays at 09:00)
   */
  scheduleWeeklyReport(paymentFlow, botInstance) {
    const taskName = "weekly-stats-report";

    if (this.tasks.has(taskName)) {
      logger.warn(`⚠️ Task "${taskName}" already scheduled. Skipping.`);
      return;
    }

    // Run every Sunday at 09:00
    const task = cron.schedule("0 9 * * 0", async () => {
      logger.info("📊 [CRON] Generating weekly stats report...");

      try {
        const approved = paymentFlow.getApprovedCount();
        const pending = paymentFlow.getPendingCount();

        const report = `
📊 *BETRIXAI Weekly Payment Report*
Period: Week of ${new Date().toLocaleDateString()}

✅ Approved Receipts: \`${approved}\`
⏳ Pending Receipts: \`${pending}\`
💾 Paybill: \`${paymentFlow.paybill}\`
🏦 NCBA Account: \`${paymentFlow.ncbaAccount}\`

Status: All systems operational ✓
        `.trim();

        // Send to admin
        const adminId = paymentFlow.adminIds[0];
        if (adminId && botInstance) {
          await botInstance.telegram.sendMessage(
            adminId,
            report,
            { parse_mode: "Markdown" }
          );
          logger.info(
            `✅ [CRON] Weekly report sent to admin ${adminId}`
          );
        }
      } catch (err) {
        logger.error(
          `❌ [CRON] Weekly report generation failed: ${err.message}`
        );
      }
    });

    this.tasks.set(taskName, task);
    logger.info(`✅ Scheduled "${taskName}" at 09:00 on Sundays`);
  }

  /**
   * Schedule monthly backup (1st of month at 10:00)
   */
  scheduleMonthlyBackup(paymentFlow, backupDir = "./backups") {
    const taskName = "monthly-backup";

    if (this.tasks.has(taskName)) {
      logger.warn(`⚠️ Task "${taskName}" already scheduled. Skipping.`);
      return;
    }

    // Create backup directory if it doesn't exist
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Run on 1st of every month at 10:00
    const task = cron.schedule("0 10 1 * *", async () => {
      logger.info("💾 [CRON] Starting monthly backup...");

      try {
        const backup = paymentFlow.exportApprovedReceipts();
        const fileName = `approved-receipts-${new Date().toISOString().split("T")[0]}.json`;
        const filePath = path.join(backupDir, fileName);

        fs.writeFileSync(filePath, JSON.stringify(backup, null, 2));

        logger.info(
          `✅ [CRON] Monthly backup completed: ${filePath}`
        );
      } catch (err) {
        logger.error(
          `❌ [CRON] Monthly backup failed: ${err.message}`
        );
      }
    });

    this.tasks.set(taskName, task);
    logger.info(`✅ Scheduled "${taskName}" at 10:00 on 1st of month`);
  }

  /**
   * Schedule custom cron task
   */
  scheduleCustomTask(name, cronExpression, callback) {
    if (this.tasks.has(name)) {
      logger.warn(`⚠️ Task "${name}" already scheduled. Skipping.`);
      return;
    }

    try {
      const task = cron.schedule(cronExpression, async () => {
        logger.info(`🔄 [CRON] Running custom task: ${name}`);
        try {
          await callback();
          logger.info(`✅ [CRON] Task "${name}" completed successfully`);
        } catch (err) {
          logger.error(`❌ [CRON] Task "${name}" failed: ${err.message}`);
        }
      });

      this.tasks.set(name, task);
      logger.info(
        `✅ Scheduled custom task "${name}" with expression: ${cronExpression}`
      );
    } catch (err) {
      logger.error(`❌ Failed to schedule task "${name}": ${err.message}`);
      throw err;
    }
  }

  /**
   * Stop a specific task
   */
  stopTask(taskName) {
    const task = this.tasks.get(taskName);

    if (!task) {
      logger.warn(`⚠️ Task "${taskName}" not found.`);
      return false;
    }

    task.stop();
    this.tasks.delete(taskName);
    logger.info(`⏹️  Stopped task: ${taskName}`);
    return true;
  }

  /**
   * Stop all scheduled tasks
   */
  stopAll() {
    this.tasks.forEach((task, name) => {
      task.stop();
      logger.info(`⏹️  Stopped task: ${name}`);
    });

    this.tasks.clear();
    this.isRunning = false;
    logger.info("✅ All cron tasks stopped");
  }

  /**
   * Get all scheduled tasks
   */
  getTasks() {
    return Array.from(this.tasks.keys());
  }

  /**
   * Get task status
   */
  getTaskStatus(taskName) {
    const task = this.tasks.get(taskName);

    return {
      name: taskName,
      active: !!task,
      nextExecution: task ? task.nextDate().toString() : null,
    };
  }

  /**
   * Get all tasks status
   */
  getAllTasksStatus() {
    return this.getTasks().map((name) => this.getTaskStatus(name));
  }
}

// Export singleton instance
export default new CronScheduler();
