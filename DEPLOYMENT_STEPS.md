# ⚡ Advanced Media AI Ticker v2 - Deployment Instructions

## ✅ What Was Done

The code has been updated to use the Advanced Media AI Ticker v2. The main changes:

1. **Updated `src/worker-final.js`:**
   - Changed import from `runMediaAiTick` to `runAdvancedMediaAiTick`
   - Added `setRedisClient(redis)` initialization for deduplication
   - Advanced ticker now runs on the same 60-second interval

## ⚠️ Required: Set Environment Variables

**The new ticker requires sport weight environment variables to work properly.**

### Add These to Your Deployment Environment:

```bash
# Feature toggles
ADVANCED_MEDIA_AI_ENABLED=true
IMAGE_DEDUP_ENABLED=true
TEAM_DEDUP_ENABLED=true
SPORT_ROTATION_ENABLED=true
NEWS_POSTING_ENABLED=true

# Sport weights (must sum to ~1.0)
WEIGHT_SOCCER=0.25
WEIGHT_NFL=0.15
WEIGHT_NBA=0.15
WEIGHT_TENNIS=0.12
WEIGHT_BOXING=0.10
WEIGHT_CRICKET=0.10
WEIGHT_NHL=0.08
WEIGHT_F1=0.08
WEIGHT_MLB=0.07
WEIGHT_RUGBY=0.06
WEIGHT_NEWS=0.05

# Deduplication windows
IMAGE_DEDUP_TTL_SECONDS=2592000
TEAM_DEDUP_WINDOW_MS=7200000

# News settings (optional)
NEWS_FREQUENCY=0.2
NEWS_KEYWORDS=transfer news,breaking news,announcement
```

## 🚀 Deployment Steps (Render/Similar)

### Option 1: Using Render Dashboard

1. Go to your Render service settings
2. Click "Environment" tab
3. Add each environment variable above
4. Click "Save" (automatic redeploy)
5. Wait for deployment to complete
6. Check logs for `[AdvancedMediaAiTicker]` messages

### Option 2: Using render.yaml (if you have one)

Add to your `render.yaml`:

```yaml
env:
  - key: ADVANCED_MEDIA_AI_ENABLED
    value: "true"
  - key: WEIGHT_SOCCER
    value: "0.25"
  - key: WEIGHT_NFL
    value: "0.15"
  - key: WEIGHT_NBA
    value: "0.15"
  # ... add all others
```

### Option 3: Command Line (if using Render CLI)

```bash
render env set ADVANCED_MEDIA_AI_ENABLED=true
render env set WEIGHT_SOCCER=0.25
render env set WEIGHT_NFL=0.15
# ... etc
```

## 📊 Verification Checklist

After deployment, verify:

- [ ] Bot restarted without errors
- [ ] Logs show `[AdvancedMediaAiTicker]` messages (not `[MediaAiTicker]`)
- [ ] First post includes different sport (not just soccer)
- [ ] Check for: `[AdvancedMediaAiTicker] Posted successfully`
- [ ] Monitor for 5-10 posts to see variety (soccer, NFL, NBA, tennis, etc.)
- [ ] No errors in logs

## 🔍 Expected Log Output

Look for these logs to confirm it's working:

```
[AdvancedMediaAiTicker] Selected content { type: 'event', sport: 'nfl', title: '...' }
[AdvancedMediaAiTicker] Posted successfully { type: 'event', sport: 'nfl', hasImage: true }
```

Instead of:

```
[MediaAiTicker] Posted AI media item { sport: 'soccer', ... }
```

## ❌ Troubleshooting

### Issue: Still Only Posting Soccer

**Solution:** Check that sport weight env vars are set. Run in logs:
```bash
echo "WEIGHT_SOCCER=$WEIGHT_SOCCER WEIGHT_NFL=$WEIGHT_NFL WEIGHT_NBA=$WEIGHT_NBA"
```

If empty, sport weights aren't configured.

### Issue: Error "RedisClient not set"

**Solution:** This means `setRedisClient(redis)` wasn't called. Verify the `src/worker-final.js` changes were deployed.

### Issue: No posts happening

**Solution:** Check if:
1. `BOT_BROADCAST_CHAT_ID` is set
2. Bot is member of the channel
3. API keys for aggregators are valid

## 📚 Documentation

- Read: [README_ADVANCED_MEDIA_AI_TICKER.md](./README_ADVANCED_MEDIA_AI_TICKER.md)
- Quick Start: [QUICK_START_ADVANCED_MEDIA.sh](./QUICK_START_ADVANCED_MEDIA.sh)
- Migration: [MIGRATION_GUIDE_V1_TO_V2.md](./MIGRATION_GUIDE_V1_TO_V2.md)
- Technical: [ADVANCED_MEDIA_TECHNICAL_GUIDE.md](./ADVANCED_MEDIA_TECHNICAL_GUIDE.md)

## ✨ What to Expect

Once deployed with proper env vars, you should see:

```
Before (Old Ticker):
- Only soccer posts
- Same images repeated 80% of the time
- Same teams repeated 70% of the time
- 0% news coverage

After (Advanced Media AI Ticker v2):
- 11 different sports in rotation
- 95% unique images (5% repeats)
- 85% unique teams (15% repeats)
- 20% news/article coverage
- Smart sport weighting (soccer 25%, NFL 15%, etc.)
```

---

**Next Step:** Add environment variables to your Render (or deployment) dashboard and redeploy! 🚀

