/**
 * Advanced Media AI Ticker Configuration
 * ======================================
 * Centralized configuration for multi-sport posting, deduplication, and news integration
 */

export const ADVANCED_MEDIA_CONFIG = {
  // ===== FEATURE TOGGLES =====
  ENABLED: process.env.ADVANCED_MEDIA_AI_ENABLED !== "false",
  
  // Enable image deduplication (prevent same images)
  IMAGE_DEDUP_ENABLED: process.env.IMAGE_DEDUP_ENABLED !== "false",
  
  // Enable team deduplication (prevent same teams)
  TEAM_DEDUP_ENABLED: process.env.TEAM_DEDUP_ENABLED !== "false",
  
  // Enable smart sport rotation (balanced coverage)
  SPORT_ROTATION_ENABLED: process.env.SPORT_ROTATION_ENABLED !== "false",
  
  // Enable news/article posting
  NEWS_POSTING_ENABLED: process.env.NEWS_POSTING_ENABLED !== "false",
  
  // ===== DEDUPLICATION SETTINGS =====
  DEDUP: {
    // Image cache TTL (seconds) - how long to remember posted images
    IMAGE_CACHE_TTL: Number(process.env.IMAGE_DEDUP_TTL_SECONDS || 30 * 24 * 60 * 60), // 30 days
    
    // Team recent posting window (seconds) - how long to avoid reposting teams
    TEAM_WINDOW_MS: Number(process.env.TEAM_DEDUP_WINDOW_MS || 2 * 60 * 60 * 1000), // 2 hours
    
    // Max in-memory cache size before clearing
    MAX_MEMORY_CACHE: Number(process.env.DEDUP_MAX_CACHE || 5000),
  },

  // ===== SPORT ROTATION =====
  SPORT_ROTATION: {
    // How many recent sports to track for diversity
    RECENT_HISTORY: Number(process.env.SPORT_ROTATION_HISTORY || 10),
    
    // Penalty for recently-posted sports (0-1, lower = more penalty)
    RECENT_PENALTY: Number(process.env.SPORT_ROTATION_PENALTY || 0.7),
    
    // Boost for underrepresented sports
    UNDERREP_BOOST: Number(process.env.SPORT_ROTATION_BOOST || 1.3),
  },

  // ===== SPORT WEIGHTS (Probability Distribution) =====
  SPORT_WEIGHTS: {
    soccer: Number(process.env.WEIGHT_SOCCER || 0.25),
    nfl: Number(process.env.WEIGHT_NFL || 0.15),
    nba: Number(process.env.WEIGHT_NBA || 0.15),
    tennis: Number(process.env.WEIGHT_TENNIS || 0.12),
    boxing: Number(process.env.WEIGHT_BOXING || 0.1),
    cricket: Number(process.env.WEIGHT_CRICKET || 0.1),
    nhl: Number(process.env.WEIGHT_NHL || 0.08),
    f1: Number(process.env.WEIGHT_F1 || 0.08),
    mlb: Number(process.env.WEIGHT_MLB || 0.07),
    rugby: Number(process.env.WEIGHT_RUGBY || 0.06),
    news: Number(process.env.WEIGHT_NEWS || 0.05),
  },

  // ===== NEWS INTEGRATION =====
  NEWS: {
    // Enable news article posting alongside events
    ENABLED: process.env.NEWS_ENABLED !== "false",
    
    // Frequency of news posts (0-1, 0.2 = 20% of posts are news)
    FREQUENCY: Number(process.env.NEWS_FREQUENCY || 0.2),
    
    // News source keywords to track
    KEYWORDS: (process.env.NEWS_KEYWORDS || "transfer news,breaking news,announcement")
      .split(",")
      .map(k => k.trim()),
    
    // Fetch this many news articles per tick
    FETCH_COUNT: Number(process.env.NEWS_FETCH_COUNT || 3),
  },

  // ===== SCORING & FILTERING =====
  SCORING: {
    // Minimum score to post (after weighting)
    MIN_SCORE: Number(process.env.MEDIA_AI_MIN_SCORE || 10),
    
    // Sport weight multiplier (base score * weight)
    SPORT_WEIGHT_MULTIPLIER: Number(process.env.SPORT_WEIGHT_MULTIPLIER || 1.0),
    
    // Time-of-day boost for prime hours (18:00-23:00)
    PRIME_HOUR_BOOST: Number(process.env.PRIME_HOUR_BOOST || 1.15),
    
    // Trending/popularity boost if event has recent mentions
    TRENDING_BOOST: Number(process.env.TRENDING_BOOST || 1.2),
    
    // News importance multiplier (breaking news gets boost)
    NEWS_IMPORTANCE_MULTIPLIER: Number(process.env.NEWS_IMPORTANCE_MULTIPLIER || 1.1),
  },

  // ===== POSTING BEHAVIOR =====
  POSTING: {
    // Cooldown between posts (milliseconds)
    COOLDOWN_MS: Number(process.env.MEDIA_AI_COOLDOWN_MS || 30 * 1000),
    
    // Interval for automatic ticker (milliseconds)
    INTERVAL_MS: Number(process.env.MEDIA_AI_INTERVAL_SECONDS || 60) * 1000,
    
    // Skip if last post was more recent (seconds)
    MIN_BETWEEN_POSTS: Number(process.env.MIN_BETWEEN_POSTS_SEC || 30),
  },

  // ===== REDIS CACHE SETTINGS =====
  REDIS: {
    // Prefix for all Redis keys
    PREFIX: process.env.REDIS_PREFIX || "betrix:",
    
    // Posted image tracking
    IMAGE_PREFIX: process.env.REDIS_PREFIX + (process.env.REDIS_IMAGE_PREFIX || "posted:image:"),
    
    // Team dedup tracking
    TEAM_PREFIX: process.env.REDIS_PREFIX + (process.env.REDIS_TEAM_PREFIX || "recent:team:"),
    
    // Sport posting stats
    STATS_PREFIX: process.env.REDIS_PREFIX + (process.env.REDIS_STATS_PREFIX || "sport:count:"),
  },

  // ===== MEDIA SELECTION =====
  MEDIA: {
    // Prefer videos over images
    PREFER_VIDEOS: process.env.PREFER_VIDEOS === "true",
    
    // Image source priority (higher = preferred)
    SOURCE_PRIORITY: {
      wikipedia: 5,
      official: 4,
      espn: 3,
      rss: 2,
      generic: 1,
    },
    
    // Fallback to text-only post if no image found
    TEXT_FALLBACK_ENABLED: process.env.TEXT_FALLBACK !== "false",
  },

  // ===== CAPTION GENERATION =====
  CAPTIONS: {
    // Use AI summarization for captions
    AI_SUMMARIZATION: process.env.AI_SUMMARIES !== "false",
    
    // Tone for summaries: 'exciting', 'professional', 'conversational'
    TONE: process.env.CAPTION_TONE || "conversational",
    
    // Max caption length (Telegram limit)
    MAX_LENGTH: Number(process.env.MAX_CAPTION_LENGTH || 1024),
    
    // Include sport emoji in captions
    INCLUDE_EMOJI: process.env.INCLUDE_EMOJI !== "false",
  },

  // ===== LOGGING & TELEMETRY =====
  LOGGING: {
    VERBOSE: process.env.ADVANCED_MEDIA_VERBOSE === "true",
    SNAPSHOT_ENABLED: process.env.SNAPSHOT_ENABLED !== "false",
    SNAPSHOT_SIZE: Number(process.env.SNAPSHOT_SIZE || 10),
  },

  // ===== SPORT ALIASES & NORMALIZATION =====
  SPORT_ALIASES: {
    soccer: ["football", "epl", "laliga", "seriea", "bundesliga"],
    nfl: ["american football", "afl"],
    nba: ["basketball"],
    tennis: ["atp", "wta", "wimbledon", "grandslam"],
    boxing: ["mma", "ufc", "fighter"],
    cricket: ["ipl", "test match", "t20", "odi"],
    nhl: ["ice hockey", "hockey"],
    f1: ["formula 1", "formula one", "racing"],
    mlb: ["baseball"],
    rugby: ["rugby league"],
  },
};

/**
 * Helper: Get sport ID from user input
 */
export function resolveSport(input) {
  if (!input) return null;
  
  const normalized = String(input).toLowerCase().trim();
  
  // Direct match
  if (ADVANCED_MEDIA_CONFIG.SPORT_ALIASES[normalized]) {
    return normalized;
  }
  
  // Alias match
  for (const [sport, aliases] of Object.entries(ADVANCED_MEDIA_CONFIG.SPORT_ALIASES)) {
    if (aliases.includes(normalized)) {
      return sport;
    }
  }
  
  return null;
}

/**
 * Helper: Get Redis key for stored data
 */
export function getRedisKey(type, value) {
  const config = ADVANCED_MEDIA_CONFIG.REDIS;
  switch (type) {
    case "image":
      return config.IMAGE_PREFIX + value;
    case "team":
      return config.TEAM_PREFIX + value;
    case "stats":
      return config.STATS_PREFIX + value;
    default:
      return config.PREFIX + type + ":" + value;
  }
}

/**
 * Validate configuration
 */
export function validateAdvancedMediaConfig() {
  const errors = [];
  
  // Check sport weights sum to reasonable value (0.8-1.2)
  const weightSum = Object.values(ADVANCED_MEDIA_CONFIG.SPORT_WEIGHTS).reduce((a, b) => a + b, 0);
  if (Math.abs(weightSum - 1.0) > 0.3) {
    errors.push(`⚠️ Sport weights sum to ${weightSum.toFixed(2)}, should be ~1.0`);
  }
  
  // Check dedup settings
  if (ADVANCED_MEDIA_CONFIG.DEDUP.IMAGE_CACHE_TTL < 3600) {
    errors.push("⚠️ IMAGE_CACHE_TTL too short, should be at least 1 hour");
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings: errors,
  };
}

export default ADVANCED_MEDIA_CONFIG;
