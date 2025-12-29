# NCBA Payment System - Quick Reference Card

## 🚀 60-Second Setup

```bash
# 1. Install dependencies
npm install csv-parser node-cron

# 2. Add to .env
TELEGRAM_TOKEN=your_token
ADMIN_IDS=your_id

# 3. Add to src/app.js
import { registerPaymentCommands, initializePaymentScheduler } from "./bot/payment-commands.js";
registerPaymentCommands(bot);
initializePaymentScheduler('./ncba_statement.csv');

# 4. Start bot
npm start
```

---

## 📋 Quick Command Reference

### User Commands
```
/pay                    Show payment instructions
/premium                Show upgrade button
/receipt QBC123XYZ      Submit M-Pesa receipt
/help_payment           Detailed help
```

### Admin Commands
```
/pending                List pending receipts
/approve QBC123XYZ      Approve receipt
/status                 Show statistics
/reconcile              Manual import
/export                 Backup data
```

### CLI Commands
```bash
node src/bot/admin-dashboard.js
node src/bot/admin-dashboard.js approve QBC123XYZ
node src/bot/admin-dashboard.js import ./ncba.csv
node src/bot/admin-dashboard.js stats
```

---

## 💳 Payment Details

| Field | Value |
|-------|-------|
| **Paybill** | 880100 |
| **Account** | 1006989273 |
| **Currency** | KSh |
| **Amount** | 100 |
| **Verification** | Via M-Pesa receipt code |

---

## 📁 File Organization

| File | Lines | Purpose |
|------|-------|---------|
| `ncba-payment-flow.js` | 250 | Core logic |
| `payment-commands.js` | 400 | Bot commands |
| `cron-scheduler.js` | 300 | Task scheduling |
| `admin-dashboard.js` | 400 | CLI tool |
| `INTEGRATION_EXAMPLE.js` | 200 | Integration guide |

---

## 🔄 Daily Schedule

```
00:00 → Daily NCBA reconciliation
09:00 → Weekly report (Sundays)
10:00 → Monthly backup (1st of month)
```

---

## 🧪 Quick Test

```
1. /pay
   → See payment instructions

2. /receipt QBC123XYZ
   → Should say "pending admin approval"

3. /pending (as admin)
   → See pending receipt

4. /approve QBC123XYZ (as admin)
   → Receipt approved

5. /receipt QBC123XYZ (user retry)
   → Should say "Payment confirmed!"
```

---

## 🔐 Environment Variables

```env
# Required
TELEGRAM_TOKEN=your_bot_token

# Required for admin commands
ADMIN_IDS=123456789,987654321

# Optional (defaults to ./ncba_statement.csv)
NCBA_STATEMENT_PATH=./ncba.csv

# Optional
NODE_ENV=production
TZ=Africa/Nairobi
```

---

## 📊 CSV Format

```csv
ReceiptCode,Amount,Date,Description,Phone,Status
QBC123XYZ,100,2024-12-29,M-Pesa Payment,+254712345678,Completed
ABC456DEF,100,2024-12-28,M-Pesa Payment,+254798765432,Completed
```

**Required:** ReceiptCode column  
**Optional:** Amount, Date, Phone, Status

---

## 🚨 Troubleshooting

| Issue | Fix |
|-------|-----|
| "Receipt not found" | Check CSV, run `/reconcile` |
| "Unauthorized" | Add user ID to ADMIN_IDS |
| "CSV not found" | Create `ncba_statement.csv` in root |
| Cron not running | Check file exists, restart bot |

---

## 💾 Backup & Restore

```bash
# Export (in bot)
/export

# Restore (via CLI)
node src/bot/admin-dashboard.js restore backup-2024-12-29.json
```

---

## 📈 Key Metrics

```
• Approved receipts: /status
• Pending receipts: /pending
• Import count: Check logs
• Approval time: Minutes
```

---

## 🎯 Integration Points

```javascript
// In src/app.js

import { registerPaymentCommands, initializePaymentScheduler } from "./bot/payment-commands.js";

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

// Register commands
registerPaymentCommands(bot);

// Start scheduler
initializePaymentScheduler('./ncba_statement.csv');

bot.launch();
```

---

## 📞 Support Docs

| Document | Contains |
|----------|----------|
| [NCBA_PAYMENT_INTEGRATION.md](NCBA_PAYMENT_INTEGRATION.md) | Complete guide |
| [NCBA_PAYMENT_ARCHITECTURE.md](NCBA_PAYMENT_ARCHITECTURE.md) | System design |
| [PAYMENT_SYSTEM_SETUP.md](PAYMENT_SYSTEM_SETUP.md) | Installation |
| [NCBA_PAYMENT_SYSTEM_COMPLETE.md](NCBA_PAYMENT_SYSTEM_COMPLETE.md) | Overview |

---

## ✅ Pre-Launch Checklist

- [ ] Dependencies installed
- [ ] .env configured
- [ ] Code integrated
- [ ] CSV file created
- [ ] /pay command works
- [ ] /receipt command works
- [ ] /approve command works
- [ ] Cron scheduled
- [ ] Admin dashboard works
- [ ] Backup created
- [ ] Ready to deploy

---

**Zero APIs. Full Control. Complete Transparency.**

*BETRIXAI Payment System v1.0*
