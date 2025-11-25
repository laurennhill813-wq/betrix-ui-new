# BETRIX Complete Command & Endpoint Audit

**Last Updated:** November 25, 2025  
**Build Version:** 3.0.0  
**Deployment Target:** Render (Web + Background Worker)

---

## Table of Contents
1. [Bot Commands (Telegram)](#bot-commands-telegram)
2. [Callback Buttons](#callback-buttons)
3. [HTTP Endpoints](#http-endpoints)
4. [AI Provider Usage](#ai-provider-usage)
5. [Request Flow](#request-flow)
6. [Redis Queue & Processing](#redis-queue--processing)

---

## Bot Commands (Telegram)

All commands are routed through the background worker (`src/worker-final.js`). The worker receives Telegram updates from the web server via Redis queue `telegram:updates`.

### Basic Commands (Available to all users)

| Command | Handler | AI Usage | Response Type | Notes |
|---------|---------|----------|---------------|-------|
| `/start` | `basicHandlers.start()` | Gemini (if signup complete) | Text | Personalized greeting or new user intro |
| `/menu` | `basicHandlers.menu()` | None | Text + Inline KB | Lists all available commands with buttons |
| `/help` | `basicHandlers.help()` | None | Text | Command reference guide |
| `/about` | `basicHandlers.about()` | None | Text | Platform info + random meme |
| `/live` | `basicHandlers.live()` | Gemini (fallback) | Text | Current live matches (API Football) |
| `/standings [league]` | `basicHandlers.standings()` | Gemini (fallback) | Text | League standings table (API Football) |
| `/odds [fixture-id]` | `basicHandlers.odds()` | Gemini (fallback) | Text | Betting odds for fixture (API Football) |
| `/tips` | `basicHandlers.tips()` | Gemini | Text | Betting strategy tips (AI-expanded) |
| `/analyze [match]` | `basicHandlers.analyze()` | Gemini | Text | AI match analysis (custom prompt) |
| `/pricing` | `basicHandlers.pricing()` | None | Text + Inline KB | Pricing tiers + subscribe/signup buttons |
| `/status` | `basicHandlers.status()` | None | Text | User profile (members only) |
| `/refer` | `basicHandlers.refer()` | None | Text | Referral code + rewards info |
| `/leaderboard` | `basicHandlers.leaderboard()` | None | Text | Top referrers ranking |
| `/signup` | `basicHandlers.signup()` | None | Text + State | Starts 2-step signup (name→country) |

**Special:** Natural language (non-command text) → Composite AI chain (Gemini → HuggingFace → LocalAI)

### Advanced Commands (Members only, `user.signupComplete`)

| Command | Handler | AI Usage | Response Type | Notes |
|---------|---------|----------|---------------|-------|
| `/stats` | `advancedHandler.handleStats()` | None | Text | User analytics + top commands |
| `/predict home vs away` | `advancedHandler.handlePredictAdvanced()` | PredictionEngine + Gemini | Text | Match prediction with confidence % |
| `/insights` | `advancedHandler.handleInsights()` | Gemini + PredictionEngine | Text | Personalized betting recommendations |
| `/compete` | `advancedHandler.handleCompete()` | None (reads Redis) | Text | Prediction leaderboard |

### Premium Commands (VVIP only, `user.role === 'vvip'`)

| Command | Handler | AI Usage | Response Type | Notes |
|---------|---------|----------|---------------|-------|
| `/dossier [match]` | `premiumService.generateMatchDossier()` | Gemini/AI | Text | Full match dossier (advanced analysis) |
| `/coach` | `premiumService.getCoachAdvice()` | Gemini/AI | Text | Personalized coaching advice |
| `/trends [league]` | `premiumService.analyzeSeasonalTrends()` | Gemini/AI | Text | Seasonal trend analysis |
| `/premium` | → `/pricing` | None | Text + KB | Same as pricing |

### Admin Commands (Admin only, `userId === CONFIG.TELEGRAM.ADMIN_ID`)

| Command | Handler | AI Usage | Response Type | Notes |
|---------|---------|----------|---------------|-------|
| `/admin_health` | `adminDashboard.sendHealthReport()` | None | Text | System health report |
| `/admin_broadcast [msg]` | `adminDashboard.broadcastMessage()` | None | Text | Sends message to all users |
| `/admin_users` | `adminDashboard.getUserStats()` | None | Text | User statistics |
| `/admin_suspend [userid] [reason]` | `adminDashboard.suspendUser()` | None | Text | Suspend a user |
| `/admin_revenue` | `adminDashboard.getRevenueMetrics()` | None | Text | Revenue metrics (today/month/total) |

### Signup Flow (Multi-step state machine)

1. **State: "name"** (triggered by `/signup`)
   - User types name → saved to DB, state → "country"
   - Bot asks: "Which country are you from?"

2. **State: "country"**
   - User types country → saved to DB, creates referral code, sets `signupComplete: true`
   - Bot sends welcome message with next steps

---

## Callback Buttons

Inline keyboard callbacks are routed in `handleCallback()` in the worker:

| Callback Data | Handler | Action | Notes |
|---------------|---------|--------|-------|
| `CMD:live` | `basicHandlers.live()` | Show live matches | From /menu button |
| `CMD:standings` | `basicHandlers.standings()` | Show standings | From /menu button |
| `CMD:tips` | `basicHandlers.tips()` | Show tips | From /menu button |
| `CMD:pricing` | `basicHandlers.pricing()` | Show pricing | From /menu button |
| `CMD:subscribe` | → `/pricing` | Show pricing (VVIP upgrade) | From /pricing button |
| `CMD:signup` | `basicHandlers.signup()` | Start signup | From /pricing button or /menu |

---

## HTTP Endpoints

All HTTP endpoints are in `src/app.js`. The web server listens on port 5000 (Render default).

### Public Endpoints (No auth)

| Endpoint | Method | Rate Limit | Purpose | Response |
|----------|--------|------------|---------|----------|
| `/` | GET | None | Root / brand info | JSON: brand name, version, endpoints list |
| `/health` | GET | None | Health check | JSON: `{ status: "healthy", redis: true, version }` |
| `/metrics` | GET | None | Basic metrics | JSON: uptime, log count |
| `/pricing` | GET | None | Pricing tiers | JSON: tier pricing info |
| `/dashboard` | GET | Tier-based | Dashboard data | JSON: brand menu, stats |
| `/predictions` | GET | Tier-based | Predictions scaffold | JSON: sample predictions |
| `/odds` | GET | Tier-based | Odds scaffold | JSON: sample odds |
| `/leaderboard` | GET | Tier-based | Leaderboard scaffold | JSON: sample leaderboard |
| `/analytics` | GET | Tier-based | Analytics scaffold | JSON: DAU, total predictions |
| `/user/:userId/stats` | GET | Tier-based | User stats | JSON: bets, wins, win rate |
| `/user/:userId/referrals` | GET | Tier-based | User referrals | JSON: referral count, earnings |
| `/paypal/checkout` | GET | Tier-based | PayPal checkout page | HTML: checkout page |
| `/webhook/:token?` | POST | Tier-based | **Telegram Webhook** | Returns "OK" (200) on success |

### Admin Endpoints (Basic Auth required)

| Endpoint | Method | Purpose | Response | Notes |
|----------|--------|---------|----------|-------|
| `/admin` | GET | Admin overview | JSON: recent logs, admin menu | Lists last 20 logs |
| `/admin/queue` | GET | Queue status | JSON: `telegram_updates`, `telegram_callbacks`, `worker_heartbeat` | No auth required for this |
| `/admin/webhook-info` | GET | Telegram webhook status | JSON: webhook info from Telegram API | No auth required for this |
| `/admin/ai-health` | GET | AI provider status | JSON: `geminiEnabled`, `huggingfaceEnabled`, `huggingfaceModels`, `lastActive` | No auth required for this |
| `/admin/ai-test` | POST | **Test AI chain** | JSON: `{ provider, model, response }` | Runs test prompt through Gemini→HF→Local |
| `/admin/settings` | POST | Update settings | JSON: updated settings | With file upload (logo) |
| `/audit` | GET | Audit logs | JSON: last 20 audit logs | Admin-only |

### Webhook Details

**`POST /webhook/:token?`**

- **Purpose:** Receive Telegram webhook updates (messages, callbacks)
- **Auth:** Header validation via `X-Telegram-Bot-Api-Secret-Token` (if `TELEGRAM_WEBHOOK_SECRET` set)
- **Flow:**
  1. Web server validates secret token header
  2. Extracts update payload
  3. Pushes to Redis queue `telegram:updates` via `queueJob("telegram:update", payload)`
  4. Returns 200 "OK" immediately
  5. Background worker picks up from `telegram:updates`, processes, sends reply via Telegram API

---

## AI Provider Usage

### AI Chain (Composite Fallback)

**Primary:** Gemini 1.5 Flash (Google Generative AI)  
**Secondary:** Hugging Face (optional, router-based)  
**Fallback:** LocalAI (DuckDuckGo + canned responses)

**Chain Logic (in `src/worker-final.js`, `ai` object):**

```
Request → Gemini (if enabled)
         ↓ (on error)
         → HuggingFace (if HUGGINGFACE_MODELS set)
         ↓ (on error)
         → LocalAI (always available)
         ↓ (on error)
         → Hardcoded fallback response
```

### When Each Provider Is Used

| Handler | AI Provider | Trigger |
|---------|-------------|---------|
| `/start` (returning user) | Gemini | Personalized greeting |
| `/live` (no matches) | Gemini | Friendly fallback message |
| `/standings` (no data) | Gemini | Fallback message |
| `/odds` (no odds) | Gemini | Fallback message |
| `/tips` | Gemini | Expand strategy tips |
| `/analyze [match]` | Gemini | Custom match analysis prompt |
| `/stats` | None (analytics only) | N/A |
| `/predict` | PredictionEngine + Gemini | Prediction generation |
| `/insights` | Gemini + PredictionEngine | Personalized insights |
| Natural language text | **AI Chain** | Composite (Gemini→HF→Local) |
| `/dossier`, `/coach`, `/trends` | Gemini/AI | Premium handlers |
| Admin endpoints (most) | None | System/data endpoints |

### AI Health Monitoring

- **Endpoint:** `GET /admin/ai-health` (no auth)
- **Response:**
  ```json
  {
    "geminiEnabled": true,
    "huggingfaceEnabled": false,
    "huggingfaceModels": [],
    "localEnabled": true,
    "lastActive": "gemini" or "huggingface" or "local" or null
  }
  ```
- **Redis Key:** `ai:active` (TTL 30s, updated per request in worker)

---

## Request Flow

### Telegram Message → Response

```
1. User sends message on Telegram Bot
   ↓
2. Telegram servers → POST /webhook/:token with update
   ↓
3. Web server validates header secret
   ↓
4. Web server calls queueJob("telegram:update", update) 
   → Redis RPUSH "telegram:updates" + JSON.stringify(update)
   ↓
5. Web server returns 200 "OK"
   ↓
6. Background worker (BRPOPLPUSH "telegram:updates" → "telegram:processing")
   ↓
7. Worker parses update.message or update.callback_query
   ↓
8. parseCommand() extracts command and args
   ↓
9. handleCommand() routes to handler (basic/advanced/premium/admin)
   ↓
10. Handler calls Telegram API or AI service
   ↓
11. telegram.sendMessage(chatId, response) sends reply
   ↓
12. Worker removes update from "telegram:processing" (LREM)
   ↓
13. User receives reply on Telegram
```

### Natural Language Message Flow

```
User: "Who will win the Liverpool vs Man City match?"
   ↓
Web receives via /webhook
   ↓
Worker parses: NOT a command (no "/" prefix)
   ↓
Calls: ai.chat(message, userContext)
   ↓
AI Chain:
  - Try: Gemini (if GEMINI_API_KEY set)
     ✓ Success? Return response → telegram.sendMessage()
     ✗ Error? → Next
  - Try: HuggingFace (if HUGGINGFACE_MODELS set)
     ✓ Success? Return response → telegram.sendMessage()
     ✗ Error? → Next
  - Try: LocalAI (always available)
     ✓ Success? Return response → telegram.sendMessage()
     ✗ Error? → Hardcoded fallback
   ↓
User receives reply
```

---

## Redis Queue & Processing

### Queue Structure

| Key | Type | Purpose | TTL |
|-----|------|---------|-----|
| `telegram:updates` | List | Incoming updates from webhook (FIFO queue) | None (persistent) |
| `telegram:processing` | List | In-flight updates (BRPOPLPUSH ack pattern) | None (persistent) |
| `telegram:callbacks` | List | Legacy callback queue | None (persistent) |
| `worker:heartbeat` | String | Worker liveness timestamp | 30s |
| `ai:active` | String | Last active AI provider (gemini/huggingface/local) | 30s |
| `signup:${userId}:state` | String | Current signup flow step (name/country) | 300s |
| `admin:password` | String | Bcrypt hash of admin password | None (persistent) |
| `user:*` | Hash/String | User profile data | None (persistent) |
| `admin:settings` | String (JSON) | Admin configuration | None (persistent) |
| `system:logs` | List | Application logs | LTRIM to 2000 entries |

### Worker Processing (BRPOPLPUSH pattern)

1. **Startup:** Requeue any items stuck in `telegram:processing` back to `telegram:updates`
2. **Poll:** `BRPOPLPUSH telegram:updates telegram:processing 5` (5s timeout)
3. **Process:** Handle the update (route command, call handler, send reply)
4. **Ack:** `LREM telegram:processing 1 <raw>` to remove processed item
5. **Repeat:** Go to step 2

### Graceful Shutdown

- On SIGTERM/SIGINT: Set `running = false`
- Wait max 5s for current job to finish
- Close Redis connection
- Exit process

---

## Summary Table: All Commands + Endpoints

| Type | Count | Examples |
|------|-------|----------|
| **Basic Bot Commands** | 13 | /start, /menu, /live, /standings, /odds, /tips, /analyze, /pricing, /status, /refer, /leaderboard, /signup, /help |
| **Advanced Commands** | 4 | /stats, /predict, /insights, /compete |
| **Premium Commands** | 4 | /dossier, /coach, /trends, /premium |
| **Admin Commands** | 5 | /admin_health, /admin_broadcast, /admin_users, /admin_suspend, /admin_revenue |
| **Callbacks** | 6 | CMD:live, CMD:standings, CMD:tips, CMD:pricing, CMD:subscribe, CMD:signup |
| **HTTP Endpoints** | 21 | /, /health, /metrics, /pricing, /webhook, /admin/*, /predictions, /odds, /analytics, /leaderboard, /user/*, /audit, /paypal/checkout |
| **Admin HTTP Endpoints** | 6 | /admin, /admin/queue, /admin/webhook-info, /admin/ai-health, /admin/ai-test, /admin/settings |
| **Natural Language** | Unlimited | Any text without "/" prefix |

---

## Known Issues & Notes

1. **HuggingFace Model Discovery:**
   - Public router endpoints (router.huggingface.co) returned 404 for candidate models
   - Requires either:
     - Deployment of HF Inference Endpoint, or
     - Use of LocalAI fallback
   - Currently disabled in production but code supports it

2. **Rate Limiting:**
   - Free tier: 30 req/min
   - Member tier: 60 req/min
   - VVIP tier: 150 req/min
   - Admin tier: 300 req/min

3. **Timeout & Fallbacks:**
   - HF call timeout: 20s
   - If handler fails: Returns error message "❌ Error processing command. Try /menu"
   - If Gemini fails: Falls back through chain

4. **Admin Authentication:**
   - Basic Auth header required (username/password from env)
   - Password stored as bcrypt hash in Redis
   - Set via ADMIN_USERNAME, ADMIN_PASSWORD env vars

---

## Deployment Checklist

- [ ] Set TELEGRAM_TOKEN
- [ ] Set TELEGRAM_WEBHOOK_URL
- [ ] Set TELEGRAM_WEBHOOK_SECRET (optional but recommended)
- [ ] Set REDIS_URL
- [ ] Set GEMINI_API_KEY (optional; falls back to LocalAI if missing)
- [ ] Set HUGGINGFACE_MODELS (optional; if set, worker will try HF)
- [ ] Set HUGGINGFACE_TOKEN (if using HF)
- [ ] Set ADMIN_USERNAME and ADMIN_PASSWORD (for /admin endpoints)
- [ ] Redeploy web and background worker services
- [ ] Verify: `GET /health` returns 200
- [ ] Verify: `GET /admin/queue` shows zero in telegram_updates
- [ ] Verify: `GET /admin/ai-health` shows AI status

---

**End of Audit Report**
