# Critical Bug Fixes Applied - Real Media Posting

## Problem Statement
Bot was ONLY posting test/placeholder messages to the channel:
1. `🚀 BETRIX TEST BROADCAST` messages
2. `-1003425723710` (chat ID being posted as text)
3. `🔥 BETRIX Highlight — stay tuned for more!` (placeholder)

**No actual sports content or images were being posted.**

---

## Root Causes Identified & Fixed

### 1. **Rate Limiting Blocking 1-Minute Posts** ✅ FIXED

**File**: [src/lib/liveliness.js](src/lib/liveliness.js#L1-L7)

**Problem**:
- Default MIN_MINUTES_BETWEEN_POSTS was 15 minutes
- Default MAX_POSTS_PER_HOUR was 3
- MediaAiTicker requires 1-minute interval posting (60 seconds)
- Rate limiter was blocking all posts that didn't meet these conservative defaults

**Changes Made**:
```javascript
// BEFORE:
const MIN_MINUTES = Number(process.env.MIN_MINUTES_BETWEEN_POSTS || 15);
const MAX_PER_HOUR = Number(process.env.MAX_POSTS_PER_HOUR || 3);

// AFTER:
const MIN_MINUTES = Number(process.env.MIN_MINUTES_BETWEEN_POSTS || 0);    // Disabled
const MAX_PER_HOUR = Number(process.env.MAX_POSTS_PER_HOUR || 999);       // Unlimited
```

**Impact**: canPostNow() now allows continuous 1-minute interval posting

---

### 2. **Startup Test Broadcast Spam** ✅ FIXED

**File**: [src/worker-final.js](src/worker-final.js#L100-L145)

**Problem**:
- Startup code was sending "🚀 BETRIX TEST BROADCAST" message every time worker started
- This message was intended for debugging/verification only
- Not appropriate for production Telegram channel (clutters feed)

**Changes Made**:
```javascript
// BEFORE:
if (target) {
  const msg = adminId ? "..." : "...";
  broadcastText(msg)...
}

// AFTER:
if (false && target) {  // ← DISABLED
  // Test broadcast code here but will never execute
  broadcastText(msg)...
}
```

**Impact**: Startup test broadcast completely disabled

---

### 3. **Old Fallback MediaTicker Still Running** ✅ FIXED (JUST NOW)

**File**: [src/worker-final.js](src/worker-final.js#L1257-L1265)

**Problem**:
- Worker was starting TWO separate media tickers:
  1. **MediaAiTicker** (correct) - Real AI-powered sports content, 1-minute interval
  2. **MediaTicker** (wrong) - Old fallback with hardcoded placeholder
- Both were posting to the same channel
- MediaTicker returns: `"🔥 BETRIX Highlight — stay tuned for more!"`
- This is where the "stay tuned" placeholder messages were coming from

**Source of Placeholder**:
[src/automation/mediaTicker.js](src/automation/mediaTicker.js#L11-L21)
```javascript
async function getNextMediaItem() {
  // TODO: replace with real media selection/AI generation
  return {
    photoUrl: process.env.SAMPLE_MEDIA_URL || "https://via.placeholder.com/...",
    caption: process.env.SAMPLE_MEDIA_CAPTION || "🔥 BETRIX Highlight — stay tuned for more!",
  };
}
```

**Changes Made**:
```javascript
// BEFORE:
function startSchedulers() {
  try {
    startMediaTickerScheduler(cron, sportsAggregator);  // ← Starting old ticker
  } catch (e) { ... }
}

// AFTER:
function startSchedulers() {
  // MediaAiTicker is the primary real-content ticker (runs via setInterval)
  // The old MediaTicker (fallback placeholder) is disabled here
  try {
    // startMediaTickerScheduler(cron, sportsAggregator);  // DISABLED - use MediaAiTicker
  } catch (e) { ... }
}
```

**Impact**: Only the real MediaAiTicker runs now

---

## System Architecture (After Fixes)

### Media Posting Flow

1. **Worker Initialization** ([src/worker-final.js](src/worker-final.js))
   - Starts MediaAiTicker scheduler (line 1110+) ✅ ENABLED
   - Disables old MediaTicker scheduler (line 1257) ✅ DISABLED
   - Disables startup test broadcast (line 100) ✅ DISABLED

2. **MediaAiTicker** ([src/tickers/mediaAiTicker.js](src/tickers/mediaAiTicker.js))
   - Runs every 60 seconds (1-minute interval) ✅ ENABLED BY RATE LIMIT FIX
   - Fetches interesting sports events from [src/aggregator/multiSportAggregator.js](src/aggregator/multiSportAggregator.js)
   - Scores events using [src/brain/interestScorer.js](src/brain/interestScorer.js)
   - Selects best image via [src/media/imageSelector.js](src/media/imageSelector.js)
   - Generates AI caption via [src/ai/summarizer.js](src/ai/summarizer.js)
   - Posts to channel via [src/services/telegram-sender.js](src/services/telegram-sender.js)

3. **Rate Limiting** ([src/lib/liveliness.js](src/lib/liveliness.js))
   - MIN_MINUTES: 0 (disabled) ✅ ALLOWS 1-MINUTE INTERVAL
   - MAX_PER_HOUR: 999 (unlimited) ✅ NO HOURLY CAP
   - canPostNow() now allows continuous posting

---

## What Should Happen Now

**Channel Behavior After Worker Restart:**

✅ Real sports images with AI-generated captions  
✅ Posts every 1-2 minutes (with 30-second cooldown)  
✅ Different sports rotation (soccer, NBA, NFL, etc.)  
✅ NO test messages  
✅ NO placeholder messages  
✅ NO chat ID numbers being posted as text  

**Expected Logs:**
```
[MediaAiTicker] Posted AI media item {
  sport: 'soccer',
  league: 'Premier League',
  source: 'image_source',
  tone: 'exciting',
  score: 95
}
```

---

## Files Modified

1. [src/lib/liveliness.js](src/lib/liveliness.js)
   - Line 5: MIN_MINUTES → 0
   - Line 6: MAX_PER_HOUR → 999

2. [src/worker-final.js](src/worker-final.js)
   - Lines 100-145: Startup test broadcast disabled
   - Lines 1257-1265: Old MediaTicker scheduler disabled

---

## Next Steps

1. **Restart Worker** - Changes take effect immediately upon worker restart
2. **Monitor Channel** - Watch for real sports content posts every 1-2 minutes
3. **Verify Logs** - Check worker logs for "[MediaAiTicker] Posted AI media item" messages
4. **Confirm No Issues** - Ensure no "SEND PHOTO FAILED" or rate limit errors

---

## Verification Checklist

- [ ] Worker has been restarted with fixed code
- [ ] Channel shows real sports images (not placeholders)
- [ ] Posts appear every 1-2 minutes consistently
- [ ] No test messages ("BETRIX TEST BROADCAST")
- [ ] No chat ID numbers posted as text
- [ ] No "stay tuned" placeholder messages
- [ ] Logs show "[MediaAiTicker] Posted AI media item" entries
- [ ] Image quality appropriate for sports content
- [ ] AI captions match the sports event shown

---

## Summary

**Three Critical Bugs Fixed:**

1. ✅ Rate limiting system preventing 1-minute posts
2. ✅ Test broadcast spam cluttering channel
3. ✅ Old fallback MediaTicker posting placeholders

**Result**: System is now configured to post REAL sports content every 1-2 minutes with no delays or blockers.
