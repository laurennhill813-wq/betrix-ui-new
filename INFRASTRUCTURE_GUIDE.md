# BETRIX Production Bot - Complete Infrastructure Guide

## Overview

This repository contains a fully resilient, production-ready Telegram bot with integrated free sports data sources, multi-provider AI fallback chain, and advanced prefetching/caching infrastructure.

## Key Features

### 1. Resilient Multi-Provider AI Pipeline
- **Primary**: Google Gemini (with defensive handling for empty responses and MAX_TOKENS retry)
- **Fallback Chain**: Azure AI → HuggingFace → LocalAI (graceful degradation)
- **Per-user token trimming** to stay within model prompt budgets
- **Observability**: Redis key `ai:active` tracks which provider is currently active

### 2. Free Live Data Integration
- **OpenLigaDB**: No-auth JSON API for matches, leagues, standings (30-second cache TTL)
- **RSS Feeds**: BBC, Guardian, ESPN football headlines (60-second cache TTL)
- **ScoreBat**: Free video highlights and featured feeds (60-second cache TTL)
- **football-data.co.uk CSVs**: Historical fixtures, results, odds (1-hour cache TTL)
- **Polite Scrapers**: FBref/Understat with robots.txt respect (optional, low TTL)

### 3. Prefetch Scheduler
- Runs in the worker process on configurable interval (default 60 seconds)
- Warms caches in Redis for all free-data sources
- Publishes `prefetch:updates` and `prefetch:error` events via pub/sub
- **Exponential backoff** on repeated failures to protect providers (configurable max backoff: default 1 hour)
- Publishes per-source failure counts and next-retry timestamps

### 4. Centralized Cache Service
- `src/services/cache.js`: Simple wrapper around Redis for `get`, `set`, and `rateLimit`
- Built-in token-bucket rate limiting per source/host
- Standardized TTL handling and error recovery
- Wired into `OpenLigaDBService` and `RSSAggregator` for consistent caching

### 5. Real-time WebSocket Integration
- Web server (`src/app.js`) subscribes to `prefetch:updates` and `prefetch:error`
- Broadcasts prefetch events to connected WebSocket clients in real-time
- Enables dashboards and UIs to stay synchronized with data freshness

### 6. Unit Tests
- `tests/rss-aggregator.test.js`: Instantiation and cache setup tests
- `tests/openligadb.test.js`: Configuration and cache injection tests
- Run tests with `npm test` (uses Node.js built-in test runner)

---

## Configuration & Environment Variables

### Core Bot & Services
```env
# Telegram
TELEGRAM_TOKEN=your_bot_token
TELEGRAM_WEBHOOK_SECRET=your_webhook_secret
TELEGRAM_ADMIN_ID=your_admin_id

# Redis
REDIS_URL=redis://default:@localhost:6379

# AI Providers
GEMINI_API_KEY=your_gemini_key
AZURE_ENDPOINT=https://your-instance.openai.azure.com/
AZURE_KEY=your_azure_key
AZURE_DEPLOYMENT=your_deployment_name
HUGGINGFACE_TOKEN=your_hf_token
HUGGINGFACE_MODEL=model_identifier

# Node & Environment
PORT=5000
NODE_ENV=production
```

### Prefetch Scheduler (optional, use defaults)
```env
# Interval between prefetch runs (seconds). Warning: <10s may stress providers.
PREFETCH_INTERVAL_SECONDS=60

# Exponential backoff settings
PREFETCH_BASE_BACKOFF_SECONDS=60      # Initial backoff after first failure
PREFETCH_MAX_BACKOFF_SECONDS=3600     # Maximum backoff (1 hour)
```

### Optional: ScoreBat & Scraper Tokens
```env
SCOREBAT_TOKEN=your_scorebat_token    # Optional; free tier works without it
```

---

## Running the Application

### Install Dependencies
```bash
npm install
```

### Run Tests
```bash
npm test
```

Expected output:
```
✔ OpenLigaDBService instantiates without cache (6.7ms)
✔ OpenLigaDBService instantiates with CacheService (0.7ms)
✔ RSSAggregator instantiates without cache (4.8ms)
✔ RSSAggregator instantiates with cache (0.6ms)
```

### Start the Worker (Background Queue Processor)
```bash
node src/worker-final.js
```

The worker will:
1. Connect to Redis and establish heartbeat (`worker:heartbeat` key, refreshed every 10 seconds)
2. Start the prefetch scheduler (interval: `PREFETCH_INTERVAL_SECONDS`)
3. Listen for Telegram updates on the Redis queue `telegram:updates`
4. Process each update through handlers with fallback AI providers
5. Subscribe to prefetch pub/sub channels for internal observability

### Start the Web Server (Express + WebSocket)
```bash
node src/app.js
# or via npm script (if defined):
npm start
```

The server will:
1. Serve HTTP endpoints: `/live`, `/standings`, `/fixtures`, `/news`, `/highlights`
2. Accept WebSocket connections at `ws://<host>:<port>/`
3. Subscribe to `prefetch:updates` and `prefetch:error` channels
4. Broadcast prefetch events to connected WebSocket clients

---

## Architecture & Data Flow

### Prefetch Pipeline
```
Worker → Prefetch Scheduler (every 60s)
  ├─ RSS Aggregator (BBC/Guardian/ESPN)
  │  └─ Cache to Redis: `prefetch:rss:football` (60s TTL)
  │     Publish: `prefetch:updates` {type: 'rss', ts}
  │
  ├─ OpenLigaDB Client (leagues, recent matches)
  │  └─ Cache: `prefetch:openligadb:leagues` (120s), `prefetch:openligadb:recent:*` (30s)
  │     Publish: `prefetch:updates` {type: 'openligadb', ts}
  │
  ├─ ScoreBat Free Feed (highlights)
  │  └─ Cache: `prefetch:scorebat:free` (60s)
  │     Publish: `prefetch:updates` {type: 'scorebat', ts}
  │
  └─ football-data CSVs (E0/SP1 samples)
     └─ Cache: `prefetch:footballdata:E0:2324`, etc. (1h TTL)
        Publish: `prefetch:updates` {type: 'footballdata', ts}

On Failure (all sources):
  → Record failure count: `prefetch:failures:{type}` (24h expire)
  → Compute delay: 2^(failCount-1) * base (capped at max backoff)
  → Set next retry time: `prefetch:next:{type}`
  → Publish: `prefetch:error` {type, error, ts}
```

### Redis Pub/Sub Subscribers
1. **Web Process** (`src/app.js`):
   - Subscribes to `prefetch:updates`, `prefetch:error`
   - Broadcasts to connected WebSocket clients

2. **Worker Process** (`src/worker-final.js`):
   - Subscribes to `prefetch:updates`, `prefetch:error`
   - Logs events and optionally performs reactive caching (example: touch `prefetch:last:openligadb`)

### Telegram Update Queue
- **Queue Key**: `telegram:updates` (Redis list)
- **Processing Key**: `telegram:processing` (BRPOPLPUSH for at-least-once delivery)
- **Workflow**:
  1. Webhook receives update → pushed to `telegram:updates`
  2. Worker dequeues via BRPOPLPUSH → moved to `telegram:processing`
  3. Handler processes update (may fail)
  4. After successful handling, item removed from `telegram:processing`
  5. On startup, worker re-queues any lingering items in `telegram:processing` (at-least-once semantics)

---

## Cache Service & Rate Limiting

### CacheService API
```javascript
import CacheService from './src/services/cache.js';

const cache = new CacheService(redisInstance);

// Simple get/set
await cache.get(key);              // → value or null
await cache.set(key, value, 60);   // → store with 60s TTL

// Token-bucket rate limiting
const allowed = await cache.rateLimit('mykey', 30, 60); // 30 reqs per 60s
// → true if allowed, false if exceeded
```

### Integration in Services
```javascript
// OpenLigaDB with cache
const openLiga = new OpenLigaDBService(baseUrl, cache, {
  ttlSeconds: 30,
  rateLimit: 60,           // requests per window
  rateWindowSeconds: 60    // window duration
});

// RSSAggregator with cache
const rss = new RSSAggregator(cache, {
  ttlSeconds: 60,
  rateLimit: 30,
  rateWindowSeconds: 60
});
```

---

## Monitoring & Observability

### Key Redis Keys to Watch
```redis
# Prefetch scheduler state
GET prefetch:last:openligadb
GET prefetch:failures:rss
GET prefetch:next:scorebat

# AI provider status
GET ai:active                    # → 'gemini', 'azure', 'huggingface', 'local'

# Worker heartbeat (expires after 30s)
GET worker:heartbeat            # → timestamp

# System logs (Redis list)
LRANGE system:logs 0 -100       # → last 100 log entries
```

### WebSocket Client Example
```javascript
const ws = new WebSocket('ws://localhost:5000/');

ws.addEventListener('open', () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    channels: ['prefetch:updates', 'prefetch:error']
  }));
});

ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);
  console.log('Event:', msg.type, msg.data);
  // → {type: 'prefetch:updates', data: {type: 'rss', ts: 1700000000}}
});
```

---

## Legal & Compliance

See `LEGAL.md` for high-level reuse guidance on integrated free data sources:
- Wikipedia (CC BY-SA): attribute and use short summaries
- OpenLigaDB: check license and attribution requirements
- RSS feeds (BBC/Guardian): snippet usage OK, full article reuse restricted
- ScoreBat: respect ToS, use embeds when possible
- football-data.co.uk: verify license per CSV before commercial use
- FBref/Understat: respect robots.txt and rate limits

---

## Prefetch Policy

See `PREFETCH_POLICY.md` for recommended intervals and operational guidance:
- **Default**: 60 seconds (balanced)
- **Recommended range**: 15–60 seconds
- **Aggressive** (<10s): not recommended without provider permission
- **Backoff**: automatically triggers on repeated failures (exponential, capped)

---

## Troubleshooting

### Prefetch Scheduler Not Running
1. Check worker logs: `node src/worker-final.js`
2. Verify Redis connection: `redis-cli PING`
3. Check `PREFETCH_INTERVAL_SECONDS` env var (should be a number)

### Bot Returns "No Live Data"
1. Check if prefetch caches are warming: `LRANGE system:logs 0 -5`
2. Verify free data sources are responding: check `PREFETCH_ERROR` pub/sub events
3. Increase `PREFETCH_INTERVAL_SECONDS` and restart worker if providers are rate-limiting

### AI Responses Empty
1. Check `ai:active` key to see which provider is being used
2. If Gemini: verify `GEMINI_API_KEY` is set
3. Check admin endpoint: `GET /admin/gemini-debug` (requires basic auth)
4. Fallback to LocalAI if all paid providers fail

### WebSocket Clients Not Receiving Prefetch Events
1. Verify web server is running: `curl http://localhost:5000/health`
2. Check WebSocket connection: browser DevTools → Network → WS
3. Ensure you're sending subscribe message after connection
4. Check server logs for pub/sub subscriber errors

---

## Next Steps & Recommendations

1. **Deploy to Production**:
   - Use Render, Heroku, or Railway for web server
   - Use separate dyno/instance for worker
   - Set all env vars on the platform (no secrets in repo)

2. **Monitoring at Scale**:
   - Add metrics collection for prefetch success/failure rates
   - Set up alerting on `prefetch:error` spike
   - Monitor AI provider latency and fallback rates

3. **Custom Integrations**:
   - Add handlers for other sports (cricket, baseball, etc.)
   - Wire in additional free data sources (ESPN API, StatsBomb, Opta)
   - Implement user-specific preferences and caching

4. **Performance Tuning**:
   - Adjust TTLs based on provider update frequency
   - Experiment with prefetch intervals (measure API response times)
   - Add Redis persistence (`RDB` or `AOF`) for fault tolerance

---

## Support & Questions

- **Logs**: Check Redis list `system:logs` for application events
- **Heartbeat**: Worker status available via `worker:heartbeat` Redis key (updated every 10s)
- **Admin Endpoints**:
  - `GET /admin/gemini-debug` - Raw Gemini test (basic auth required)
  - `GET /admin/ai-test` - Composite AI chain test
  - `GET /health` - Overall system health
  - `GET /metrics` - Uptime and log count

---

*BETRIX Production Bot v3.0 — Intelligent Sports Betting Analytics*
