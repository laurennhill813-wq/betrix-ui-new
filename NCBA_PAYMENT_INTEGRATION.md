# BETRIXAI NCBA Payment Integration Guide

## 🔧 Overview

This is a **zero-API payment system** for BETRIXAI Telegram bot that:
- ✅ Requires NO external payment APIs (Safaricom, Pesapal, etc.)
- ✅ Uses **manual M-Pesa receipts** for verification
- ✅ Reconciles payments via **NCBA CSV statements** 
- ✅ Supports **admin approval flow** for edge cases
- ✅ Runs **automated daily reconciliation** at midnight
- ✅ Completely GDPR/DPA compliant (local data only)

---

## 💳 Payment Details

| Field | Value |
|-------|-------|
| **Paybill** | `880100` |
| **NCBA Account** | `1006989273` |
| **Currency** | KES (Kenyan Shillings) |
| **Amount** | 100 |
| **Payment Method** | M-Pesa |

---

## 📋 CSV Format

Place your NCBA statement export in `ncba_statement.csv` with this format:

```csv
ReceiptCode,Amount,Date,Description,Phone,Status
QBC123XYZ,100,2024-12-29,M-Pesa Payment BETRIXAI,+254712345678,Completed
ABC456DEF,100,2024-12-28,M-Pesa Payment BETRIXAI,+254798765432,Completed
```

**Required Columns:**
- `ReceiptCode` - M-Pesa receipt code (e.g., `QBC123XYZ`)
- `Amount` - Payment amount
- `Date` - Transaction date
- `Description` - Transaction description
- `Phone` - (Optional) Sender phone number
- `Status` - (Optional) Transaction status

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install csv-parser node-cron
```

### 2. Configure Environment Variables

Add to your `.env` file:

```env
# Bot Token
TELEGRAM_TOKEN=your_bot_token_here

# Admin User IDs (comma-separated for multiple admins)
ADMIN_IDS=123456789,987654321

# NCBA CSV Statement Path (optional, defaults to ./ncba_statement.csv)
NCBA_STATEMENT_PATH=./ncba_statement.csv
```

### 3. Register Commands in Your Bot

In your main bot file (e.g., `src/app.js` or `src/bot/server.js`):

```javascript
import { Telegraf } from 'telegraf';
import { 
  registerPaymentCommands, 
  initializePaymentScheduler 
} from './bot/payment-commands.js';

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

// Register all payment commands
registerPaymentCommands(bot);

// Initialize daily reconciliation at 00:00 (midnight)
initializePaymentScheduler('./ncba_statement.csv');

// Start bot
bot.launch();
```

---

## 🎯 User Flow

### Step 1: User Requests Payment Info
```
User: /pay
Bot Response:
💳 BETRIXAI Premium Payment

🏦 Pay via M-Pesa:
Paybill: 880100
Account: 1006989273
Amount: KSh 100

After payment, send your M-Pesa receipt code:
/receipt <M-PesaCode>
Example: /receipt QBC123XYZ
```

### Step 2: User Submits Receipt
```
User: /receipt QBC123XYZ
Bot Response (if approved):
✅ Payment confirmed! Premium features unlocked.

Bot Response (if pending):
⏳ Receipt pending admin approval. We'll notify you once confirmed.
```

### Step 3: Admin Approves (if needed)
```
Admin: /pending
Bot Response:
📋 Pending Receipts:
1. QBC123XYZ - 2024-12-29 14:30:45

Admin: /approve QBC123XYZ
Bot Response:
✅ Receipt QBC123XYZ approved successfully.
```

### Step 4: User Gets Notification
```
Bot to User:
✅ Your payment has been approved! Premium unlocked.
```

---

## 🛠 Available Commands

### User Commands

| Command | Description |
|---------|-------------|
| `/pay` | Show payment instructions |
| `/premium` | Show premium upgrade button |
| `/receipt <code>` | Submit M-Pesa receipt code |
| `/help_payment` | Show detailed payment help |

### Admin Commands

| Command | Description |
|---------|-------------|
| `/pending` | List all pending receipts |
| `/approve <code>` | Approve a pending receipt |
| `/status` | Show payment statistics |
| `/reconcile` | Manually trigger NCBA reconciliation |
| `/export` | Export approved receipts as JSON |

---

## 🔄 Daily Reconciliation

The system **automatically runs daily at 00:00 (midnight)** and:

1. ✅ Reads your `ncba_statement.csv` file
2. ✅ Extracts all M-Pesa receipt codes
3. ✅ Adds new receipts to approved list
4. ✅ Logs results for audit trail
5. ✅ Sends notifications (optional)

**Manual Trigger:**
```
Admin: /reconcile
Bot: 🔄 Starting NCBA reconciliation...
Bot: ✅ Reconciliation complete! Imported 5 new receipts.
```

---

## 📊 Admin Dashboard

View all payment statistics:

```
Admin: /status
Bot Response:
📊 NCBA Payment Status

✅ Approved Receipts: 42
⏳ Pending Receipts: 3
💾 Paybill: 880100
🏦 NCBA Account: 1006989273

Use:
/pending - View pending receipts
/approve <code> - Approve a receipt
/reconcile - Trigger manual reconciliation
```

---

## 🔐 Security Features

- ✅ **Admin-only commands** (protected by `ADMIN_IDS`)
- ✅ **Receipt code validation** (minimum length checks)
- ✅ **Audit logging** (all approvals logged)
- ✅ **No API keys exposed** (zero external dependencies)
- ✅ **Local data only** (GDPR compliant)
- ✅ **Duplicate prevention** (can't approve same receipt twice)

---

## 📁 File Structure

```
src/
├── bot/
│   ├── ncba-payment-flow.js          ← Core payment logic
│   ├── payment-commands.js           ← Telegraf command handlers
│   └── payments.js                   ← Existing payment module
├── app.js                            ← Main bot file (integrate here)
└── ...
ncba_statement.csv                    ← Daily NCBA export (place here)
```

---

## 🔗 Integration Example (Full App)

### `src/app.js`

```javascript
import { Telegraf } from 'telegraf';
import { registerPaymentCommands, initializePaymentScheduler } from './bot/payment-commands.js';
import { Logger } from './utils/logger.js';

const logger = new Logger('BetrixApp');
const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

// === Register All Handlers ===
registerPaymentCommands(bot);
// ... other command handlers ...

// === Initialize Schedulers ===
initializePaymentScheduler('./ncba_statement.csv');

// === Error Handling ===
bot.catch((err, ctx) => {
  logger.error('Bot error:', err);
  ctx.reply('❌ An error occurred. Please try again.');
});

// === Launch ===
bot.launch();
logger.info('✅ BETRIXAI Bot running with NCBA payment integration');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
```

---

## 🧪 Testing

### Test Receipt Approval

```bash
# In your bot
/receipt QBC123XYZ
# Bot: ⏳ Receipt pending admin approval...

# As admin
/pending
# Bot: Lists pending receipts

/approve QBC123XYZ
# Bot: ✅ Receipt QBC123XYZ approved successfully.

# User tries again
/receipt QBC123XYZ
# Bot: ✅ Payment confirmed! Premium features unlocked.
```

### Test Daily Reconciliation

1. Update `ncba_statement.csv` with new receipt codes
2. Run: `/reconcile` (as admin)
3. Check logs: `✅ NCBA reconciliation complete. Imported X new receipts.`

---

## 📈 Monitoring & Logging

All actions are logged via the Logger utility:

```
✅ Premium unlocked for user 123456789
✅ Admin 987654321 approved receipt QBC123XYZ
✅ NCBA reconciliation complete. Imported 5 new receipts.
❌ CSV import error: File not found
```

View logs in your application's log file or console.

---

## ⚠️ Troubleshooting

### "Receipt not found"
- ✅ Check your NCBA CSV file has the correct receipt code
- ✅ Run `/reconcile` to force manual import
- ✅ Contact admin for manual approval

### "Unauthorized" on admin commands
- ✅ Ensure your User ID is in `ADMIN_IDS` env variable
- ✅ Restart bot after changing env vars

### Daily reconciliation not running
- ✅ Ensure `ncba_statement.csv` exists and is readable
- ✅ Check logs for cron errors
- ✅ Manually trigger with `/reconcile`

### CSV import fails
- ✅ Verify CSV headers match the expected format
- ✅ Check file encoding (UTF-8)
- ✅ Ensure file path is correct in env

---

## 🎯 Next Steps

1. ✅ Install dependencies: `npm install csv-parser node-cron`
2. ✅ Add environment variables to `.env`
3. ✅ Export NCBA statements as CSV daily
4. ✅ Register payment commands in your bot
5. ✅ Test payment flow with sample receipts
6. ✅ Deploy and monitor

---

## 💡 Pro Tips

- **Backup:** Use `/export` regularly to backup approved receipts
- **Audit:** All approvals are logged for compliance
- **Speed:** Manual admin approval via `/approve` for quick processing
- **Automation:** Daily cron runs at midnight, no manual effort needed
- **Scalability:** Add multiple admins in `ADMIN_IDS` for team approval

---

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review logs for specific errors
3. Test with `/receipt <test_code>` command
4. Contact your bot administrator

---

**Built with ❤️ for BETRIXAI**  
*Zero APIs. Full Control. Complete Transparency.*
