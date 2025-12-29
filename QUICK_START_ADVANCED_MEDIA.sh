#!/bin/bash
# Quick Start: Advanced Media AI Ticker v2
# ========================================
# Copy & paste instructions to get started in 5 minutes

# =============================================================================
# STEP 1: Add Environment Variables
# =============================================================================
# Add these to your .env file:

cat >> .env << 'EOF'

# ===== ADVANCED MEDIA AI TICKER v2 =====

# Feature toggles (all optional)
ADVANCED_MEDIA_AI_ENABLED=true
IMAGE_DEDUP_ENABLED=true
TEAM_DEDUP_ENABLED=true
SPORT_ROTATION_ENABLED=true
NEWS_POSTING_ENABLED=true

# Sport weights (sum to ~1.0)
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

# News settings
NEWS_FREQUENCY=0.2
NEWS_KEYWORDS=transfer news,breaking news,announcement

# Scoring boosts
PRIME_HOUR_BOOST=1.15
TRENDING_BOOST=1.2
NEWS_IMPORTANCE_MULTIPLIER=1.1

# (Keep existing vars)
# MEDIA_AI_COOLDOWN_MS=30000
# MEDIA_AI_INTERVAL_SECONDS=60
# BOT_BROADCAST_CHAT_ID=...

EOF

echo "✅ Environment variables added to .env"

# =============================================================================
# STEP 2: Copy Files
# =============================================================================
# These files are already created at:
# - src/tickers/advancedMediaAiTicker.js
# - src/config/advancedMediaConfig.js
# 
# They should be in your workspace now.

echo "✅ Implementation files are ready"

# =============================================================================
# STEP 3: Update worker-final.js
# =============================================================================
# Find this line:
#   import { runMediaAiTick } from "../src/tickers/mediaAiTicker.js";
# 
# Replace with:
#   import { runAdvancedMediaAiTick, setRedisClient } from "../src/tickers/advancedMediaAiTicker.js";
#
# Find this line in the scheduler:
#   await runMediaAiTick();
# 
# Replace with:
#   await runAdvancedMediaAiTick();
#
# Add this in initialization:
#   setRedisClient(redis);

echo "📝 Update worker-final.js manually (search/replace 3 lines)"

# =============================================================================
# STEP 4: Restart and Test
# =============================================================================
# Restart your bot:
# npm run start
# or
# pm2 restart worker-final

# Watch logs:
# npm run logs

echo ""
echo "🎯 Quick Start Complete!"
echo ""
echo "Next steps:"
echo "1. Update worker-final.js (3 search/replace operations)"
echo "2. Restart bot: npm run start"
echo "3. Monitor logs: npm run logs"
echo "4. Look for: [AdvancedMediaAiTicker] Posted successfully"
echo ""
echo "📚 Documentation:"
echo "- User Guide: ADVANCED_MEDIA_AI_TICKER_GUIDE.md"
echo "- Technical: ADVANCED_MEDIA_TECHNICAL_GUIDE.md"
echo "- Migration: MIGRATION_GUIDE_V1_TO_V2.md"
echo ""
echo "✅ All environment variables are optional (have sensible defaults)"
echo "✅ Non-destructive upgrade (old ticker still works)"
echo "✅ Easy rollback (5 minutes)"
echo ""
