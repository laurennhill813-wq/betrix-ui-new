# Channel Posting Setup Guide

## Overview
The BETRIX bot is now configured to automatically post prefetched sports images and news to your Telegram channel every 1 minute.

## Prerequisites
1. The bot must be an **admin** in the target Telegram channel
2. The channel ID must be set in environment variables
3. The bot must have permission to post photos and text

## Configuration

### Step 1: Get Your Channel ID
1. Add the bot as an admin to your channel "Betrix Ai" (ID: -1003425723710)
2. Send any message to the channel
3. Use @userinfobot or similar bot to get the channel ID

### Step 2: Set Environment Variable
Set this environment variable in your Render deployment:

```
BOT_BROADCAST_CHAT_ID=-1003425723710
```

**How to set it in Render:**
1. Go to your Render service dashboard
2. Click "Environment" tab
3. Add new environment variable:
   - Key: `BOT_BROADCAST_CHAT_ID`
   - Value: `-1003425723710`
4. Click Save
5. Service will automatically redeploy

### Step 3: Configure Posting Behavior (Optional)

You can customize the posting behavior with these optional environment variables:

```env
# Interval between posts (in seconds) - Default: 60 (1 minute)
MEDIA_AI_INTERVAL_SECONDS=60

# Cooldown between posts (in milliseconds) - Default: 30000 (30 seconds)
MEDIA_AI_COOLDOWN_MS=30000

# Minimum score threshold for posts - Default: 40
MEDIA_AI_MIN_SCORE=40

# Number of events to bump for trending - Default: 10
MEDIA_AI_BUMP_TOP=10

# Sports priority weights
MEDIA_SPORT_PRIORITIES={"soccer":1,"nba":1.1,"nfl":1.05,"mlb":0.9,"nhl":0.9,"tennis":0.95}
```

## How It Works

1. **Every 60 seconds** (1 minute), the Media AI Ticker runs
2. **Fetches** interesting sports events from configured sources
3. **Scores** events based on:
   - Sport priority weights
   - Time of day (prime hours 18:00-23:00 get a boost)
   - Event recency and importance
4. **Selects** the top-scoring event that hasn't been posted recently
5. **Generates** AI summary and finds best image
6. **Posts** to the channel with image and caption

## Content Sources

The bot gets content from:
- **Football Data** (live scores, fixtures)
- **SportMonks** (if configured)
- **The Odds API** (odds and predictions)
- **Various sports APIs** (via RapidAPI)

## Monitoring

Check the bot logs to see posting activity:

```
[MediaAiTicker] Posted AI media item {
  sport: 'soccer',
  league: 'Premier League',
  source: 'image_source',
  tone: 'exciting',
  score: 95
}
```

## Troubleshooting

### Bot not posting to channel?

1. **Check bot is admin:**
   ```
   /getme in channel chat or check channel settings
   ```

2. **Verify environment variable:**
   - Go to Render dashboard
   - Check environment variables section
   - Ensure `BOT_BROADCAST_CHAT_ID` is set correctly

3. **Check logs:**
   - If you see: `[MediaAiTicker] No candidate passed scoring...`
   - It means no events met the minimum score threshold
   - Lower `MEDIA_AI_MIN_SCORE` to get more posts

4. **Check content sources:**
   - If all sports API sources are down, no events will be available
   - The bot will log warnings about missing API data

### Getting too many/too few posts?

- **Too many?** Increase `MEDIA_AI_COOLDOWN_MS` (milliseconds between posts)
- **Too few?** Decrease `MEDIA_AI_MIN_SCORE` (lower threshold = more posts)

## Example Channel Setup

**Channel:** Betrix Ai (-1003425723710)
**Bot:** BETRIX AI Assistant
**Posting:** Every minute with AI-selected sports content

Expected output:
```
[Image] 
⚽ Manchester United 2-1 Liverpool
Exciting 89th minute goal! United takes the lead late in the game.
```

## Advanced: Custom Scheduling

If you need different posting intervals at different times, you can:

1. Create multiple schedulers in `src/worker-final.js`
2. Set different intervals for different sports
3. Implement peak-hour boosting

Contact support for custom implementations.

---

**Last Updated:** 2025-12-29
**Configuration Version:** 1.0
