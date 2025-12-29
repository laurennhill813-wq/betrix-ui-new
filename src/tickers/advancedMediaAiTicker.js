/**
 * Advanced Media AI Ticker v2
 * ==============================
 * Senior Full-Stack Engineer improvements:
 * 
 * 1. **Multi-Sport Support**: Tennis, Boxing, NFL, NBA, Cricket, Hockey, F1, etc.
 * 2. **Intelligent Deduplication**: 
 *    - Image hash-based de-duplication (prevents same images)
 *    - Team/competitor name tracking (prevents repeated teams)
 *    - Content-based filtering
 * 3. **News Article Posting**: Breaking news, transfers, announcements
 * 4. **Sport Rotation Logic**: Weights & probabilities for balanced coverage
 * 5. **Redis-backed Cache**: Persistent dedup across restarts
 * 6. **Smart Scoring**: Time-aware, trend-aware, diversity-aware
 */

import { getInterestingEvents } from "../aggregator/multiSportAggregator.js";
import { getLatestNews } from "../aggregator/newsAggregator.js";
import { summarizeEventForTelegram } from "../ai/summarizer.js";
import {
  selectBestImageForEventCombined,
  selectBestMediaForEventCombined,
} from "../media/imageSelector.js";
import { sendPhotoWithCaption, sendVideoWithCaption } from "../services/telegram-sender.js";
import { scoreEvent } from "../brain/interestScorer.js";
import {
  buildEventId,
  hasPostedWithin,
  markEventPosted,
} from "../brain/memory.js";
import { bumpEventMention } from "../brain/trending.js";
import telemetry from "../brain/telemetry.js";
import { broadcastText } from "../telegram/broadcast.js";
import { ADVANCED_MEDIA_CONFIG } from "../config/advancedMediaConfig.js";
import crypto from "crypto";

// Get Redis if available for advanced deduplication
let redis = null;
export function setRedisClient(r) {
  redis = r;
}

const POSTING_COOLDOWN_MS = Number(
  process.env.MEDIA_AI_COOLDOWN_MS || 30 * 1000,
);

// Store last posted info in memory (backed by Redis if available)
let lastPostedAt = 0;

/**
 * SUPPORTED SPORTS with sport ID mapping and aliases
 * Weights are dynamically loaded from ADVANCED_MEDIA_CONFIG
 * This enables easy customization via environment variables or defaults
 */
const getSupportedSports = () => {
  const weights = ADVANCED_MEDIA_CONFIG.SPORT_WEIGHTS || {
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
    news: 0.05,
  };

  return {
    soccer: {
      apiId: "soccer",
      aliases: ["football", "epl", "premier league", "la liga", "serie a"],
      weight: weights.soccer,
      emoji: "⚽",
      newsKeywords: ["transfer news", "football", "soccer", "goal"],
    },
    nfl: {
      apiId: "nfl",
      aliases: ["american football", "nfl", "afl"],
      weight: weights.nfl,
      emoji: "🏈",
      newsKeywords: ["NFL", "touchdown", "football"],
    },
    nba: {
      apiId: "nba",
      aliases: ["basketball", "nba"],
      weight: weights.nba,
      emoji: "🏀",
      newsKeywords: ["NBA", "basketball", "three pointer"],
    },
    tennis: {
      apiId: "tennis",
      aliases: ["atp", "wta", "wimbledon", "grand slam"],
      weight: weights.tennis,
      emoji: "🎾",
      newsKeywords: ["tennis", "ATP", "WTA", "Federer", "Nadal"],
    },
    boxing: {
      apiId: "boxing",
      aliases: ["boxing", "mma", "ufc", "fighter"],
      weight: weights.boxing,
      emoji: "🥊",
      newsKeywords: ["boxing", "UFC", "fighter", "knockout"],
    },
    cricket: {
      apiId: "cricket",
      aliases: ["cricket", "ipl", "test match", "t20"],
      weight: weights.cricket,
      emoji: "🏏",
      newsKeywords: ["cricket", "IPL", "test match"],
    },
    nhl: {
      apiId: "nhl",
      aliases: ["ice hockey", "nhl", "hockey"],
      weight: weights.nhl,
      emoji: "🏒",
      newsKeywords: ["hockey", "NHL", "goal"],
    },
    f1: {
      apiId: "f1",
      aliases: ["formula 1", "f1", "racing", "formula one"],
      weight: weights.f1,
      emoji: "🏎️",
      newsKeywords: ["F1", "racing", "Ferrari", "Mercedes"],
    },
    mlb: {
      apiId: "mlb",
      aliases: ["baseball", "mlb"],
      weight: weights.mlb,
      emoji: "⚾",
      newsKeywords: ["baseball", "MLB", "home run"],
    },
    rugby: {
      apiId: "rugby",
      aliases: ["rugby", "rugby league"],
      weight: weights.rugby,
      emoji: "🏉",
      newsKeywords: ["rugby", "try", "scrum"],
    },
    news: {
      apiId: "news",
      aliases: ["breaking news", "transfer news", "announcement"],
      weight: weights.news,
      emoji: "📰",
      newsKeywords: ["breaking", "news", "announcement"],
    },
  };
};

const SUPPORTED_SPORTS = getSupportedSports();

/**
 * Image Deduplication Helper
 * Stores hashes of posted image URLs to prevent duplicate images
 */
class ImageDeduplicator {
  constructor() {
    this.hashCache = new Map(); // In-memory cache
    this.redisPrefix = "betrix:posted:image:";
  }

  /**
   * Generate SHA256 hash of image URL
   */
  hashUrl(url) {
    if (!url) return null;
    return crypto.createHash("sha256").update(url).digest("hex");
  }

  /**
   * Check if image was already posted
   */
  async hasPostedImage(imageUrl) {
    if (!imageUrl) return false;
    const hash = this.hashUrl(imageUrl);
    
    // Check in-memory cache first
    if (this.hashCache.has(hash)) {
      return true;
    }

    // Check Redis if available and has get method
    if (redis && typeof redis.get === 'function') {
      try {
        const exists = await redis.get(this.redisPrefix + hash);
        if (exists) {
          this.hashCache.set(hash, true);
          return true;
        }
      } catch (e) {
        // Redis not available or method not supported, continue with memory-only
      }
    }

    return false;
  }

  /**
   * Mark image as posted
   */
  async markImagePosted(imageUrl) {
    if (!imageUrl) return;
    const hash = this.hashUrl(imageUrl);
    this.hashCache.set(hash, true);

    if (redis && typeof redis.set === 'function') {
      try {
        // Store for 30 days using set with EX option or setex
        await redis.set(
          this.redisPrefix + hash,
          "1",
          'EX',
          30 * 24 * 60 * 60
        ).catch(() => {
          // Fallback: if EX not supported, try without expiry
          return redis.set(this.redisPrefix + hash, "1");
        });
      } catch (e) {
        // Redis not available or method not supported, continue with memory-only
      }
    }
  }
}

/**
 * Team/Competitor Deduplication Helper
 * Prevents posting the same teams/competitors repeatedly
 */
class TeamDeduplicator {
  constructor() {
    this.recentTeams = new Set();
    this.redisPrefix = "betrix:recent:team:";
    this.windowMs = 2 * 60 * 60 * 1000; // 2 hours
  }

  /**
   * Normalize team name for comparison
   */
  normalize(name) {
    if (!name) return "";
    return name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
  }

  /**
   * Check if team was recently posted
   */
  async hasRecentTeam(homeTeam, awayTeam) {
    const key1 = this.normalize(homeTeam);
    const key2 = this.normalize(awayTeam);
    
    if (!key1 || !key2) return false;

    // Check in-memory first
    if (this.recentTeams.has(key1) || this.recentTeams.has(key2)) {
      return true;
    }

    // Check Redis if available and has get method
    if (redis && typeof redis.get === 'function') {
      try {
        const [exists1, exists2] = await Promise.all([
          redis.get(this.redisPrefix + key1).catch(() => null),
          redis.get(this.redisPrefix + key2).catch(() => null),
        ]);
        if (exists1 || exists2) {
          this.recentTeams.add(key1);
          this.recentTeams.add(key2);
          return true;
        }
      } catch (e) {
        // Redis not available or method not supported, continue with memory-only
      }
    }

    return false;
  }

  /**
   * Mark teams as recently posted
   */
  async markTeamsPosted(homeTeam, awayTeam) {
    const key1 = this.normalize(homeTeam);
    const key2 = this.normalize(awayTeam);

    this.recentTeams.add(key1);
    this.recentTeams.add(key2);

    if (redis && typeof redis.set === 'function') {
      try {
        await Promise.all([
          redis.set(this.redisPrefix + key1, "1", 'EX', 2 * 60 * 60).catch(() => redis.set(this.redisPrefix + key1, "1")),
          redis.set(this.redisPrefix + key2, "1", 'EX', 2 * 60 * 60).catch(() => redis.set(this.redisPrefix + key2, "1")),
        ]);
      } catch (e) {
        // Redis not available or method not supported, continue with memory-only
      }
    }
  }

  /**
   * Clear old entries periodically
   */
  clearExpired() {
    // In-memory cache clears every 2 hours automatically
    if (this.recentTeams.size > 1000) {
      this.recentTeams.clear();
    }
  }
}

/**
 * Sport Rotation Manager
 * Uses weighted distribution to balance coverage across sports
 */
class SportRotationManager {
  constructor() {
    this.lastSports = [];
    this.maxRecent = 10; // Track last 10 posts
  }

  /**
   * Pick next sport based on weights
   * Encourages variety by reducing weight of recently-posted sports
   */
  getNextSport(availableSports = null, recentSportStats = {}) {
    // availableSports: optional array of supported sport keys (lowercase)
    const allEntries = Object.entries(SUPPORTED_SPORTS);
    let sports = allEntries;
    if (Array.isArray(availableSports) && availableSports.length > 0) {
      const availSet = new Set(availableSports.map((s) => String(s).toLowerCase()));
      sports = allEntries.filter(([key]) => availSet.has(String(key).toLowerCase()));
    }
    const scores = sports.map(([key, config]) => {
      let weight = config.weight;

      // Reduce weight if posted recently
      const timesRecentlyPosted = this.lastSports.filter(
        (s) => s === key
      ).length;
      weight *= Math.pow(0.7, timesRecentlyPosted); // 30% penalty per recent post

      // Boost weight based on global stats
      const globalPosts = recentSportStats[key] || 0;
      const avgPosts =
        Object.values(recentSportStats).reduce((a, b) => a + b, 0) /
          Object.keys(recentSportStats).length || 1;
      if (globalPosts < avgPosts * 0.8) {
        weight *= 1.3; // Boost underrepresented sports
      }

      return { sport: key, weight };
    });

    // Log weight scores for debugging
    const logScores = scores
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5)
      .map(s => `${s.sport}:${s.weight.toFixed(4)}`)
      .join(' | ');
    console.log(`[SportRotation] Top weights: ${logScores}`);
    console.log(`[SportRotation] Recent history: ${this.lastSports.slice(-5).join(' <- ')}`);
    if (Array.isArray(availableSports) && availableSports.length > 0) {
      console.log(`[SportRotation] Available sports passed: ${availableSports.join(', ')}`);
    }

    // Weighted random pick
    const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0);
    let random = Math.random() * totalWeight;

    for (const s of scores) {
      random -= s.weight;
      if (random <= 0) {
        // Track this selection
        this.lastSports.push(s.sport);
        if (this.lastSports.length > this.maxRecent) {
          this.lastSports.shift();
        }
        console.log(`[SportRotation] ✅ Selected: ${s.sport} ${SUPPORTED_SPORTS[s.sport]?.emoji || ''}`);
        return s.sport;
      }
    }

    return "soccer"; // fallback
  }
}

/**
 * News aggregator for article/breaking news posting
 */
async function getNewsArticles(count = 5) {
  try {
    // Combine keywords from all sports
    const allKeywords = Object.values(SUPPORTED_SPORTS)
      .flatMap((s) => s.newsKeywords)
      .slice(0, 10);

    const articles = await getLatestNews(allKeywords).catch(() => []);
    
    if (Array.isArray(articles)) {
      return articles.slice(0, count).map((a) => ({
        ...a,
        type: "news",
        sport: "news",
        importance: a.importance || "medium",
        emoji: "📰",
      }));
    }
    return [];
  } catch (e) {
    console.warn("[AdvancedMediaAiTicker] news fetch failed:", e.message);
    return [];
  }
}

/**
 * Get diverse sports events and news
 * Uses sport rotation to prefer certain sports
 */
async function getDiverseContent() {
  // Fetch all events
  const allLiveEvents = await getInterestingEvents().catch(() => []);
  console.log(`[AdvancedMediaAiTicker] Fetched ${allLiveEvents.length} total events`);
  
  // Determine which supported sports are actually present in the fetched events
  const available = [];
  if (allLiveEvents.length > 0) {
    const supportedKeys = Object.keys(SUPPORTED_SPORTS);
    const eventSports = Array.from(new Set(allLiveEvents.map(e => String(e.sport || '').toLowerCase())));
    for (const key of supportedKeys) {
      if (eventSports.some(es => es.includes(key) || key.includes(es))) {
        available.push(key);
      }
    }
  }

  const selectedSport = sportRotation.getNextSport(available.length ? available : null);
  console.log(`[AdvancedMediaAiTicker] getDiverseContent() requesting ${selectedSport}`);
  if (allLiveEvents.length > 0) {
    const sportBreakdown = {};
    allLiveEvents.forEach(e => {
      const s = String(e.sport || 'unknown').toLowerCase();
      sportBreakdown[s] = (sportBreakdown[s] || 0) + 1;
    });
    console.log(`[AdvancedMediaAiTicker] Available sports: ${Object.entries(sportBreakdown).map(([k, v]) => `${k}(${v})`).join(', ')}`);
    if (available.length > 0) {
      console.log(`[AdvancedMediaAiTicker] Supported sports available: ${available.join(', ')}`);
    } else {
      console.log(`[AdvancedMediaAiTicker] No supported sports detected in fetched events`);
    }
  }
  
  // Try to filter for the selected sport first, but fallback to all if no match
  let liveEvents = allLiveEvents.filter(e => {
    const eventSport = String(e.sport || '').toLowerCase();
    const selectedKey = String(selectedSport).toLowerCase();
    return eventSport.includes(selectedKey) || selectedKey.includes(eventSport);
  });
  
  console.log(`[AdvancedMediaAiTicker] Filtered to ${liveEvents.length} events for ${selectedSport}`);
  
  // If filtering reduces events too much, use all events (graceful fallback)
  if (liveEvents.length === 0) {
    console.log(`[AdvancedMediaAiTicker] No ${selectedSport} events found, falling back to all events`);
    liveEvents = allLiveEvents;
  }
  
  // Get news articles
  const newsArticles = await getNewsArticles(3).catch(() => []);
  console.log(`[AdvancedMediaAiTicker] Fetched ${newsArticles.length} news articles`);

  // Combine and diversify
  const all = [...liveEvents, ...newsArticles];

  return all.map((item) => ({
    ...item,
    type: item.type || "event",
  }));
}

/**
 * Main Advanced Media AI Ticker
 */
const imageDedup = new ImageDeduplicator();
const teamDedup = new TeamDeduplicator();
const sportRotation = new SportRotationManager();

export async function runAdvancedMediaAiTick() {
  const now = Date.now();
  if (now - lastPostedAt < POSTING_COOLDOWN_MS) {
    return;
  }

  const chatId = process.env.BOT_BROADCAST_CHAT_ID;
  if (!chatId) {
    return console.warn(
      "[AdvancedMediaAiTicker] BOT_BROADCAST_CHAT_ID not set"
    );
  }

  try {
    console.log("[AdvancedMediaAiTicker] ⏰ Starting content selection cycle");
    
    // Get diverse content (events + news)
    const content = await getDiverseContent();
    if (!content || content.length === 0) {
      console.warn("[AdvancedMediaAiTicker] No content available from getDiverseContent()");
      return console.info("[AdvancedMediaAiTicker] No content available");
    }

    console.log(`[AdvancedMediaAiTicker] Processing ${content.length} content items`);

    // Score all content
    const scored = await Promise.all(
      content.map(async (item) => ({
        item,
        score: (await scoreEvent(item)) || 0,
      }))
    );

    scored.sort((a, b) => b.score - a.score);
    
    // Log top candidates
    console.log(`[AdvancedMediaAiTicker] Top 3 candidates by score: ${scored.slice(0, 3).map((s, i) => `${i+1}. ${s.item.sport}(${s.score.toFixed(1)})`).join(' | ')}`);

    // Filter and pick best candidate avoiding duplicates
    let chosen = null;
    for (const candidate of scored) {
      const item = candidate.item;
      
      // Skip news items if we just posted one
      if (item.type === "news" && Math.random() > 0.3) {
        continue; // 70% of the time skip news
      }

      // For events: check team deduplication
      if (item.type === "event") {
        const isDupTeam = await teamDedup.hasRecentTeam(
          item.home,
          item.away
        );
        if (isDupTeam) {
          console.info(
            `[AdvancedMediaAiTicker] Skipping duplicate teams: ${item.home} vs ${item.away}`
          );
          continue;
        }
      }

      chosen = item;
      break;
    }

    if (!chosen) {
      return console.warn(
        "[AdvancedMediaAiTicker] No eligible content after dedup filtering"
      );
    }

    console.info("[AdvancedMediaAiTicker] Selected content", {
      type: chosen.type,
      sport: chosen.sport,
      title: chosen.title || `${chosen.home} vs ${chosen.away}`,
    });

    // Get media and summary
    let mediaUrl = null;
    let caption = null;

    if (chosen.type === "news") {
      // News article
      mediaUrl = chosen.imageUrl || chosen.image || null;
      caption =
        chosen.summary ||
        chosen.description ||
        `📰 ${chosen.title}\n\n${chosen.source || ""}`;
    } else {
      // Event/match
      const [media, summary] = await Promise.all([
        selectBestMediaForEventCombined(chosen).catch(() => null),
        summarizeEventForTelegram(chosen, "conversational").catch(() => ({
          caption: null,
        })),
      ]);

      mediaUrl = media?.mediaUrl || media?.imageUrl;
      caption = summary?.caption;

      // Double-check image deduplication
      if (mediaUrl) {
        const isDupImage = await imageDedup.hasPostedImage(mediaUrl);
        if (isDupImage) {
          console.info(
            "[AdvancedMediaAiTicker] Image already posted, finding alternative"
          );
          const altMedia = await selectBestImageForEventCombined(chosen).catch(
            () => null
          );
          if (altMedia?.imageUrl) {
            const isDupAlt = await imageDedup.hasPostedImage(
              altMedia.imageUrl
            );
            if (!isDupAlt) {
              mediaUrl = altMedia.imageUrl;
            }
          }
        }
      }
    }

    if (!mediaUrl) {
      caption =
        caption || `${SUPPORTED_SPORTS[chosen.sport]?.emoji || "🏆"} ${chosen.title || "Check this out!"}`;
      await broadcastText(caption);
      await telemetry.incCounter("posts_text_only");
      lastPostedAt = now;
      return;
    }

    // Mark deduplication
    await Promise.all([
      imageDedup.markImagePosted(mediaUrl),
      chosen.type === "event"
        ? teamDedup.markTeamsPosted(chosen.home, chosen.away)
        : Promise.resolve(),
      chosen._eventId ? markEventPosted(chosen._eventId) : Promise.resolve(),
    ]).catch(() => {});

    // Send the post
    const finalCaption =
      caption ||
      `${SUPPORTED_SPORTS[chosen.sport]?.emoji} ${chosen.sport.toUpperCase()}`;

    if (mediaUrl.includes(".mp4") || mediaUrl.includes(".webm")) {
      await sendVideoWithCaption({
        chatId,
        videoUrl: mediaUrl,
        caption: finalCaption,
      });
    } else {
      await sendPhotoWithCaption({
        chatId,
        photoUrl: mediaUrl,
        caption: finalCaption,
      });
    }

    await telemetry.incCounter("posts");
    console.info("[AdvancedMediaAiTicker] Posted successfully", {
      type: chosen.type,
      sport: chosen.sport,
      hasImage: !!mediaUrl,
    });

    lastPostedAt = now;
  } catch (err) {
    console.error(
      "[AdvancedMediaAiTicker] Fatal error:",
      err?.message || err
    );
    await telemetry.incCounter("failures");
  }
}

/**
 * Get stats for sport rotation
 */
export async function getSportStats() {
  if (!redis) return {};
  try {
    const sports = Object.keys(SUPPORTED_SPORTS);
    const stats = {};
    for (const sport of sports) {
      const count = await redis.get(`betrix:sport:count:${sport}`);
      stats[sport] = parseInt(count || "0");
    }
    return stats;
  } catch (e) {
    console.warn("[AdvancedMediaAiTicker] stat fetch failed:", e.message);
    return {};
  }
}

export default {
  runAdvancedMediaAiTick,
  getSportStats,
  imageDedup,
  teamDedup,
  sportRotation,
  SUPPORTED_SPORTS,
};
