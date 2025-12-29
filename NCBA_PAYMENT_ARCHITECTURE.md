# NCBA Payment System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    BETRIXAI TELEGRAM BOT                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  User Commands (Telegraf)                            │  │
│  │  /pay, /premium, /receipt, /help_payment            │  │
│  └──────────────┬───────────────────────────────────────┘  │
│                 │                                           │
│  ┌──────────────▼───────────────────────────────────────┐  │
│  │  payment-commands.js                                 │  │
│  │  (Command routing & validation)                      │  │
│  └──────────────┬───────────────────────────────────────┘  │
│                 │                                           │
│  ┌──────────────▼───────────────────────────────────────┐  │
│  │  ncba-payment-flow.js                                │  │
│  │  (Core payment logic)                                │  │
│  │                                                       │  │
│  │  • verifyReceipt()                                   │  │
│  │  • approveReceipt()                                  │  │
│  │  • importNCBAStatements()                            │  │
│  │  • exportApprovedReceipts()                          │  │
│  └──────────────┬───────────────────────────────────────┘  │
│                 │                                           │
│  ┌──────────────▼───────────────────────────────────────┐  │
│  │  Data Storage (In-Memory + Files)                    │  │
│  │                                                       │  │
│  │  approvedReceipts: Set<string>                       │  │
│  │  pendingReceipts: Array<{code, timestamp}>          │  │
│  │  backups/*.json                                      │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Admin Commands (Telegraf)                           │  │
│  │  /pending, /approve, /status, /reconcile, /export   │  │
│  └──────────────┬───────────────────────────────────────┘  │
│                 │                                           │
│  ┌──────────────▼───────────────────────────────────────┐  │
│  │  cron-scheduler.js (node-cron)                       │  │
│  │                                                       │  │
│  │  • Daily reconciliation (00:00)                      │  │
│  │  • Weekly stats report (Sunday 09:00)               │  │
│  │  • Monthly backup (1st of month 10:00)              │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         ▲                              ▲
         │                              │
         │                              │
    ┌────┴────────────┐        ┌────────┴──────┐
    │ TELEGRAM API    │        │ FILE SYSTEM   │
    │ (Telegraf SDK)  │        │               │
    │                 │        │ ncba_statement│
    │ • sendMessage() │        │    .csv       │
    │ • editMessage() │        │               │
    │ • setWebhook()  │        │ backups/      │
    │                 │        │ *.json        │
    └─────────────────┘        └───────────────┘
```

---

## Data Flow Diagram

### Payment Submission Flow

```
User                 Bot                    Storage
 │                   │                        │
 ├─/receipt code────→│                        │
 │                   │                        │
 │                   ├─Check in memory───────→│
 │                   │                        │
 │                   │←─Found/Not Found───────│
 │                   │                        │
 │←─✅ Approved──────│                        │
 │  OR                                        │
 │←─⏳ Pending───────│                        │
 │                   ├─Store pending───────→ │
 │                   │                        │
```

### Admin Approval Flow

```
Admin                Bot                    Storage         User
  │                  │                        │               │
  ├─/approve code───→│                        │               │
  │                  │                        │               │
  │                  ├─Check auth (admin ID)                  │
  │                  │                        │               │
  │                  ├─Move to approved──────→│               │
  │                  │                        │               │
  │←─✅ Confirmed────│                        │               │
  │                  │                                        │
  │                  ├─Notify user──────────────────────────→│
  │                  │                        │      ✅ Approved!│
  │                  │                        │               │
```

### Daily Reconciliation Flow

```
Cron Scheduler       ncba-payment-flow    File System
  │                        │                 │
  ├─00:00 Trigger─────────→│                 │
  │                         ├─Read CSV───────→│
  │                         │      ncba_      │
  │                         │    statement.   │
  │                         │     csv         │
  │                         │                 │
  │                         │←─Receipts───────│
  │                         │                 │
  │                         ├─Parse codes     │
  │                         ├─Add to memory   │
  │                         │                 │
  │←─Complete──────────────│                 │
  │  (X receipts imported)                   │
  │                                          │
```

---

## Database Schema (In-Memory)

```javascript
// Approved Receipts (Set for O(1) lookup)
approvedReceipts = {
  "QBC123XYZ",      // M-Pesa receipt code
  "ABC456DEF",
  "XYZ789GHI",
  ...
}

// Pending Receipts (Array for tracking)
pendingReceipts = [
  {
    code: "NEW123ABC",
    timestamp: "2024-12-29T14:30:45.123Z",
    userId: 123456789         // Optional: for user notification
  },
  {
    code: "PEN456DEF",
    timestamp: "2024-12-29T15:20:10.456Z",
    userId: 987654321
  }
]

// Admin IDs (from environment)
adminIds = ["123456789", "987654321"]

// Payment Config
paybill = "880100"
ncbaAccount = "1006989273"
currency = "KSh"
defaultAmount = 100
```

---

## File Structure

```
betrix-ui/
├── src/
│   ├── bot/
│   │   ├── ncba-payment-flow.js        ← Core payment logic
│   │   ├── payment-commands.js         ← Telegraf handlers
│   │   ├── cron-scheduler.js           ← Task scheduling
│   │   ├── admin-dashboard.js          ← CLI management
│   │   ├── INTEGRATION_EXAMPLE.js      ← Integration guide
│   │   ├── payments.js                 ← Existing payment module
│   │   ├── mpesa.js                    ← Existing M-Pesa module
│   │   └── ...
│   │
│   ├── app.js                          ← Main bot file (integrate here)
│   ├── config.js                       ← Config management
│   └── ...
│
├── ncba_statement.csv                  ← NCBA statement import
├── backups/                            ← Automated backups
│   ├── backup-2024-12-29.json
│   └── ...
│
├── NCBA_PAYMENT_INTEGRATION.md         ← Integration guide
├── PAYMENT_SYSTEM_SETUP.md             ← Setup instructions
├── NCBA_PAYMENT_SYSTEM_COMPLETE.md     ← This overview
├── NCBA_PAYMENT_ARCHITECTURE.md        ← This file
├── .env                                ← Environment config
├── package.json                        ← Dependencies
└── ...
```

---

## Deployment Architecture

### Local Development
```
Laptop/Desktop
    │
    ├─ Node.js process
    │   └─ Telegraf bot
    │
    ├─ ncba_statement.csv
    └─ backups/
```

### Cloud Deployment (Render, Railway, Heroku)
```
Cloud Server
    │
    ├─ Node.js process
    │   └─ Telegraf bot
    │       └─ Webhook endpoint
    │
    ├─ File system / Volume
    │   ├─ ncba_statement.csv
    │   └─ backups/
    │
    └─ Environment variables
        ├─ TELEGRAM_TOKEN
        ├─ ADMIN_IDS
        └─ NCBA_STATEMENT_PATH
```

---

## API Integration Points

### Telegram Bot API
```
Telegraf SDK → Telegram Bot API
  ├─ sendMessage()       [Send text to user]
  ├─ editMessage()       [Edit existing message]
  ├─ sendDocument()      [Send CSV/backup file]
  ├─ setWebhook()        [Setup webhook for cloud]
  └─ getMe()            [Verify bot token]
```

### No External Payment APIs
```
❌ No Safaricom Daraja API needed
❌ No Pesapal integration needed
❌ No AirMoney dependency needed
❌ No Stripe/PayPal required

✅ Just CSV files from NCBA
✅ Manual user verification
✅ Admin approval system
```

---

## Cron Schedule

```
Time        Day                 Task
────────────────────────────────────────────────
00:00       Every day          Daily NCBA reconciliation
            (Midnight)         • Read CSV
                              • Import new receipts
                              • Log results

09:00       Every Sunday       Weekly stats report
            (Sundays)          • Count approvals
                              • Notify admin
                              • Generate report

10:00       1st of month      Monthly backup
            (1st)             • Export approved receipts
                              • Save as JSON
                              • Archive in backups/
```

---

## Security Model

### Access Control
```
Public                   Admin-Only
├─ /pay                  ├─ /approve
├─ /premium              ├─ /pending
├─ /receipt              ├─ /status
└─ /help_payment         ├─ /reconcile
                         └─ /export

Admin ID verified via ADMIN_IDS env variable
```

### Data Protection
```
In-Memory Storage
├─ approvedReceipts      [Set: O(1) lookup]
└─ pendingReceipts       [Array: Ordered]

File Storage
├─ ncba_statement.csv    [Source of truth]
└─ backups/*.json        [Recovery point]

No Encryption Needed (Local only)
```

---

## Performance Considerations

### Time Complexity
```
verifyReceipt(code)     → O(1)  [Set lookup]
approveReceipt(code)    → O(n)  [Array search for pending]
importNCBAStatements()  → O(m)  [CSV rows]
```

### Space Complexity
```
approvedReceipts        → O(n)  [n = approved count]
pendingReceipts         → O(p)  [p = pending count]
CSV import              → O(m)  [m = CSV rows]
```

### Scalability
```
✅ In-memory storage scales to ~100K receipts
✅ CSV import can handle ~10K rows per file
✅ Cron tasks run async without blocking
✅ Telegram API rate limits: 30 msg/sec
```

---

## Error Handling

### Graceful Degradation
```
Missing CSV file       → Skip reconciliation, log warning
Invalid CSV format     → Log error, continue
Telegram API error     → Retry with exponential backoff
Cron task failure      → Log error, continue schedule
Admin auth failure     → Reject, log security event
```

---

## Monitoring & Observability

### Logs (via Logger utility)
```
✅ Daily reconciliation status
❌ CSV import errors
⚠️ Missing files/config
📊 Payment statistics
🔐 Admin actions
```

### Metrics to Track
```
• Approved receipts count
• Pending receipts count
• Daily import count
• Failed imports
• Admin approvals
• User submissions
```

---

## Backup & Recovery

### Automatic Backups
```
Monthly on 1st at 10:00
├─ File: backups/approved-receipts-2024-12-01.json
├─ Content: {
│    "exported_at": "2024-12-01T10:00:00Z",
│    "count": 42,
│    "receipts": ["QBC123XYZ", ...]
│  }
└─ Retention: Keep locally or push to Git
```

### Recovery Process
```
node src/bot/admin-dashboard.js restore backups/approved-receipts-2024-12-01.json
```

---

## Integration Checklist

- [ ] Files copied to `src/bot/`
- [ ] Dependencies installed (`csv-parser`, `node-cron`)
- [ ] Environment variables configured
- [ ] NCBA CSV file created
- [ ] Code integrated into `src/app.js`
- [ ] Bot tested locally with `/pay` command
- [ ] Admin tested with `/approve` command
- [ ] Daily cron verified (check logs at 00:00)
- [ ] Deployed to production
- [ ] Monitoring logs in production
- [ ] Regular backups scheduled

---

**Architecture designed for reliability, simplicity, and transparency.**
