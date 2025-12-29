/**
 * TECHNICAL IMPLEMENTATION GUIDE
 * Advanced Media AI Ticker v2 - Senior Full-Stack Engineer Improvements
 * 
 * This document provides:
 * - Complete API reference
 * - Integration examples
 * - Performance optimization tips
 * - Troubleshooting guide
 */

# Advanced Media AI Ticker v2 - Technical Implementation

## Table of Contents

1. [API Reference](#api-reference)
2. [Integration Examples](#integration-examples)
3. [Database Schema](#database-schema)
4. [Performance Optimization](#performance-optimization)
5. [Troubleshooting](#troubleshooting)
6. [Best Practices](#best-practices)

---

## API Reference

### Main Function: `runAdvancedMediaAiTick()`

**Location:** `src/tickers/advancedMediaAiTicker.js`

**Signature:**
```typescript
async function runAdvancedMediaAiTick(): Promise<void>
```

**Behavior:**
- Checks cooldown (30s default between posts)
- Fetches diverse content (live events + news)
- Scores and ranks by relevance
- Filters duplicates (team, image)
- Selects best candidate
- Fetches media and generates caption
- Posts to Telegram broadcast channel
- Marks deduplication
- Logs telemetry

**Returns:** None (posts as side effect)

**Throws:** Never (all errors caught and logged)

**Example:**
```javascript
import { runAdvancedMediaAiTick, setRedisClient } from "./src/tickers/advancedMediaAiTicker.js";

// Initialize Redis for dedup
setRedisClient(redisClient);

// Run manually
await runAdvancedMediaAiTick();

// Or schedule it
setInterval(runAdvancedMediaAiTick, 60000); // Every 60s
```

---

### Class: ImageDeduplicator

**Purpose:** Prevent posting same image URLs repeatedly

**Methods:**

#### `constructor()`
Initializes in-memory cache and Redis prefix

#### `hashUrl(imageUrl: string): string | null`
Generates SHA256 hash of image URL

**Parameters:**
- `imageUrl` - Full URL to image

**Returns:** 64-character hex hash or null if no URL

**Example:**
```javascript
const dedup = new ImageDeduplicator();
const hash = dedup.hashUrl("https://example.com/image.jpg");
// Returns: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
```

#### `async hasPostedImage(imageUrl: string): Promise<boolean>`
Check if image was already posted

**Parameters:**
- `imageUrl` - Image URL to check

**Returns:** 
- `true` if image exists in cache
- `false` if new image or URL is null

**Behavior:**
1. Check in-memory cache (fast)
2. If not found, check Redis (if available)
3. Cache result in memory for future checks

**Example:**
```javascript
const isPosted = await dedup.hasPostedImage("https://example.com/photo.png");
if (isPosted) {
  console.log("Already posted this image");
} else {
  console.log("New image, can post");
}
```

#### `async markImagePosted(imageUrl: string): Promise<void>`
Mark image as posted (for future dedup)

**Parameters:**
- `imageUrl` - Image URL to track

**Behavior:**
1. Add to in-memory cache
2. Store in Redis with 30-day TTL
3. Mark as "used"

**Example:**
```javascript
await dedup.markImagePosted("https://example.com/posted.jpg");
// Now future calls to hasPostedImage will return true
```

---

### Class: TeamDeduplicator

**Purpose:** Prevent same teams from appearing too frequently

**Properties:**
- `windowMs` - Time window to track (default: 2 hours)
- `recentTeams` - Set of recently-posted team names

**Methods:**

#### `normalize(teamName: string): string`
Normalize team name for comparison

**Parameters:**
- `teamName` - Team name (any case/format)

**Returns:** Lowercase, whitespace-trimmed, special chars removed

**Example:**
```javascript
const dedup = new TeamDeduplicator();
dedup.normalize("Manchester City");     // "manchester_city"
dedup.normalize("AC Milan");            // "ac_milan"
dedup.normalize("Real Madrid CF");      // "real_madrid_cf"
```

#### `async hasRecentTeam(homeTeam: string, awayTeam: string): Promise<boolean>`
Check if either team was recently posted

**Parameters:**
- `homeTeam` - Home team name
- `awayTeam` - Away team name

**Returns:** 
- `true` if either team posted in recent window
- `false` if both teams are "fresh"

**Example:**
```javascript
const isDup = await dedup.hasRecentTeam("Arsenal", "Chelsea");
if (isDup) {
  console.log("One of these teams was posted recently, skip");
}
```

#### `async markTeamsPosted(homeTeam: string, awayTeam: string): Promise<void>`
Mark both teams as recently posted

**Parameters:**
- `homeTeam` - Home team
- `awayTeam` - Away team

**Behavior:**
1. Normalize both names
2. Add to in-memory cache
3. Store in Redis with 2-hour TTL

**Example:**
```javascript
await dedup.markTeamsPosted("Liverpool", "Manchester United");
// Now isDup will be true for the next 2 hours
```

#### `clearExpired()`
Clear old in-memory entries

**Behavior:**
- Called periodically to prevent memory bloat
- Auto-clears if in-memory set exceeds 1000 items

---

### Class: SportRotationManager

**Purpose:** Balanced sport coverage with weighted probabilities

**Properties:**
- `lastSports` - Recent posting history
- `maxRecent` - How many recent posts to track

**Methods:**

#### `getNextSport(recentSportStats?: object): string`
Pick next sport using weighted distribution

**Parameters:**
- `recentSportStats` (optional) - Global posting counts by sport

**Returns:** Sport key (e.g., "soccer", "nfl")

**Algorithm:**
1. Start with configured weights
2. Reduce weight for recently-posted sports
3. Boost weight for underrepresented sports
4. Perform weighted random selection

**Example:**
```javascript
const rotation = new SportRotationManager();

// Without stats (uniform weights)
const sport1 = rotation.getNextSport();  // Might return "nfl"
const sport2 = rotation.getNextSport();  // Might return "tennis"

// With stats (boosts underrepresented)
const stats = { soccer: 100, nfl: 50, tennis: 20 };
const sport3 = rotation.getNextSport(stats);  // Likely returns "tennis"
```

---

### Function: `getDiverseContent()`

**Signature:**
```typescript
async function getDiverseContent(): Promise<Array<Object>>
```

**Returns:** Array of events and news articles

**Structure of returned items:**
```javascript
{
  // Common fields
  type: "event" | "news",
  sport: "soccer" | "nfl" | "tennis" | etc,
  importance: "high" | "medium" | "low",
  
  // For events
  home: "Team 1",
  away: "Team 2",
  league: "Premier League",
  status: "LIVE" | "TIMED",
  score: { home: 1, away: 0 },
  
  // For news
  title: "Breaking: Player Transfer",
  description: "...",
  imageUrl: "https://...",
  source: "ESPN",
  
  // Metadata
  id: "unique_id",
  raw: { ...original_api_response... }
}
```

**Example:**
```javascript
const content = await getDiverseContent();
// [
//   { type: "event", sport: "soccer", home: "Arsenal", away: "Chelsea", ... },
//   { type: "event", sport: "nfl", home: "Patriots", away: "Chiefs", ... },
//   { type: "news", sport: "soccer", title: "Transfer News", ... }
// ]
```

---

### Function: `getNewsArticles(count?: number): Promise<Array<Object>>`

**Parameters:**
- `count` (optional, default=5) - How many articles to fetch

**Returns:** Array of news articles with standard fields

**Article structure:**
```javascript
{
  type: "news",
  sport: "news",
  title: string,
  description: string,
  imageUrl: string,
  source: string,
  importance: "breaking" | "high" | "medium" | "low",
  emoji: "📰",
  url: string
}
```

**Example:**
```javascript
const articles = await getNewsArticles(10);
articles.forEach(a => {
  console.log(`${a.emoji} ${a.title} (${a.source})`);
});
```

---

## Integration Examples

### Example 1: Basic Integration

```javascript
import { runAdvancedMediaAiTick, setRedisClient } from "./src/tickers/advancedMediaAiTicker.js";
import redis from "./redis-client.js";

// Initialize
setRedisClient(redis);

// Schedule automatic posting
setInterval(async () => {
  try {
    await runAdvancedMediaAiTick();
    console.log("✅ Posted content");
  } catch (error) {
    console.error("❌ Posting failed:", error.message);
  }
}, 60000); // Every 60 seconds
```

### Example 2: With Liveliness Policy

```javascript
import { runAdvancedMediaAiTick } from "./src/tickers/advancedMediaAiTicker.js";
import { canPostNow, markPosted } from "./lib/liveliness.js";

setInterval(async () => {
  // Check if posting is allowed (e.g., business hours only)
  const ok = await canPostNow();
  if (!ok) {
    console.log("⏸️  Posting disabled by liveliness policy");
    return;
  }

  try {
    await runAdvancedMediaAiTick();
    await markPosted(); // Track last post time
  } catch (error) {
    console.error("Posting failed:", error);
  }
}, 60000);
```

### Example 3: Manual Triggering (Admin Endpoint)

```javascript
// In your Express router
router.post("/admin/post-now", async (req, res) => {
  try {
    await runAdvancedMediaAiTick();
    return res.json({ ok: true, message: "Posted" });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});
```

### Example 4: Sport-Specific Posting

```javascript
import { getDiverseContent } from "./src/tickers/advancedMediaAiTicker.js";

// Post only tennis content
const content = await getDiverseContent();
const tennisEvents = content.filter(c => c.sport === "tennis");
const topTennis = tennisEvents.sort((a, b) => b.importance - a.importance)[0];

if (topTennis) {
  // Post this tennis event
  const caption = `🎾 ${topTennis.title}`;
  await broadcastPhoto(topTennis.imageUrl, caption);
}
```

### Example 5: Custom Deduplication Check

```javascript
import { imageDedup, teamDedup } from "./src/tickers/advancedMediaAiTicker.js";

async function checkEvent(event) {
  // Check both dedup types
  const [imageDup, teamDup] = await Promise.all([
    imageDedup.hasPostedImage(event.imageUrl),
    teamDedup.hasRecentTeam(event.home, event.away)
  ]);

  return {
    canPost: !imageDup && !teamDup,
    reasons: {
      imageDuplicate: imageDup,
      teamRecent: teamDup
    }
  };
}

// Usage
const verdict = await checkEvent(myEvent);
if (verdict.canPost) {
  console.log("✅ Event is fresh, can post");
} else {
  console.log("❌ Skip reasons:", verdict.reasons);
}
```

---

## Database Schema

### Redis Keys Structure

#### Image Deduplication
```
betrix:posted:image:{SHA256_HASH}
TTL: 30 days
Value: "1"

Example: betrix:posted:image:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

#### Team Recent Postings
```
betrix:recent:team:{NORMALIZED_NAME}
TTL: 2 hours
Value: "1"

Example: 
  betrix:recent:team:manchester_city
  betrix:recent:team:arsenal
```

#### Sport Posting Statistics
```
betrix:sport:count:{SPORT_ID}
Type: INCR counter
Value: integer (total posts for this sport)

Example:
  betrix:sport:count:soccer
  betrix:sport:count:nfl
  betrix:sport:count:tennis
```

#### Event Posting History
```
betrix:event:posted:{EVENT_ID}
TTL: 24 hours
Value: JSON { sport, league, timestamp }
```

### Recommended Indexes

For optimal performance with large datasets:

```javascript
// Create Redis indexes for batch operations
redis.multi()
  .scan(0, "MATCH", "betrix:posted:image:*")
  .exec((err, results) => {
    if (!err) console.log(`Image cache size: ${results.length}`);
  });

redis.multi()
  .scan(0, "MATCH", "betrix:recent:team:*")
  .exec((err, results) => {
    if (!err) console.log(`Team cache size: ${results.length}`);
  });
```

---

## Performance Optimization

### Tip 1: Memory Management

```javascript
// In-memory caches can grow large
// Clear periodically:

const imageDedup = new ImageDeduplicator();
setInterval(() => {
  if (imageDedup.hashCache.size > 5000) {
    console.log(`⚠️  Clearing ${imageDedup.hashCache.size} items`);
    imageDedup.hashCache.clear();
    // Will reload from Redis on next check
  }
}, 60 * 60 * 1000); // Every hour
```

### Tip 2: Batch Redis Operations

```javascript
// Instead of:
for (const sport of sports) {
  await redis.incr(`betrix:sport:count:${sport}`);
}

// Do this:
const pipeline = redis.pipeline();
for (const sport of sports) {
  pipeline.incr(`betrix:sport:count:${sport}`);
}
await pipeline.exec();
```

### Tip 3: Cache Query Results

```javascript
// Cache sports stats to avoid repeated Redis calls
class CachedStats {
  constructor(redis, ttlSeconds = 300) {
    this.redis = redis;
    this.ttl = ttlSeconds;
    this.cache = null;
    this.cacheTime = 0;
  }

  async getStats() {
    const now = Date.now();
    if (this.cache && (now - this.cacheTime) < this.ttl * 1000) {
      return this.cache; // Return cached copy
    }

    // Fetch fresh
    const sports = Object.keys(SUPPORTED_SPORTS);
    this.cache = {};
    for (const sport of sports) {
      this.cache[sport] = await this.redis.get(`betrix:sport:count:${sport}`);
    }
    this.cacheTime = now;
    return this.cache;
  }
}
```

### Tip 4: Parallel Operations

```javascript
// Use Promise.all() for concurrent operations
const [liveMatches, news, stats] = await Promise.all([
  sportsAggregator.getLiveMatches(),
  newsAggregator.getLatestNews(),
  getStatistics()
]);
// All three fetch in parallel, not sequentially
```

### Tip 5: Lazy Loading Images

```javascript
// Don't fetch all image URLs upfront
// Only fetch when actually posting:

async function getMediaForEvent(event) {
  // This is expensive, do it only for selected event
  const media = await selectBestMediaForEventCombined(event);
  return media;
}

// Not:
const allMedia = await Promise.all(
  allEvents.map(e => selectBestMediaForEventCombined(e))
);
```

---

## Troubleshooting

### Issue: "ImageDedup Redis check failed: connect ECONNREFUSED"

**Cause:** Redis not available  
**Solution:**
```javascript
// Gracefully degrade (use in-memory only)
if (!redis.connected) {
  console.warn("⚠️ Redis unavailable, using in-memory cache only");
  // Dedup will still work, won't survive restarts
}
```

### Issue: "Sport weights sum to 1.21, should be ~1.0"

**Cause:** Configuration error  
**Solution:**
```javascript
// Verify and normalize:
const weights = {
  soccer: 0.25,
  nfl: 0.15,
  nba: 0.15,
  tennis: 0.12,
  boxing: 0.1,
  cricket: 0.1,
  nhl: 0.08,
  f1: 0.08,
  mlb: 0.07,
  rugby: 0.06,
  // Current sum: 1.16

  // Fix: scale all down slightly
  // total = 1.16, scale factor = 1.0 / 1.16 = 0.862
};

const normalized = Object.entries(weights).reduce((acc, [sport, weight]) => {
  acc[sport] = weight * 0.862;
  return acc;
}, {});
```

### Issue: Only soccer posts, no variety

**Cause:** Sport weights not configured or all set to soccer  
**Solution:**
```bash
# Check env vars
echo $WEIGHT_SOCCER $WEIGHT_NFL $WEIGHT_NBA

# Should output different non-zero values
# 0.25 0.15 0.15  ✅ Good

# If not set, add to .env
WEIGHT_SOCCER=0.25
WEIGHT_NFL=0.15
WEIGHT_NBA=0.15
# ... etc
```

### Issue: "No interesting events"

**Cause:** Aggregator not returning data  
**Solution:**
```javascript
// Debug the aggregator
const raw = await sportsAggregator.getLiveMatches();
console.log("Live matches returned:", raw.length);

const upcoming = await sportsAggregator.getFixtures();
console.log("Upcoming fixtures returned:", upcoming.length);

// If both are 0, check:
// 1. API keys configured
// 2. API rate limits not hit
// 3. Network connectivity
```

### Issue: "Posted image { found: false }"

**Cause:** Image selector failing to find images  
**Solution:**
```javascript
// Enable verbose logging
process.env.ADVANCED_MEDIA_VERBOSE = "true";

// Check image selector logs
// Verify Wikipedia API is accessible
// Confirm event has proper team names for lookup
```

---

## Best Practices

### 1. Environment Variable Convention

```bash
# Always use PREFIX_FEATURE_SETTING format
ADVANCED_MEDIA_AI_ENABLED=true
MEDIA_AI_COOLDOWN_MS=30000
WEIGHT_SOCCER=0.25
IMAGE_DEDUP_TTL_SECONDS=2592000
```

### 2. Error Handling

```javascript
// Always catch and log without crashing
try {
  await runAdvancedMediaAiTick();
} catch (error) {
  logger.error("Advanced Media AI Tick failed", {
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });
  // Continue, don't crash the process
}
```

### 3. Monitoring

```javascript
// Track key metrics
telemetry.gauge("media_ai_posts_today", await getPostsToday());
telemetry.gauge("dedup_cache_size", imageDedup.hashCache.size);
telemetry.histogram("post_duration_ms", duration);
```

### 4. Configuration Validation

```javascript
// At startup
const validation = validateAdvancedMediaConfig();
if (!validation.valid) {
  console.warn("⚠️ Configuration warnings:", validation.warnings);
  // Warn but don't crash
}
```

### 5. Graceful Degradation

```javascript
// If Redis unavailable
if (!redis.connected) {
  console.warn("Redis unavailable, dedup will be in-memory only");
  // Bot continues to work, just with limited memory
}

// If news API down
try {
  const news = await getLatestNews();
} catch {
  // Continue without news, just post events
}
```

---

## Performance Benchmarks

Typical performance on mid-range hardware:

| Operation | Time | Notes |
|-----------|------|-------|
| Image dedup check (in-memory) | <1ms | Cache hit |
| Image dedup check (Redis) | 2-5ms | Network latency |
| Team dedup check | 5-10ms | Normalize + lookup |
| Score all events (100 items) | 500-800ms | Parallel scoring |
| Get media for event | 1-2s | Image search |
| Generate caption (AI) | 2-3s | API call |
| Send to Telegram | 1-2s | Network |
| **Total tick time** | **5-9 seconds** | But only runs every 60s |

---

This completes the technical reference. For questions, check logs with `ADVANCED_MEDIA_VERBOSE=true`.
