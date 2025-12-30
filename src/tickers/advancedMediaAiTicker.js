
// --- ES5 FUNCTION CONSTRUCTORS (top-level) ---
import { getInterestingEvents, setSportsAggregator } from "../aggregator/multiSportAggregator.js";
import { getLatestNews } from "../aggregator/newsAggregator.js";
import { summarizeEventForTelegram } from "../ai/summarizer.js";
import { selectBestImageForEventCombined, selectBestMediaForEventCombined } from "../media/imageSelector.js";
import { sendPhotoWithCaption, sendVideoWithCaption } from "../services/telegram-sender.js";
import { scoreEvent } from "../brain/interestScorer.js";
import { buildEventId, hasPostedWithin, markEventPosted } from "../brain/memory.js";
import { bumpEventMention } from "../brain/trending.js";
import telemetry from "../brain/telemetry.js";
import { broadcastText } from "../telegram/broadcast.js";
import { ADVANCED_MEDIA_CONFIG } from "../config/advancedMediaConfig.js";
import crypto from "crypto";

function ImageDeduplicator() {
  this.hashCache = new Map(); // In-memory cache
  this.redisPrefix = "betrix:posted:image:";
}
ImageDeduplicator.prototype.hashUrl = function(url) {
  if (!url) return null;
  return crypto.createHash("sha256").update(url).digest("hex");
};
ImageDeduplicator.prototype.hasPostedImage = function(imageUrl) {
  if (!imageUrl) return false;
  var hash = this.hashUrl(imageUrl);
  if (this.hashCache.has(hash)) {
    return true;
  }
  // ...existing code...
};

function TeamDeduplicator() {
  this.recentTeams = new Set();
  this.redisPrefix = "betrix:recent:team:";
  this.windowMs = 2 * 60 * 60 * 1000; // 2 hours
}
TeamDeduplicator.prototype.normalize = function(name) {
  if (!name) return "";
  return name.toLowerCase().trim().replace(/\s+/g, "_");
};

function SportRotationManager() {
  this.lastSports = [];
  this.maxRecent = 10; // Track last 10 posts
}
SportRotationManager.prototype.getNextSport = function(availableSports, recentSportStats) {
  if (typeof availableSports === 'undefined') availableSports = null;
  if (typeof recentSportStats === 'undefined') recentSportStats = {};
  var allEntries = Object.entries(SUPPORTED_SPORTS);
  var sports = allEntries;
  if (Array.isArray(availableSports) && availableSports.length > 0) {
    var availSet = new Set(availableSports.map(function(s) { return String(s).toLowerCase(); }));
    sports = allEntries.filter(function(entry) { return availSet.has(String(entry[0]).toLowerCase()); });
  }
  var scores = sports.map(function(entry) {
    var key = entry[0];
    var config = entry[1];
    var weight = config.weight;
    var timesRecentlyPosted = this.lastSports.filter(function(s) { return s === key; }).length;
    weight *= Math.pow(0.7, timesRecentlyPosted);
    var globalPosts = recentSportStats[key] || 0;
    var avgPosts = Object.values(recentSportStats).reduce(function(a, b) { return a + b; }, 0) /
      (Object.keys(recentSportStats).length || 1);
    if (globalPosts < avgPosts * 0.8) {
      weight *= 1.3;
    }
    return { sport: key, weight: weight };
  }, this);
  var logScores = scores.slice().sort(function(a, b) { return b.weight - a.weight; }).slice(0, 5).map(function(s) { return s.sport + ':' + s.weight.toFixed(4); }).join(' | ');
  console.log('[SportRotation] Top weights: ' + logScores);
  console.log('[SportRotation] Recent history: ' + this.lastSports.slice(-5).join(' <- '));
  if (Array.isArray(availableSports) && availableSports.length > 0) {
    console.log('[SportRotation] Available sports passed: ' + availableSports.join(', '));
  }
  var totalWeight = scores.reduce(function(sum, s) { return sum + s.weight; }, 0);
  var random = Math.random() * totalWeight;
  for (var i = 0; i < scores.length; i++) {
    random -= scores[i].weight;
    if (random <= 0) {
      return scores[i].sport;
    }
  }
  return "soccer";
};
SportRotationManager.prototype.add = function(sport) {
  this.lastSports.push(sport);
  if (this.lastSports.length > this.maxRecent) {
    this.lastSports.shift();
  }
};
SportRotationManager.prototype.getRecent = function() {
  return this.lastSports.slice();
};
SportRotationManager.prototype.clear = function() {
  this.lastSports = [];
};

var redis = null;
function setRedisClient(r) {
  redis = r;
}

var POSTING_COOLDOWN_MS = Number(process.env.MEDIA_AI_COOLDOWN_MS || 30 * 1000);
var lastPostedAt = 0;

var getSupportedSports = function() {
  var weights = ADVANCED_MEDIA_CONFIG.SPORT_WEIGHTS || {
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
  };
};

var SUPPORTED_SPORTS = getSupportedSports();

function getDiverseContent() {
  var allLiveEvents = getInterestingEvents().catch(function() { return []; });
  console.log('[AdvancedMediaAiTicker] Fetched ' + allLiveEvents.length + ' total events');
  var available = [];
  if (allLiveEvents.length > 0) {
    var supportedKeys = Object.keys(SUPPORTED_SPORTS);
    var eventSports = Array.from(new Set(allLiveEvents.map(function(e) { return String(e.sport || '').toLowerCase(); })));
    for (var i = 0; i < supportedKeys.length; i++) {
      var key = supportedKeys[i];
      if (eventSports.some(function(es) { return es.indexOf(key) !== -1 || key.indexOf(es) !== -1; })) {
        available.push(key);
      }
    }
  }
  var selectedSport = sportRotation.getNextSport(available.length ? available : null);
  console.log('[AdvancedMediaAiTicker] getDiverseContent() requesting ' + selectedSport);
  if (allLiveEvents.length > 0) {
    var sportBreakdown = {};
    allLiveEvents.forEach(function(e) {
      var s = String(e.sport || 'unknown').toLowerCase();
      sportBreakdown[s] = (sportBreakdown[s] || 0) + 1;
    });
    console.log('[AdvancedMediaAiTicker] Available sports: ' + Object.entries(sportBreakdown).map(function(entry) { return entry[0] + '(' + entry[1] + ')'; }).join(', '));
    if (available.length > 0) {
      console.log('[AdvancedMediaAiTicker] Supported sports available: ' + available.join(', '));
    }
  }
  var all;
  if ((liveEvents.length === 0 || !liveEvents) && newsArticles.length > 0) {
    console.log('[AdvancedMediaAiTicker] No events for ' + selectedSport + '; preferring news fallback');
    all = newsArticles.slice();
  } else {
    all = liveEvents.concat(newsArticles);
  }
  return all.map(function(item) {
    var result = {};
    for (var prop in item) {
      if (Object.prototype.hasOwnProperty.call(item, prop)) {
        result[prop] = item[prop];
      }
    }
    result.type = item.type || 'event';
    return result;
  });
}


function runAdvancedMediaAiTick() {
  // TODO: Implement the main ticker logic here (ES5 style)
  // This is a placeholder to prevent import errors
  return null;
}


export {
  getSportStats,
  imageDedup,
  teamDedup,
  sportRotation,
  SUPPORTED_SPORTS,
  runAdvancedMediaAiTick,
  setRedisClient
};
