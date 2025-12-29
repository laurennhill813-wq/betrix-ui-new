/**
 * NCBA Payment System - Admin Dashboard CLI
 * 
 * A command-line interface for admins to manage payments
 * when they're not in the Telegram bot.
 * 
 * Usage:
 * node src/bot/admin-dashboard.js [command] [args]
 * 
 * Commands:
 * - list-approved          List all approved receipts
 * - list-pending           List all pending receipts
 * - approve <code>         Approve a receipt code
 * - reject <code>          Reject a receipt code
 * - import <csv-path>      Import NCBA statements from CSV
 * - export                 Export approved receipts to JSON
 * - stats                  Show payment statistics
 * - backup                 Create backup of all data
 * - restore <backup-file>  Restore from backup JSON
 */

import ncbaFlow from "./ncba-payment-flow.js";
import cronScheduler from "./cron-scheduler.js";
import fs from "fs";
import path from "path";
import { Logger } from "../utils/logger.js";
import readline from "readline";

const logger = new Logger("AdminDashboard");

class AdminDashboard {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  prompt(question) {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer);
      });
    });
  }

  async listApproved() {
    const receipts = ncbaFlow.exportApprovedReceipts();

    console.log("\n📋 APPROVED RECEIPTS");
    console.log("====================\n");

    if (receipts.receipts.length === 0) {
      console.log("No approved receipts yet.\n");
      return;
    }

    receipts.receipts.forEach((code, idx) => {
      console.log(`${idx + 1}. ${code}`);
    });

    console.log(`\nTotal: ${receipts.count} receipts\n`);
  }

  async listPending() {
    const pending = ncbaFlow.pendingReceipts;

    console.log("\n⏳ PENDING RECEIPTS");
    console.log("===================\n");

    if (pending.length === 0) {
      console.log("No pending receipts.\n");
      return;
    }

    pending.forEach((receipt, idx) => {
      const timestamp = new Date(receipt.timestamp).toLocaleString();
      console.log(`${idx + 1}. ${receipt.code} - ${timestamp}`);
    });

    console.log(`\nTotal: ${pending.length} pending\n`);
  }

  async approve(code) {
    const result = ncbaFlow.approveReceipt(code, process.env.ADMIN_ID || "0");

    if (result.success) {
      console.log(`\n✅ ${result.message}\n`);
    } else {
      console.log(`\n❌ ${result.message}\n`);
    }
  }

  async reject(code) {
    const codeUpper = code.toUpperCase();
    const idx = ncbaFlow.pendingReceipts.findIndex(
      (r) => r.code === codeUpper
    );

    if (idx === -1) {
      console.log(`\n❌ Receipt ${code} not found in pending list.\n`);
      return;
    }

    ncbaFlow.pendingReceipts.splice(idx, 1);
    console.log(`\n✅ Receipt ${code} rejected and removed from pending.\n`);
  }

  async import(csvPath) {
    if (!fs.existsSync(csvPath)) {
      console.log(`\n❌ File not found: ${csvPath}\n`);
      return;
    }

    console.log(`\n🔄 Importing NCBA statements from ${csvPath}...`);

    try {
      const result = await ncbaFlow.importNCBAStatements(csvPath);
      console.log(
        `✅ Import complete! Imported ${result.imported} new receipts.\n`
      );
    } catch (err) {
      console.log(`\n❌ Import failed: ${err.message}\n`);
    }
  }

  async export() {
    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `backup-approved-receipts-${timestamp}.json`;

    const backup = ncbaFlow.exportApprovedReceipts();

    try {
      fs.writeFileSync(filename, JSON.stringify(backup, null, 2));
      console.log(`\n✅ Exported to ${filename}\n`);
    } catch (err) {
      console.log(`\n❌ Export failed: ${err.message}\n`);
    }
  }

  async stats() {
    const approved = ncbaFlow.getApprovedCount();
    const pending = ncbaFlow.getPendingCount();

    console.log("\n📊 PAYMENT STATISTICS");
    console.log("====================\n");
    console.log(`Paybill: ${ncbaFlow.paybill}`);
    console.log(`NCBA Account: ${ncbaFlow.ncbaAccount}`);
    console.log(`Currency: ${ncbaFlow.currency}`);
    console.log(`Default Amount: ${ncbaFlow.defaultAmount}\n`);
    console.log(`✅ Approved Receipts: ${approved}`);
    console.log(`⏳ Pending Receipts: ${pending}\n`);

    if (cronScheduler.getTasks().length > 0) {
      console.log(`📅 Scheduled Tasks:`);
      cronScheduler.getTasks().forEach((task) => {
        const status = cronScheduler.getTaskStatus(task);
        console.log(`   - ${task}: ${status.active ? "Active" : "Inactive"}`);
      });
    }

    console.log("");
  }

  async backup() {
    const timestamp = new Date().toISOString();
    const backupDir = "./backups";

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const backup = ncbaFlow.exportApprovedReceipts();
    const filename = path.join(
      backupDir,
      `backup-${timestamp.split("T")[0]}.json`
    );

    try {
      fs.writeFileSync(filename, JSON.stringify(backup, null, 2));
      console.log(`\n✅ Backup created: ${filename}\n`);
    } catch (err) {
      console.log(`\n❌ Backup failed: ${err.message}\n`);
    }
  }

  async restore(backupFile) {
    if (!fs.existsSync(backupFile)) {
      console.log(`\n❌ Backup file not found: ${backupFile}\n`);
      return;
    }

    try {
      const data = JSON.parse(fs.readFileSync(backupFile, "utf-8"));
      ncbaFlow.importApprovedReceipts(data.receipts);
      console.log(
        `\n✅ Restored ${data.receipts.length} receipts from backup.\n`
      );
    } catch (err) {
      console.log(`\n❌ Restore failed: ${err.message}\n`);
    }
  }

  async interactive() {
    console.log("\n🤖 BETRIXAI NCBA PAYMENT ADMIN DASHBOARD\n");

    while (true) {
      console.log("Commands:");
      console.log("1. list-approved   - List approved receipts");
      console.log("2. list-pending    - List pending receipts");
      console.log("3. approve <code>  - Approve a receipt");
      console.log("4. reject <code>   - Reject a receipt");
      console.log("5. import <path>   - Import NCBA CSV");
      console.log("6. export          - Export approved receipts");
      console.log("7. stats           - Show statistics");
      console.log("8. backup          - Create backup");
      console.log("9. restore <file>  - Restore from backup");
      console.log("0. exit            - Exit dashboard\n");

      const command = await this.prompt("Enter command: ");
      const [action, ...args] = command.trim().split(" ");

      switch (action) {
        case "list-approved":
          await this.listApproved();
          break;
        case "list-pending":
          await this.listPending();
          break;
        case "approve":
          if (args.length === 0) {
            console.log("❌ Please provide a receipt code.\n");
          } else {
            await this.approve(args[0]);
          }
          break;
        case "reject":
          if (args.length === 0) {
            console.log("❌ Please provide a receipt code.\n");
          } else {
            await this.reject(args[0]);
          }
          break;
        case "import":
          if (args.length === 0) {
            console.log("❌ Please provide a CSV file path.\n");
          } else {
            await this.import(args.join(" "));
          }
          break;
        case "export":
          await this.export();
          break;
        case "stats":
          await this.stats();
          break;
        case "backup":
          await this.backup();
          break;
        case "restore":
          if (args.length === 0) {
            console.log("❌ Please provide a backup file path.\n");
          } else {
            await this.restore(args.join(" "));
          }
          break;
        case "0":
        case "exit":
        case "quit":
          console.log("\n👋 Goodbye!\n");
          this.rl.close();
          process.exit(0);
          break;
        default:
          console.log("❌ Unknown command. Try again.\n");
      }
    }
  }

  async run() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
      // Interactive mode
      await this.interactive();
    } else {
      // Command-line mode
      const [command, ...params] = args;

      switch (command) {
        case "list-approved":
          await this.listApproved();
          break;
        case "list-pending":
          await this.listPending();
          break;
        case "approve":
          if (params.length === 0) {
            console.log("❌ Usage: node admin-dashboard.js approve <code>");
          } else {
            await this.approve(params[0]);
          }
          break;
        case "reject":
          if (params.length === 0) {
            console.log("❌ Usage: node admin-dashboard.js reject <code>");
          } else {
            await this.reject(params[0]);
          }
          break;
        case "import":
          if (params.length === 0) {
            console.log("❌ Usage: node admin-dashboard.js import <csv-path>");
          } else {
            await this.import(params[0]);
          }
          break;
        case "export":
          await this.export();
          break;
        case "stats":
          await this.stats();
          break;
        case "backup":
          await this.backup();
          break;
        case "restore":
          if (params.length === 0) {
            console.log("❌ Usage: node admin-dashboard.js restore <backup-file>");
          } else {
            await this.restore(params[0]);
          }
          break;
        case "help":
          console.log(
            "Available commands: list-approved, list-pending, approve, reject, import, export, stats, backup, restore"
          );
          break;
        default:
          console.log(`❌ Unknown command: ${command}`);
      }

      this.rl.close();
      process.exit(0);
    }
  }
}

// Run dashboard
const dashboard = new AdminDashboard();
dashboard.run().catch((err) => {
  logger.error("Dashboard error:", err);
  process.exit(1);
});
