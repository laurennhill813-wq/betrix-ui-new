# NCBA Payment System - Dependencies & Setup

## Required npm Packages

Add these to your `package.json`:

```json
{
  "dependencies": {
    "telegraf": "^4.14.0",
    "csv-parser": "^3.0.0",
    "node-cron": "^3.0.2",
    "uuid": "^9.0.0",
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.0"
  }
}
```

## Installation

```bash
# Install all dependencies
npm install

# Install only payment system dependencies
npm install csv-parser node-cron

# Development setup
npm install --save-dev nodemon
```

## Package Details

| Package | Version | Purpose |
|---------|---------|---------|
| `telegraf` | ^4.14.0 | Telegram bot framework |
| `csv-parser` | ^3.0.0 | Parse NCBA CSV statements |
| `node-cron` | ^3.0.2 | Schedule daily reconciliation |
| `uuid` | ^9.0.0 | Generate unique IDs |
| `dotenv` | ^16.0.0 | Load environment variables |
| `nodemon` | ^3.0.0 | Auto-reload during development |

## Version Compatibility

This system requires:
- **Node.js**: 14.0.0 or higher
- **npm**: 6.0.0 or higher
- **Telegraf**: 4.0.0 or higher

## Installation Commands

```bash
# Full installation
npm install

# Specific packages
npm install telegraf
npm install csv-parser
npm install node-cron

# Global tools (optional)
npm install -g nodemon
npm install -g pm2  # for production process management
```

## Environment Setup

Create a `.env` file in your project root:

```env
# Telegram Bot
TELEGRAM_TOKEN=your_bot_token_here
BOT_USERNAME=your_bot_username

# Admin Configuration
ADMIN_IDS=123456789,987654321

# Payment Configuration
NCBA_STATEMENT_PATH=./ncba_statement.csv

# Database (if using)
DATABASE_URL=your_database_url

# Node Environment
NODE_ENV=development
```

## Testing Installation

```bash
# Check Node version
node --version
# Expected: v14.0.0 or higher

# Check npm version
npm --version
# Expected: v6.0.0 or higher

# Verify packages
npm list
# Should show installed packages including csv-parser and node-cron
```

## Start Bot

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start

# With PM2 (for server deployments)
pm2 start src/app.js --name "betrix-bot"
```

## Troubleshooting

### "csv-parser not found"
```bash
npm install csv-parser
```

### "node-cron not found"
```bash
npm install node-cron
```

### "Telegraf not found"
```bash
npm install telegraf
```

### Port already in use
```bash
# Change PORT in .env or terminal
PORT=3001 npm start
```

## Next Steps

1. ✅ Install dependencies: `npm install`
2. ✅ Create `.env` file with configuration
3. ✅ Update `src/app.js` with integration code
4. ✅ Create `ncba_statement.csv` with sample data
5. ✅ Start bot: `npm start`
6. ✅ Test commands in Telegram

---

**Built for BETRIXAI Payment System**
