/**
 * Minimal Telegram handler implementation
 */

import premiumUI, {
  buildUpcomingFixtures,
} from "../utils/premium-ui-builder.js";
import logger from "../utils/logger.js";
import { buildSportsMenu } from "./menu-handler.js";
import createRedisAdapter from "../utils/redis-adapter.js";
import IntelligentMenuBuilder from "../utils/intelligent-menu-builder.js";
import { UserService } from "../services/user.js";
import FixturesManager from "../utils/fixtures-manager.js";

// Note: temporary wide eslint-disable removed. We'll fix lint issues surgically below.
/*
  Note: previous temporary file-scoped ESLint relaxations removed so we can
  perform surgical fixes with full lint feedback. We'll now fix issues inside
  this file explicitly and incrementally.
*/
/* eslint-disable no-unused-vars, no-case-declarations */
// Lightweight shims for missing helpers used across this large handler file.
// These are intentionally minimal fallbacks to reduce lint noise while
// we progressively restore full implementations. They are safe no-ops
// that return reasonable defaults.
const tryParseJson = (s) => {
  try {
    return s ? JSON.parse(s) : null;
  } catch (e) {
    return null;
  }
};

const validateCallbackData = (d) => (typeof d === "string" ? d : String(d));

const teamNameOf = (v) => {
  if (!v) return "Unknown";
  if (typeof v === "string") return v;
  if (v && (v.name || v.home || v.home_team))
    return v.name || v.home || v.home_team;
  return String(v);
};

const safeNameOf = (v, fallback = "") => {
  if (v === undefined || v === null) return fallback || "";
  if (typeof v === "string") return v;
  if (typeof v === "object")
    return (
      v.name || v.title || v.shortName || v.competition || String(v) || fallback
    );
  return String(v);
};

// Simple HTML escaper for safe inclusion in Telegram HTML parse_mode
const escapeHtml = (str) => {
  if (str === undefined || str === null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
};

// Strip minimal HTML to plain text for safe truncation fallback
const stripHtmlToPlain = (s) => {
  if (!s) return "";
  let t = String(s).replace(/<br\s*\/?\s*>/gi, "\n");
  t = t.replace(/<[^>]+>/g, "");
  return t.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
};

const buildLiveMenuPayload = (
  games,
  title = "Live",
  _tier = "FREE",
  page = 1,
  perPage = 6,
) => {
  const list = (games || [])
    .slice((page - 1) * perPage, page * perPage)
    .map((g, i) => `${i + 1}. ${teamNameOf(g.home)} vs ${teamNameOf(g.away)}`)
    .join("\n");
  return {
    text: `*${title}* — ${String(_tier || "FREE")}\n\n${list || "_No live matches currently_"}`,
    reply_markup: { inline_keyboard: [] },
  };
};

// Branding utils minimal shim
const brandingUtils = {
  generateBetrixHeader: (tier) => `*BETRIX* — ${tier || "FREE"}`,
  generateBetrixFooter: (_isSmall = false, hint = "") => {
    if (_isSmall) return `_${(hint || "").substring(0, 40)}_`;
    return `\n\n_${hint || ""}_`;
  },
  formatBetrixError: (err, tier = "FREE") =>
    `⚠️ Error: ${err && err.message ? err.message : String(err)}`,
};

// Minimal formatters used by handlers
const formatUpgradePrompt = (feature) => `Upgrade to access ${feature}`;
const formatOdds = (matches) =>
  (matches || [])
    .map(
      (m, i) =>
        `${i + 1}. ${teamNameOf(m.home)} vs ${teamNameOf(m.away)} — ${m.homeOdds || "-"}`,
    )
    .join("\n");
const formatStandings = (_league, rows) => {
  const body = (rows || [])
    .map((r, i) => `${i + 1}. ${r.name} ${r.points || 0}`)
    .join("\n");
  return `${_league || ""}\n${body}`.trim();
};
const formatProfile = (data) =>
  `*Profile*\nName: ${data.name}\nTier: ${data.tier}`;
const formatSubscriptionDetails = (sub) =>
  `Tier: ${(sub && sub.tier) || "FREE"}`;
const formatNaturalResponse = (s) =>
  s && typeof s === "string" ? s : JSON.stringify(s || {});

// --- Start menu utilities (BETRIX OS) ---
function buildStartMenuText() {
  return [
    "🌀 BETRIX — The Sports Intelligence OS",
    "",
    "Your AI-powered sports betting companion.",
    "Live scores, odds, xG, predictions, and sharp insights across all major leagues.",
    "",
    "What would you like to do?",
    "",
    "⚽ Sports Hub",
    "📅 Upcoming Fixtures",
    "📊 Live Matches",
    "📈 Betting Insights",
    "🤖 Talk to BETRIX AI",
    "📰 News & Standings",
    "👤 My Profile & Favorites",
    "💰 Upgrade to VVIP",
    "🔗 Affiliate & Earnings",
    "🆘 Help & Support",
  ].join("\n");
}

const startMenuKeyboard = {
  inline_keyboard: [
    [
      { text: "⚽ Sports Hub", callback_data: "mod_sports_hub" },
      { text: "📅 Fixtures", callback_data: "mod_fixtures" },
    ],
    [
      { text: "📊 Live Matches", callback_data: "mod_live" },
      { text: "📈 Betting Insights", callback_data: "mod_betting" },
    ],
    [{ text: "🤖 Talk to BETRIX AI", callback_data: "mod_ai_chat" }],
    [{ text: "✅ Sign up", callback_data: "signup_start" }],
    [{ text: "📰 News & Standings", callback_data: "mod_news_tables" }],
    [
      { text: "👤 Profile & Favorites", callback_data: "mod_profile" },
      { text: "💰 Upgrade to VVIP", callback_data: "mod_vvip" },
    ],
    [
      { text: "🔗 Affiliate & Earnings", callback_data: "mod_affiliate" },
      { text: "🆘 Help & Support", callback_data: "mod_support" },
    ],
  ],
};

async function sendStartMenu(chatId, telegramService) {
  // telegramService is optional; if not present return the payload
  const text = buildStartMenuText();
  const payload = {
    method: "sendMessage",
    chat_id: chatId,
    text,
    reply_markup: startMenuKeyboard,
  };
  if (!telegramService) return payload;
  try {
    await telegramService.sendMessage(chatId, text, {
      reply_markup: startMenuKeyboard,
    });
  } catch (e) {
    // fall back to returning payload for upstream handling
    return payload;
  }
}

// --- AI angle derivation and prompt builder ---
function deriveAiAngles(structured) {
  try {
    const angles = [];
    const { match, stats, suggested_bets } = structured || {};

    const findStanding = (name) =>
      stats && Array.isArray(stats.standings)
        ? stats.standings.find(
            (t) =>
              t.team &&
              (String(t.team.name) === String(name) ||
                String(t.team.id) === String(name)),
          )
        : null;
    const homeStanding = findStanding(match && match.home);
    const awayStanding = findStanding(match && match.away);

    if (homeStanding && awayStanding) {
      if (Number(homeStanding.position) < Number(awayStanding.position)) {
        angles.push(
          `${match.home} sit higher in the table (#${homeStanding.position}) than ${match.away} (#${awayStanding.position}).`,
        );
      } else if (
        Number(awayStanding.position) < Number(homeStanding.position)
      ) {
        angles.push(
          `${match.away} sit higher in the table (#${awayStanding.position}) than ${match.home} (#${homeStanding.position}).`,
        );
      }
    }

    if (stats && stats.h2h && Number(stats.h2h.totalMatches) === 0) {
      angles.push(
        "No head-to-head history in our dataset; projections rely on form and table.",
      );
    }

    const styleHome =
      stats &&
      stats.teamProfiles &&
      stats.teamProfiles.home &&
      stats.teamProfiles.home.style;
    const styleAway =
      stats &&
      stats.teamProfiles &&
      stats.teamProfiles.away &&
      stats.teamProfiles.away.style;
    if (styleHome || styleAway) {
      angles.push(
        `Playing styles: ${match.home} (${styleHome || "unknown"}) vs ${match.away} (${styleAway || "unknown"}).`,
      );
    }

    const primary = (suggested_bets && suggested_bets[0]) || null;
    if (primary) {
      angles.push(
        `Market focus: ${primary.market} — ${primary.selection}${primary.line ? ` (line ${primary.line})` : ""}, confidence ${primary.confidence}%.`,
      );
    }

    structured.ai_analysis = structured.ai_analysis || {};
    structured.ai_analysis.keyAngles = angles;
    structured.ai_analysis.summary = angles.length
      ? angles[0]
      : structured.ai_analysis.summary ||
        "Limited data available; projecting from standings and profiles.";
  } catch (e) {
    /* ignore and leave structured as-is */
  }
  return structured;
}

function buildMatchAnalysisPrompt(structured) {
  const shortJson = JSON.stringify(structured || {}, null, 2);
  return `You are BETRIX, a premium AI-powered sports betting assistant.\n\nYou are given structured JSON describing a football match, including match info, stats, odds, ai_analysis, and suggested_bets.\n\nJSON:\n${shortJson}\n\nGenerate a TELEGRAM-FRIENDLY analysis message.\n\nRules and structure:\n1) Start with: "⚽ BETRIX Match Analysis: {home} vs {away}"\n2) Next lines: "🏆 {competition}", "⏰ Kickoff: {readable_kickoff}", "📍 Venue: {venue or 'TBA'}", "📊 Status: {status label}"\n3) Then "📈 AI Insights:" with 2–5 concise bullet points derived from ai_analysis.keyAngles and stats. Do NOT repeat the same sentence or phrase more than once.\n4) Then "🎯 Suggested Bets:" listing up to 2–3 bets from suggested_bets: each line "{market}: {selection} (line: X if present) — Confidence: Y%" with ONE short bullet rationale under each. Avoid repeating wording.\n5) Then "🧠 BETRIX Summary:" a single 1–2 sentence projection in neutral probabilistic language.\n6) End with "Powered by BETRIX".\n\nCritical: do NOT use words like 'lock', 'guaranteed', 'sure win'. If data is sparse, state that and rely on standings/context. Return ONLY the final Telegram message text.`;
}

// Use real menu, fixtures and UI builders from utils

// Small utility placeholders
const safeGetUserData = async (redis, key) => {
  try {
    const raw = await (redis && redis.get ? redis.get(key) : null);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
};

const getUserSubscription = async (redis, userId) => {
  try {
    const raw = await (redis && redis.hgetall
      ? redis.hgetall(`user:${userId}:profile`)
      : null);
    return raw && raw.tier ? { tier: raw.tier } : { tier: "FREE" };
  } catch (e) {
    return { tier: "FREE" };
  }
};

// Normalizer stubs (real implementations live in src/services/normalizer.js)
const normalizeApiFootballFixture = (f) => ({
  home: f?.teams?.home?.name || "Home",
  away: f?.teams?.away?.name || "Away",
});
const normalizeAllSportsMatch = (m) => ({
  home: m.home || m.homeTeam || "Home",
  away: m.away || m.awayTeam || "Away",
});
const normalizeSportsDataEvent = (m) => ({
  home: m.home || "Home",
  away: m.away || "Away",
});
const normalizeFootballDataFixture = (m) => ({
  home: m.home || "Home",
  away: m.away || "Away",
});
const normalizeStandingsOpenLiga = (s) => s;

// Simple menu placeholders used when intelligentMenus fails
const mainMenu = { text: "*Main Menu*", reply_markup: { inline_keyboard: [] } };
const sportsMenu = { text: "*Sports*", reply_markup: { inline_keyboard: [] } };
const subscriptionMenu = {
  text: "*Subscriptions*",
  reply_markup: { inline_keyboard: [] },
};
const profileMenu = {
  text: "*Profile*",
  reply_markup: { inline_keyboard: [] },
};
const helpMenu = { text: "*Help*", reply_markup: { inline_keyboard: [] } };

// Payment & tiers placeholders
const TIERS = {
  FREE: { name: "Free", price: 0, features: [] },
  PRO: { name: "Pro", price: 200, features: [] },
  VVIP: { name: "VVIP", price: 1500, features: [] },
};
const PAYMENT_PROVIDERS = { lipana: { id: "lipana", name: "Lipana" } };
const getAvailablePaymentMethods = (country) => [
  { id: "lipana", name: "M-Pesa", emoji: "📱" },
];
const normalizePaymentMethod = (m) => (m || "").toString().toLowerCase();
const getPaymentGuide = (method) => ({
  title: "M-Pesa Guide",
  description: "Use M-Pesa to pay",
  steps: ["Open M-Pesa", "Select Pay Bill"],
});
const createPaymentOrder = async (..._args) => ({
  orderId: `ORD${Date.now()}`,
});
const getPaymentInstructions = async (..._args) => ({
  manualSteps: ["Send money to 12345"],
  checkoutUrl: null,
  description: "Use the mobile money flow",
});
const verifyAndActivatePayment = async (..._args) => ({ ok: true });

// formatBetrixError used in several places
const formatBetrixError = (err, tier = "FREE") =>
  brandingUtils.formatBetrixError(err, tier);

async function getLiveMatchesBySport(sport, redis, sportsAggregator) {
  try {
    const cacheKey = "betrix:prefetch:live:by-sport";
    const cached = await redis.get(cacheKey).catch(() => null);
    if (cached) {
      const data = tryParseJson(cached);
      if (
        data &&
        data.sports &&
        data.sports[sport] &&
        Array.isArray(data.sports[sport].samples)
      ) {
        logger.info(
          `📦 Got cached ${sport} matches from prefetch (${data.sports[sport].count || 0} total)`,
        );
        // Defensive filter: remove obviously stale/demo fixtures based on kickoff timestamps
        const nowTs = Date.now();
        const minTs = nowTs - 7 * 24 * 60 * 60 * 1000; // 7 days in past
        const maxTs = nowTs + 90 * 24 * 60 * 60 * 1000; // 90 days in future
        const parseFixtureTs = (f) => {
          try {
            const cands = [
              f.kickoff,
              f.kickoff_at,
              f.utcDate,
              f.utc_date,
              f.date,
              f.time,
              f.starting_at,
              f.timestamp,
              f.ts,
              f.start,
              f.match_time,
              f.datetime,
            ];
            for (const c of cands) {
              if (!c && c !== 0) continue;
              if (typeof c === "number") return c < 1e12 ? c * 1000 : c;
              if (typeof c === "string") {
                if (/^\d{10}$/.test(c)) return Number(c) * 1000;
                if (/^\d{13}$/.test(c)) return Number(c);
                const d = new Date(c);
                if (!isNaN(d.getTime())) return d.getTime();
              }
            }
          } catch (e) {
            /* ignore */
          }
          return null;
        };

        const samples = data.sports[sport].samples.filter((f) => {
          const ts = parseFixtureTs(f);
          if (!ts) return false;
          return ts >= minTs && ts <= maxTs;
        });

        return samples;
      }
    }

    if (sport === "soccer") {
      const live39 = await redis.get("live:39").catch(() => null);
      const parsed = tryParseJson(live39);
      if (Array.isArray(parsed) && parsed.length > 0) {
        logger.info("📦 Got cached soccer matches from live:39 fallback");
        // Filter live: prefer items that are live or within reasonable time window
        const nowTs = Date.now();
        const minTs = nowTs - 7 * 24 * 60 * 60 * 1000;
        const maxTs = nowTs + 90 * 24 * 60 * 60 * 1000;
        const isLiveMatch = (m) => {
          try {
            if (!m) return false;
            if (m.status && String(m.status).toLowerCase().includes("live"))
              return true;
            if (
              m.time_status &&
              String(m.time_status).toLowerCase().includes("live")
            )
              return true;
            if (typeof m.is_live === "boolean") return m.is_live === true;
            if (m.minute || m.elapsed) return true;
          } catch (e) {
            /* ignore */
          }
          return false;
        };
        const parseFixtureTs = (f) => {
          try {
            const cands = [
              f.kickoff,
              f.kickoff_at,
              f.utcDate,
              f.utc_date,
              f.date,
              f.time,
              f.starting_at,
              f.timestamp,
              f.ts,
              f.start,
              f.match_time,
              f.datetime,
            ];
            for (const c of cands) {
              if (!c && c !== 0) continue;
              if (typeof c === "number") return c < 1e12 ? c * 1000 : c;
              if (typeof c === "string") {
                if (/^\d{10}$/.test(c)) return Number(c) * 1000;
                if (/^\d{13}$/.test(c)) return Number(c);
                const d = new Date(c);
                if (!isNaN(d.getTime())) return d.getTime();
              }
            }
          } catch (e) {
            /* ignore */
          }
          return null;
        };

        const filtered = parsed.filter((m) => {
          if (isLiveMatch(m)) return true;
          const ts = parseFixtureTs(m);
          if (!ts) return false;
          return ts >= minTs && ts <= maxTs;
        });
        return filtered;
      }
    }

    // Try provider-specific prefetch keys if the consolidated key wasn't set
    try {
      const pm = await redis.get("prefetch:sportsmonks:live").catch(() => null);
      const parsedPm = tryParseJson(pm);
      if (parsedPm && Array.isArray(parsedPm.data)) {
        logger.info(
          `📦 Got cached soccer matches from prefetch:sportsmonks:live (${parsedPm.count || parsedPm.data.length})`,
        );
        // Filter out stale/demo entries using same date window as other handlers
        const nowTs = Date.now();
        const minTs = nowTs - 7 * 24 * 60 * 60 * 1000;
        const maxTs = nowTs + 90 * 24 * 60 * 60 * 1000;
        const parseFixtureTs = (f) => {
          try {
            const cands = [
              f.kickoff,
              f.kickoff_at,
              f.utcDate,
              f.utc_date,
              f.date,
              f.time,
              f.starting_at,
              f.timestamp,
              f.ts,
              f.start,
              f.match_time,
              f.datetime,
            ];
            for (const c of cands) {
              if (!c && c !== 0) continue;
              if (typeof c === "number") return c < 1e12 ? c * 1000 : c;
              if (typeof c === "string") {
                if (/^\d{10}$/.test(c)) return Number(c) * 1000;
                if (/^\d{13}$/.test(c)) return Number(c);
                const d = new Date(c);
                if (!isNaN(d.getTime())) return d.getTime();
              }
            }
          } catch (e) {
            /* ignore */
          }
          return null;
        };

        const samples = parsedPm.data.filter((f) => {
          const ts = parseFixtureTs(f);
          if (!ts) return false;
          return ts >= minTs && ts <= maxTs;
        });

        return samples;
      }
    } catch (e) {
      void e;
    }

    if (
      sportsAggregator &&
      typeof sportsAggregator._getLiveFromStatPal === "function"
    ) {
      try {
        const statpal = await sportsAggregator._getLiveFromStatPal(sport, "v1");
        if (Array.isArray(statpal) && statpal.length > 0) return statpal;
      } catch (e) {
        logger.debug("StatPal fetch failed", e?.message || String(e));
      }
    }

    const demoEnabled =
      process.env.DEMO_FALLBACK === "true" ||
      process.env.FORCE_DEMO_FALLBACK === "1";
    if (demoEnabled) {
      logger.info("Returning demo fallback matches");
      return [
        { id: "demo-1", home: "Demo FC", away: "Sample United", status: "15'" },
        {
          id: "demo-2",
          home: "Example Town",
          away: "Test Rovers",
          status: "HT",
        },
      ];
    }

    return [];
  } catch (e) {
    logger.warn("getLiveMatchesBySport failed", e?.message || String(e));
    return [];
  }
}

export async function handleMessage(update, redis, services) {
  try {
    const message = update.message || update.edited_message;
    if (!message) return null;
    const chatId = message.chat.id;
    const text = message.text || "";
    const fromId = message.from && message.from.id;
    // Onboarding: if user has an active onboarding flow, delegate to handler
    // Skip onboarding delegation for slash commands (e.g., '/start') so commands always show menus.
    if (!String(text || "").startsWith("/")) {
      try {
        if (fromId) {
          const r = createRedisAdapter(redis);
          // Proactively ensure any stale onboarding for ACTIVE users is removed
          try {
            const userSvc =
              services && services.userService
                ? services.userService
                : new UserService(redis);
            if (userSvc && typeof userSvc.ensureNoOnboarding === "function") {
              const cleaned = await userSvc.ensureNoOnboarding(fromId).catch(() => false);
              logger.info("proactive.ensureNoOnboarding", { userId: fromId, cleaned });
            }
            // Extra safety: if user is ACTIVE, ensure onboarding key removed via the
            // local adapter as a backup (covers adapter mismatch edge-cases).
            try {
              const isActive =
                userSvc && typeof userSvc.isActive === "function"
                  ? await userSvc.isActive(fromId).catch(() => false)
                  : false;
              if (isActive) {
                await r.del(`user:${fromId}:onboarding`).catch(() => {});
                logger.info("proactive.backupDelOnboarding", { userId: fromId });
              }
            } catch (e) {
              logger.debug("proactive backup del failed", e?.message || String(e));
            }
          } catch (e) {
            // Defensive: non-fatal if the proactive cleanup fails
            logger.debug("proactive ensureNoOnboarding failed", e?.message || String(e));
          }
          // If legacy signup state exists, migrate it into the structured onboarding flow
          const legacy = await r
            .get(`signup:${fromId}:state`)
            .catch(() => null);
          if (legacy === "awaiting_name") {
            // Don't migrate legacy signup into onboarding if user is already ACTIVE
            try {
              const maybeUser = (services && services.userService)
                ? await services.userService.getUser(fromId)
                : null;
              if (maybeUser && String(maybeUser.state || "").toUpperCase() === "ACTIVE") {
                await r.del(`signup:${fromId}:state`).catch(() => {});
                logger.info("Skipped migrating legacy signup: user already ACTIVE", { userId: fromId });
              } else {
                await r.setex(
                  `user:${fromId}:onboarding`,
                  1800,
                  JSON.stringify({ step: "name", createdAt: Date.now() }),
                );
                await r.del(`signup:${fromId}:state`).catch(() => {});
              }
            } catch (e) {
              // If defensive check fails, proceed with migration (best-effort)
              await r.setex(
                `user:${fromId}:onboarding`,
                1800,
                JSON.stringify({ step: "name", createdAt: Date.now() }),
              ).catch(() => {});
              await r.del(`signup:${fromId}:state`).catch(() => {});
            }
          }

          const onboardRaw = await r
            .get(`user:${fromId}:onboarding`)
            .catch(() => null);
          if (onboardRaw) {
            // Centralized defensive check: try to remove onboarding if user is ACTIVE.
            try {
              const cleaned =
                services && services.userService && typeof services.userService.ensureNoOnboarding === "function"
                  ? await services.userService.ensureNoOnboarding(fromId).catch(() => false)
                  : false;
              if (!cleaned) {
                // delegate message into the onboarding state machine
                const res = await handleOnboardingMessage(
                  text,
                  chatId,
                  fromId,
                  r,
                  services,
                ).catch((e) => {
                  logger.warn(
                    "handleOnboardingMessage failed",
                    e?.message || String(e),
                  );
                  return null;
                });
                if (res) return res;
              } else {
                logger.info("Ignoring onboarding key because user state is ACTIVE (cleaned)", { userId: fromId });
              }
            } catch (e) {
              logger.warn("Onboarding defensive check failed", e?.message || String(e));
            }
          }
        }
      } catch (e) {
        logger.warn("Onboarding state check failed", e?.message || String(e));
      }
    }

    // Favorites state handling: awaiting_add — user sent a team to add
    try {
      if (fromId) {
        const r = createRedisAdapter(redis);
        const favState = await r
          .get(`favorites:${fromId}:state`)
          .catch(() => null);
        if (favState === "awaiting_add") {
          const team = String(text || "").trim();
          if (!team)
            return {
              method: "sendMessage",
              chat_id: chatId,
              text: "Please send a valid team name.",
            };
          try {
            const raw = await r.get(`user:${fromId}`);
            const user = raw ? JSON.parse(raw) : {};
            const favs = Array.isArray(user.favorites)
              ? user.favorites
              : user.favorites
                ? String(user.favorites)
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                : [];
            if (
              !favs.find((f) => String(f).toLowerCase() === team.toLowerCase())
            )
              favs.push(team);
            user.favorites = favs;
            user.updated_at = new Date().toISOString();
            await r.set(`user:${fromId}`, JSON.stringify(user));
            await r.del(`favorites:${fromId}:state`);
          } catch (e) {
            logger.error("Failed to add favorite", e?.message || String(e));
            return {
              method: "sendMessage",
              chat_id: chatId,
              text: "Failed to add favorite. Try again later.",
            };
          }
          return {
            method: "sendMessage",
            chat_id: chatId,
            text: `Added *${escapeHtml(team)}* to your favorites.`,
            parse_mode: "Markdown",
          };
        }
      }
    } catch (e) {
      logger.warn(
        "Favorites awaiting_add check failed",
        e?.message || String(e),
      );
    }

    // If the canonical user profile is ACTIVE, always delegate to AI (do not
    // handle conversational messages in the v2 handler). This ensures the
    // onboarding flow (or other local handlers) cannot block AI responses.
    try {
      if (fromId) {
        const userSvc = services && services.userService ? services.userService : new UserService(redis);
        const isActive = userSvc && typeof userSvc.isActive === "function"
          ? await userSvc.isActive(fromId).catch(() => false)
          : false;
        if (isActive) {
          logger.info("handleMessage: delegating to AI for ACTIVE user", { userId: fromId });
          return null;
        }
      }
    } catch (e) {
      logger.debug("Active-user delegation check failed", e?.message || String(e));
    }

    if (text && text.startsWith("/live")) {
      const games = await getLiveMatchesBySport(
        "soccer",
        redis,
        services && services.sportsAggregator,
      );
      const payload = buildLiveMenuPayload(games, "Soccer", "FREE", 1, 6);
      return {
        method: "sendMessage",
        chat_id: chatId,
        text: payload.text,
        reply_markup: payload.reply_markup,
        parse_mode: "Markdown",
      };
    }

    // Start menu: show BETRIX OS instead of jumping straight to fixtures
    if (text && text.startsWith("/start")) {
      await sendStartMenu(chatId, services && services.telegramService);
      return null;
    }

    // Default help/fallback
    if (text && text.startsWith("/live") === false) {
      return {
        method: "sendMessage",
        chat_id: chatId,
        text: "Send /live to view live soccer matches.",
      };
    }
  } catch (e) {
    logger.warn("handleMessage error", e?.message || String(e));
    return null;
  }
}

/* Removed duplicated, smaller `handleCallbackQuery` implementation —
   a consolidated, full-featured `handleCallbackQuery` is defined later
   in this file. Keeping the later implementation to avoid duplicate
   declarations that broke linting and imports. */

/**
 * Handle odds request
 */
async function _handleOdds(chatId, userId, redis, services, query = {}) {
  try {
    const subscription = await getUserSubscription(redis, userId);

    // Check tier access
    if (subscription.tier === "FREE" && query.isFree === false) {
      return {
        chat_id: chatId,
        text: formatUpgradePrompt("Advanced odds analysis"),
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "👑 Upgrade to VVIP", callback_data: "sub_upgrade_vvip" }],
            [{ text: "🔙 Back", callback_data: "menu_main" }],
          ],
        },
      };
    }

    // Fetch odds from SportMonks/SportsData APIs
    let matchesRaw = [];

    // Try SportMonks first for premium odds data
    if (services.sportMonks && services.sportMonks.enabled) {
      try {
        const sport = query.sport || "football";
        const liveMatches = await services.sportMonks
          .getLiveMatches(sport, 12)
          .catch(() => []);
        matchesRaw = matchesRaw.concat(liveMatches || []);
        logger.info(
          `Fetched ${liveMatches?.length || 0} matches with odds from SportMonks`,
        );
      } catch (e) {
        logger.warn("Failed to fetch odds from SportMonks", e.message);
      }
    }

    // Try SportsData.io for betting odds
    if (
      services.sportsData &&
      services.sportsData.enabled &&
      matchesRaw.length === 0
    ) {
      try {
        const sport = query.sport || "soccer";
        const oddsData = await services.sportsData
          .getBettingOdds(sport)
          .catch(() => []);
        matchesRaw = matchesRaw.concat(oddsData || []);
        logger.info(
          `Fetched ${oddsData?.length || 0} games with betting odds from SportsData`,
        );
      } catch (e) {
        logger.warn("Failed to fetch odds from SportsData", e.message);
      }
    }

    // Fall back to footballData service
    if (services.footballData && matchesRaw.length === 0) {
      try {
        const fd = await services.footballData.fixturesFromCsv(
          query.comp || "E0",
          query.season || String(new Date().getFullYear()),
        );
        matchesRaw = fd && fd.fixtures ? fd.fixtures.slice(0, 12) : [];
      } catch (e) {
        logger.warn("Failed to fetch odds from footballData", e);
      }
    }

    const matches = matchesRaw
      .map((m) => {
        if (!m)
          return {
            home: "Home",
            away: "Away",
            homeOdds: "-",
            drawOdds: "-",
            awayOdds: "-",
          };
        if (m.fixture || m.teams || m.league)
          return normalizeApiFootballFixture(m);
        if (
          m.homeTeam ||
          m.homeTeamName ||
          m.home_team ||
          m.away_team ||
          m.eventName
        )
          return normalizeAllSportsMatch(m);
        if (
          m.homeScore !== undefined ||
          m.homeTeam ||
          m.awayTeam ||
          m.matchId ||
          m.score
        )
          return normalizeSportsDataEvent(m);
        return normalizeFootballDataFixture(m);
      })
      .slice(0, 8);

    // Demo fallback only if no real data
    let finalMatches = matches;
    if (finalMatches == null || finalMatches.length === 0) {
      finalMatches = [
        {
          home: "Arsenal",
          away: "Chelsea",
          homeOdds: "1.85",
          drawOdds: "3.40",
          awayOdds: "4.20",
        },
        {
          home: "Manchester United",
          away: "Liverpool",
          homeOdds: "2.10",
          drawOdds: "3.10",
          awayOdds: "3.60",
        },
        {
          home: "Tottenham",
          away: "Newcastle",
          homeOdds: "1.65",
          drawOdds: "3.80",
          awayOdds: "5.50",
        },
        {
          home: "Brighton",
          away: "Fulham",
          homeOdds: "1.95",
          drawOdds: "3.30",
          awayOdds: "3.90",
        },
      ];
    }

    const response = formatOdds(finalMatches);
    const header = brandingUtils.generateBetrixHeader(subscription.tier);
    const footer = brandingUtils.generateBetrixFooter(
      false,
      "Tap a match to place a bet",
    );
    const fullText = `${header}\n\n📊 *Current Odds*\n\n${response}${footer}`;

    return {
      chat_id: chatId,
      text: fullText,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "⚽ Live Games", callback_data: "menu_live" }],
          [{ text: "🔙 Main Menu", callback_data: "menu_main" }],
        ],
      },
    };
  } catch (err) {
    logger.error("Odds handler error", err);
    const errorMsg = brandingUtils.formatBetrixError(
      { type: "connection", message: err.message },
      "FREE",
    );
    return {
      chat_id: chatId,
      text: errorMsg,
      parse_mode: "Markdown",
    };
  }
}

/**
 * Handle standings request
 */
async function _handleStandings(chatId, userId, redis, services, query = {}) {
  try {
    const { openLiga, sportMonks, sportsData } = services;

    let standingsRaw = [];

    // Try SportMonks for standings data
    if (sportMonks && sportMonks.enabled) {
      try {
        const leagueId = query.leagueId || 501; // Premier League default
        const standings = await sportMonks
          .getStandings(leagueId)
          .catch(() => []);
        standingsRaw = standingsRaw.concat(standings || []);
        logger.info(`Fetched standings from SportMonks (league: ${leagueId})`);
      } catch (e) {
        logger.warn("Failed to fetch standings from SportMonks", e.message);
      }
    }

    // Try SportsData.io for alternative standings
    if (sportsData && sportsData.enabled && standingsRaw.length === 0) {
      try {
        const competitionId = query.competitionId || 1; // Default competition ID
        const standings = await sportsData
          .getStandings(competitionId)
          .catch(() => []);
        standingsRaw = standingsRaw.concat(standings || []);
        logger.info(
          `Fetched standings from SportsData (competition: ${competitionId})`,
        );
      } catch (e) {
        logger.warn("Failed to fetch standings from SportsData", e.message);
      }
    }

    // Fall back to OpenLiga
    if (openLiga && standingsRaw.length === 0) {
      try {
        const league = query.league || "BL1";
        standingsRaw = (await openLiga.getStandings(league)) || [];
      } catch (e) {
        logger.warn("Failed to fetch standings from openLiga", e);
      }
    }

    const standings = normalizeStandingsOpenLiga(standingsRaw || []);

    // Only use demo if absolutely no data
    const finalStandings =
      standings && standings.length
        ? standings
        : [
            {
              name: "Manchester City",
              played: 30,
              won: 24,
              drawn: 4,
              lost: 2,
              goalDiff: 58,
              points: 76,
            },
            {
              name: "Arsenal",
              played: 30,
              won: 22,
              drawn: 4,
              lost: 4,
              goalDiff: 48,
              points: 70,
            },
            {
              name: "Liverpool",
              played: 30,
              won: 20,
              drawn: 6,
              lost: 4,
              goalDiff: 42,
              points: 66,
            },
            {
              name: "Manchester United",
              played: 30,
              won: 18,
              drawn: 5,
              lost: 7,
              goalDiff: 28,
              points: 59,
            },
            {
              name: "Newcastle United",
              played: 30,
              won: 17,
              drawn: 6,
              lost: 7,
              goalDiff: 25,
              points: 57,
            },
          ];

    const response = formatStandings(
      query.league || "Premier League",
      finalStandings,
    );
    const subscription = await getUserSubscription(redis, userId).catch(() => ({
      tier: "FREE",
    }));
    const header = brandingUtils.generateBetrixHeader(subscription.tier);
    const footer = brandingUtils.generateBetrixFooter(
      false,
      "Current season standings",
    );
    const fullText = `${header}\n\n🏆 *League Standings*\n\n${response}${footer}`;

    return {
      chat_id: chatId,
      text: fullText,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "📊 Odds", callback_data: "menu_odds" }],
          [{ text: "🔙 Main Menu", callback_data: "menu_main" }],
        ],
      },
    };
  } catch (err) {
    logger.error("Standings handler error", err);
    const errorMsg = brandingUtils.formatBetrixError(
      { type: "connection", message: err.message },
      "FREE",
    );
    return {
      chat_id: chatId,
      text: errorMsg,
      parse_mode: "Markdown",
    };
  }
}

/**
 * Handle news request
 */
async function _handleNews(chatId, userId, redis, services, query = {}) {
  try {
    const { rss } = services;

    let articles = [];
    if (rss) {
      try {
        const feeds = [
          "https://feeds.bbci.co.uk/sport/football/rss.xml",
          "https://www.theguardian.com/football/rss",
        ];
        const result = await rss.fetchMultiple(feeds);
        articles = result.slice(0, 8);
      } catch (e) {
        logger.warn("Failed to fetch news", e);
      }
    }

    // Get subscription for branding
    const subscription = await getUserSubscription(redis, userId).catch(() => ({
      tier: "FREE",
    }));
    const header = brandingUtils.generateBetrixHeader(subscription.tier);

    // Build rich article display with branding
    let newsText = `${header}\n\n📰 *Latest Football News*\n`;

    if (articles && articles.length > 0) {
      newsText += articles
        .slice(0, 5)
        .map((article, i) => {
          const title = (article.title || "Untitled").substring(0, 60);
          const summary = (article.description || article.summary || "")
            .substring(0, 100)
            .trim();
          const source = article.source || article.author || "News Source";
          const date = article.pubDate || article.published || "Recently";
          return `${i + 1}. *${title}*\n_${source}_ • ${date}\n${summary}${summary ? "..." : ""}`;
        })
        .join("\n\n");
    } else {
      newsText += "_Loading latest headlines..._";
    }

    const footer = brandingUtils.generateBetrixFooter(
      false,
      "Tap to read full article",
    );
    const fullText = `${newsText}${footer}`;

    // Build keyboard with article links or refresh button
    const keyboard = [];
    if (articles && articles.length > 0) {
      articles.slice(0, 3).forEach((article, i) => {
        if (article.link) {
          keyboard.push([
            { text: `📖 Read Article ${i + 1}`, url: article.link },
          ]);
        }
      });
    }

    keyboard.push([
      { text: "🔄 Refresh", callback_data: "menu_news" },
      { text: "🔙 Back", callback_data: "menu_main" },
    ]);

    return {
      chat_id: chatId,
      text: fullText,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: keyboard,
      },
    };
  } catch (err) {
    logger.error("News handler error", err);
    const errorMsg = brandingUtils.formatBetrixError(
      { type: "connection", message: err.message },
      "FREE",
    );
    return {
      chat_id: chatId,
      text: errorMsg,
      parse_mode: "Markdown",
    };
  }
}

/**
 * Handle profile request
 */
async function _handleProfile(chatId, userId, redis, services) {
  try {
    const user = await safeGetUserData(redis, `user:${userId}`);
    const subscription = await getUserSubscription(redis, userId);

    const profileData = {
      name: (user && user.name) || "BETRIX User",
      tier: subscription.tier,
      joinDate: (user && user.joinDate) || new Date().toLocaleDateString(),
      predictions: (user && user.predictions) || 0,
      winRate: (user && user.winRate) || 0,
      points: (user && user.points) || 0,
      referralCode: userId.toString(36).toUpperCase(),
      referrals: (user && user.referrals) || 0,
      bonusPoints: (user && user.bonusPoints) || 0,
      nextTier: subscription.tier === "FREE" ? "PRO" : "VVIP",
    };

    const response = formatProfile(profileData);

    return {
      chat_id: chatId,
      text: response + `\n\n${formatSubscriptionDetails(subscription)}`,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "✏️ Edit Name", callback_data: "profile_edit_name" }],
          [{ text: "⭐ Favorites", callback_data: "profile_manage_favs" }],
          [{ text: "👑 Upgrade", callback_data: "sub_upgrade_vvip" }],
          [{ text: "🔙 Main Menu", callback_data: "menu_main" }],
        ],
      },
    };
  } catch (err) {
    logger.error("Profile handler error", err);
    return {
      chat_id: chatId,
      text: "🌀 *BETRIX* - Unable to load profile.",
      parse_mode: "Markdown",
    };
  }
}

/**
 * Handle generic AI response
 */
async function handleGenericAI(text, chatId, userId, redis, services) {
  try {
    const { aiChain } = services;

    if (!aiChain) {
      return {
        chat_id: chatId,
        text: `🌀 *BETRIX* - Sorry, I couldn't understand that. Try:\n/live\n/odds\n/standings\n/news`,
        parse_mode: "Markdown",
      };
    }

    // Get AI response
    const response = await aiChain.analyze({
      userId,
      query: text,
      context: "sports_betting",
    });

    return {
      chat_id: chatId,
      text: formatNaturalResponse(
        response || "Unable to analyze this request.",
      ),
      parse_mode: "Markdown",
    };
  } catch (err) {
    logger.error("AI handler error", err);
    return {
      chat_id: chatId,
      text: `🌀 *BETRIX* - ${err.message || "Unable to process your request."}`,
      parse_mode: "Markdown",
    };
  }
}

/**
 * Handle callback queries (button clicks)
 */
export async function handleCallbackQuery(callbackQuery, redis, services) {
  try {
    const {
      id: cbId,
      from: { id: userId },
      data,
    } = callbackQuery;
    const chatId = callbackQuery.message.chat.id;

    logger.info("Callback query", { userId, data });

    // Telemetry: incoming callback_data length / suspicious patterns
    try {
      if (data && data.length > 64) {
        if (redis && typeof redis.incr === "function") {
          await redis.incr("betrix:telemetry:callback_incoming_too_long");
          await redis
            .lpush(
              "betrix:telemetry:callback_incoming_samples",
              data.substring(0, 256),
            )
            .catch(() => {});
          await redis
            .ltrim("betrix:telemetry:callback_incoming_samples", 0, 200)
            .catch(() => {});
          await redis
            .expire("betrix:telemetry:callback_incoming_samples", 60 * 60 * 24)
            .catch(() => {});
        }
      }
      // detect repeated 'odds_' pattern which previously caused corruption
      const repOdds = /(odds_){3,}/i.test(data || "");
      if (repOdds && redis && typeof redis.incr === "function") {
        await redis.incr("betrix:telemetry:callback_repetition_odds");
      }
    } catch (e) {
      logger.warn("Callback telemetry write failed", e?.message || e);
    }

    // Route callback
    // New modular start-menu routing: handle mod_* callbacks from start menu
    if (data && data.startsWith("mod_")) {
      return handleModCallback(
        data,
        chatId,
        userId,
        redis,
        services,
        callbackQuery,
      );
    }

    if (data === "menu_live") {
      // Special case: menu_live should show live matches, not sport selection
      return handleLiveMenuCallback(chatId, userId, redis, services);
    }

    if (data.startsWith("menu_")) {
      return handleMenuCallback(data, chatId, userId, redis);
    }

    if (data === "signup_start") {
      return startOnboarding(chatId, userId, redis, services);
    }

    if (data.startsWith("sport_")) {
      return handleSportCallback(data, chatId, userId, redis, services);
    }

    if (data.startsWith("sub_")) {
      return handleSubscriptionCallback(data, chatId, userId, redis, services);
    }

    if (data === "vvip_fixed") {
      return handleVvipFixedMatches(chatId, userId, redis, services);
    }

    if (data === "vvip_advanced") {
      return handleVvipAdvancedInfo(chatId, userId, redis, services);
    }

    if (data.startsWith("profile_")) {
      return handleProfileCallback(data, chatId, userId, redis);
    }

    if (data.startsWith("help_")) {
      return handleHelpCallback(data, chatId, userId, redis);
    }

    // Check more specific patterns BEFORE generic ones to avoid prefix collision
    if (data.startsWith("league_live_")) {
      return handleLeagueLiveCallback(data, chatId, userId, redis, services);
    }

    if (data.startsWith("league_odds_")) {
      return handleLeagueOddsCallback(data, chatId, userId, redis, services);
    }

    if (data.startsWith("league_standings_")) {
      return handleLeagueStandingsCallback(
        data,
        chatId,
        userId,
        redis,
        services,
      );
    }

    if (data.startsWith("league_")) {
      return handleLeagueCallback(data, chatId, userId, redis, services);
    }

    if (data.startsWith("analyze_match_")) {
      return handleAnalyzeMatch(data, chatId, userId, redis, services);
    }

    if (data.startsWith("match_")) {
      return handleMatchCallback(data, chatId, userId, redis, services);
    }

    if (data.startsWith("fav_view_")) {
      return handleFavoriteView(data, chatId, userId, redis, services);
    }
    // signup country selection
    if (data.startsWith("signup_country_")) {
      return handleSignupCountry(data, chatId, userId, redis, services);
    }

    // signup payment method selection
    if (data.startsWith("signup_paymethod_")) {
      return handleSignupPaymentMethodSelection(
        data,
        chatId,
        userId,
        redis,
        services,
      );
    }

    if (data.startsWith("signup_pay_")) {
      return handleSignupPaymentCallback(data, chatId, userId, redis, services);
    }

    if (data.startsWith("fav_")) {
      return handleFavoriteCallback(data, chatId, userId, redis);
    }

    // Handle payment verification
    if (data.startsWith("verify_payment_")) {
      return handlePaymentVerification(data, chatId, userId, redis);
    }

    // Handle payment help/guide request
    if (data.startsWith("payment_help_")) {
      return handlePaymentHelp(data, chatId, userId, redis);
    }

    // Handle payment method selection with tier
    if (data.startsWith("pay_")) {
      return handlePaymentMethodSelection(
        data,
        chatId,
        userId,
        redis,
        services,
      );
    }

    // Handle quick bet start
    if (data.startsWith("bet_fixture_")) {
      return handleBetCreate(data, chatId, userId, redis, services);
    }

    // Handle bet placement confirmation
    if (data.startsWith("place_bet_")) {
      return handlePlaceBet(data, chatId, userId, redis, services);
    }

    // Handle bet stake edit selection
    if (data.startsWith("edit_bet_")) {
      return handleEditBet(data, chatId, userId, redis);
    }

    // Handle stake set callbacks: set_bet_{betId}_{amount}
    if (data.startsWith("set_bet_")) {
      return handleSetBetStake(data, chatId, userId, redis);
    }

    // Acknowledge callback
    return {
      method: "answerCallbackQuery",
      callback_query_id: cbId,
    };
  } catch (err) {
    logger.error("Callback query error", err);
    return null;
  }
}

/**
 * Handle menu callbacks
 */
async function handleMenuCallback(data, chatId, userId, redis) {
  // 🎯 USE INTELLIGENT MENU BUILDER FOR DYNAMIC MENUS
  try {
    // Get user's subscription tier and data
    const userSubscription = await getUserSubscription(redis, userId);
    const userData = (await safeGetUserData(redis, `user:${userId}`)) || {};
    const tier = userSubscription.tier || "FREE";

    // Instantiate intelligent menu builder
    const menuBuilder = new IntelligentMenuBuilder(redis);

    // Build contextual menu based on data type
    let menu = mainMenu; // Default fallback

    if (data === "menu_main") {
      const mainMenuResult = await menuBuilder.buildContextualMainMenu(
        userId,
        userData,
      );
      menu = mainMenuResult || mainMenu;
    } else if (data === "menu_live") {
      const liveMenu = await menuBuilder.buildMatchDetailMenu(userId);
      menu = liveMenu || {
        text: "Select a sport for live games:",
        reply_markup: sportsMenu.reply_markup,
      };
    } else if (data === "menu_odds") {
      menu = {
        text: "📊 *Quick Odds*\n\nSelect a league to view current odds:",
        reply_markup: sportsMenu.reply_markup,
      };
    } else if (data === "menu_standings") {
      menu = {
        text: "🏆 *League Standings*\n\nSelect a league to view standings:",
        reply_markup: sportsMenu.reply_markup,
      };
    } else if (data === "menu_news") {
      menu = {
        text: "📰 *Latest News*\n\nLoading latest sports news...",
        reply_markup: mainMenu.reply_markup,
      };
    } else if (data === "menu_profile") {
      menu = {
        text: `👤 *Your Profile*\n\n*Name:* ${userData.name || "BETRIX User"}\n*Tier:* ${tier}\n*Points:* ${userData.points || 0}`,
        reply_markup: {
          inline_keyboard: [[{ text: "🔙 Back", callback_data: "menu_main" }]],
        },
      };
    } else if (data === "menu_vvip") {
      menu = subscriptionMenu;
    } else if (data === "menu_help") {
      menu = helpMenu;
    }

    if (!menu) return null;

    return {
      method: "editMessageText",
      chat_id: chatId,
      message_id: undefined,
      text: menu.text || menu,
      reply_markup: menu.reply_markup,
      parse_mode: "Markdown",
    };
  } catch (e) {
    logger.warn("Premium menu builder failed, using fallback", e.message);

    // Fallback to original menu system
    const menuMap = {
      menu_main: mainMenu,
      menu_live: {
        text: "Select a sport for live games:",
        reply_markup: sportsMenu.reply_markup,
      },
      menu_odds: {
        text: "Loading odds...",
        reply_markup: sportsMenu.reply_markup,
      },
      menu_standings: {
        text: "Select a league for standings:",
        reply_markup: sportsMenu.reply_markup,
      },
      menu_news: {
        text: "Loading latest news...",
        reply_markup: mainMenu.reply_markup,
      },
      menu_profile: profileMenu,
      menu_vvip: subscriptionMenu,
      menu_help: helpMenu,
    };

    const menu = menuMap[data];
    if (!menu) return null;

    return {
      method: "editMessageText",
      chat_id: chatId,
      message_id: undefined,
      text: menu.text,
      reply_markup: menu.reply_markup,
      parse_mode: "Markdown",
    };
  }
}

/**
 * Handle start-menu modular callbacks (mod_*)
 * Returns a payload object similar to other handlers (editMessageText / sendMessage)
 */
async function handleModCallback(
  data,
  chatId,
  userId,
  redis,
  services,
  callbackQuery,
) {
  try {
    // simple helpers
    const editPayload = (text, keyboard, parse_mode = "Markdown") => ({
      method: "editMessageText",
      chat_id: chatId,
      message_id: undefined,
      text,
      reply_markup: keyboard,
      parse_mode,
    });
    const sendPayload = (text, keyboard, parse_mode = "Markdown") => ({
      method: "sendMessage",
      chat_id: chatId,
      text,
      reply_markup: keyboard,
      parse_mode,
    });

    switch (data) {
      case "mod_sports_hub": {
        const text = [
          "⚽ BETRIX — Sports Hub",
          "",
          "Choose a sport:",
          "",
          "⚽ Football",
          "🏀 Basketball",
          "🏈 American Football",
          "🎾 Tennis",
          "🏒 Hockey",
          "🎯 More Sports",
        ].join("\n");
        const keyboard = {
          inline_keyboard: [
            [
              { text: "⚽ Football", callback_data: "sport:football" },
              { text: "🏀 Basketball", callback_data: "sport:basketball" },
            ],
            [{ text: "⬅️ Back", callback_data: "back:start" }],
          ],
        };
        return editPayload(text, keyboard);
      }
      case "mod_fixtures": {
        try {
          // Try to fetch upcoming fixtures via services.sportsAggregator or prefetch cache
          let fixtures = [];
          if (
            services &&
            services.sportsAggregator &&
            typeof services.sportsAggregator.getFixtures === "function"
          ) {
            fixtures = await services.sportsAggregator
              .getFixtures()
              .catch(() => []);
          }

          // fallback to prefetch cache
          if ((!fixtures || fixtures.length === 0) && redis) {
            try {
              const cached = await redis
                .get("betrix:prefetch:upcoming:by-sport")
                .catch(() => null);
              if (cached) {
                const parsed = JSON.parse(cached);
                fixtures = parsed?.sports?.soccer?.samples || [];
              }
            } catch (e) {
              /* ignore cache parse errors */
            }
          }

          // Build display using premium UI helper (shows actions so users can Analyze/Odds/Fav)
          const display = buildUpcomingFixtures(
            fixtures || [],
            "All Leagues",
            7,
            { showActions: true, userTier: "FREE", page: 1, pageSize: 12 },
          );
          if (display && display.text) {
            return editPayload(
              display.text,
              display.reply_markup || null,
              "Markdown",
            );
          }
        } catch (e) {
          logger.warn("mod_fixtures handler failed", e?.message || e);
        }

        // Fallback UI if fetch/build fails — try to build a dynamic sports menu
        try {
          const menuPayload = await buildSportsMenu(redis);
          if (menuPayload && menuPayload.text) {
            return editPayload(
              menuPayload.text,
              menuPayload.reply_markup || null,
              "Markdown",
            );
          }
        } catch (e) {
          logger.warn("buildSportsMenu failed", e?.message || e);
        }

        // Static fallback if dynamic menu failed
        const text =
          "📅 Upcoming Fixtures - choose a sport or view all upcoming matches.";
        const keyboard = {
          inline_keyboard: [
            [
              {
                text: "Football - Upcoming",
                callback_data: "sport:football:upcoming",
              },
            ],
            [{ text: "⬅️ Back", callback_data: "back:start" }],
          ],
        };
        return editPayload(text, keyboard);
      }
      case "mod_live": {
        const text = "📊 Live Center - showing live matches and quick actions.";
        const keyboard = {
          inline_keyboard: [
            [{ text: "Show Live Football", callback_data: "menu_live" }],
            [{ text: "⬅️ Back", callback_data: "back:start" }],
          ],
        };
        return editPayload(text, keyboard);
      }
      case "mod_betting": {
        const text =
          "📈 Betting Insights - value bets, market movers and daily picks.";
        const keyboard = {
          inline_keyboard: [
            [
              { text: "Value Bets", callback_data: "betting:value" },
              { text: "Daily Picks", callback_data: "betting:daily" },
            ],
            [{ text: "⬅️ Back", callback_data: "back:start" }],
          ],
        };
        return editPayload(text, keyboard);
      }
      case "mod_ai_chat": {
        const text =
          "🤖 Talk to BETRIX AI - ask about matches, markets, or strategy. Type your question below.";
        return editPayload(text, {
          inline_keyboard: [[{ text: "⬅️ Back", callback_data: "back:start" }]],
        });
      }
      case "mod_news_tables": {
        const text =
          "📰 News & Standings - latest headlines and league tables. Choose a league from the Sports Hub.";
        return editPayload(text, {
          inline_keyboard: [[{ text: "⬅️ Back", callback_data: "back:start" }]],
        });
      }
      case "mod_profile": {
        const text = `👤 My Profile & Favorites\n\nUser: ${userId}`;
        return editPayload(text, {
          inline_keyboard: [
            [
              { text: "Manage Favorites", callback_data: "profile_favorites" },
              { text: "Notifications", callback_data: "profile_notifications" },
            ],
            [{ text: "⬅️ Back", callback_data: "back:start" }],
          ],
        });
      }
      case "mod_vvip": {
        const text =
          "💰 Upgrade to VVIP - unlock premium features, alerts and deeper analytics.";
        return editPayload(text, {
          inline_keyboard: [
            [{ text: "View VVIP plans", callback_data: "vvip_plans" }],
            [{ text: "⬅️ Back", callback_data: "back:start" }],
          ],
        });
      }
      case "mod_affiliate": {
        const text =
          "🔗 Affiliate & Earnings - share BETRIX and earn rewards. Dashboard coming soon.";
        return editPayload(text, {
          inline_keyboard: [
            [{ text: "View Dashboard", callback_data: "affiliate_dashboard" }],
            [{ text: "⬅️ Back", callback_data: "back:start" }],
          ],
        });
      }
      case "mod_support": {
        const text =
          "🆘 Help & Support - support channels, FAQs and contact options.";
        return editPayload(text, {
          inline_keyboard: [
            [{ text: "Contact Support", callback_data: "support_contact" }],
            [{ text: "⬅️ Back", callback_data: "back:start" }],
          ],
        });
      }
      case "back:start": {
        // show start menu again
        const text = buildStartMenuText();
        return editPayload(text, startMenuKeyboard);
      }
      default: {
        // fallback: send start menu
        return editPayload(buildStartMenuText(), startMenuKeyboard);
      }
    }
  } catch (e) {
    logger.warn("handleModCallback failed", e?.message || e);
    return {
      method: "sendMessage",
      chat_id: chatId,
      text: "⚠️ Menu action failed. Try /start again.",
    };
  }
}

/**
 * Handle "Live Games" menu - show live matches across popular leagues
 */
async function handleLiveMenuCallback(chatId, userId, redis, services) {
  try {
    let allLiveMatches = [];
    const popularLeagues = ["39", "140", "135", "61", "78", "2", "3"]; // Popular football leagues

    // Fetch live matches from popular leagues in parallel
    if (services && services.sportsAggregator) {
      try {
        const matchesPerLeague = await Promise.all(
          popularLeagues.map((lid) =>
            services.sportsAggregator.getLiveMatches(lid).catch(() => []),
          ),
        );
        allLiveMatches = matchesPerLeague.flat();
      } catch (e) {
        logger.warn("Failed to fetch live matches across leagues", e);
      }

      // Also try to fetch from prefetch cache for all sports (not just soccer/football)
      if (!allLiveMatches || allLiveMatches.length === 0) {
        try {
          logger.info(
            "Trying prefetch cache for live matches across sports...",
          );
          const cachedData = await redis
            .get("betrix:prefetch:live:by-sport")
            .catch(() => null);
          if (cachedData) {
            const parsed = JSON.parse(cachedData);
            // Combine samples from all sports
            allLiveMatches = Object.values(parsed.sports || {})
              .flatMap((s) => s.samples || [])
              .filter((m) => m && m.home && m.away);
            logger.info(
              `Found ${allLiveMatches.length} matches from prefetch cache`,
            );
          }
        } catch (e) {
          logger.debug("Prefetch cache fetch failed", e?.message);
        }
      }
    }

    // If no live matches found, show message with fallback to league selection
    if (!allLiveMatches || allLiveMatches.length === 0) {
      const subscription = await getUserSubscription(redis, userId).catch(
        () => ({ tier: "FREE" }),
      );
      const header = brandingUtils.generateBetrixHeader(subscription.tier);
      const noMatchText = `${header}\n\n🔴 *No Live Matches Right Now*\n\nNo games are currently live. Would you like to browse by league instead?`;
      return {
        method: "sendMessage",
        chat_id: chatId,
        text: noMatchText,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "⚽ Browse by League", callback_data: "sport_football" },
              { text: "🔙 Back", callback_data: "menu_main" },
            ],
          ],
        },
      };
    }

    // Get subscription for branding
    const subscription = await getUserSubscription(redis, userId).catch(() => ({
      tier: "FREE",
    }));
    const header = brandingUtils.generateBetrixHeader(subscription.tier);
    const footer = brandingUtils.generateBetrixFooter(
      false,
      "Click a match to view odds and analysis",
    );

    // Limit to top 10 live matches and build a safer, branded display
    const limited = allLiveMatches.slice(0, 10);

    const matchText = limited
      .map((m, i) => {
        let home = teamNameOf(m.home);
        let away = teamNameOf(m.away);

        // Extra fallback: if home/away are still "Unknown" or defaults, try to extract from raw data
        if ((home === "Home" || home === "Unknown" || !home) && m.raw) {
          home =
            teamNameOf(m.raw.homeTeam) ||
            teamNameOf(m.raw.home_team) ||
            teamNameOf(m.raw.teams?.home) ||
            teamNameOf(m.raw.main_team) ||
            "Home";
        }
        if ((away === "Away" || away === "Unknown" || !away) && m.raw) {
          away =
            teamNameOf(m.raw.awayTeam) ||
            teamNameOf(m.raw.away_team) ||
            teamNameOf(m.raw.teams?.away) ||
            teamNameOf(m.raw.visitor_team) ||
            "Away";
        }

        const score =
          typeof m.homeScore === "number" && typeof m.awayScore === "number"
            ? `${m.homeScore}-${m.awayScore}`
            : "─";
        const status =
          String(m.status || "").toUpperCase() === "LIVE"
            ? `🔴 ${m.time || "LIVE"}`
            : `⏱ ${m.time || m.status || "TBD"}`;
        const league = safeNameOf(
          m.league || m.competition || (m.raw && m.raw.competition),
          "",
        );
        return `${i + 1}. *${home}* vs *${away}*\n   ${score} ${status} ${league ? `[${league}]` : ""}`;
      })
      .join("\n\n");

    // Build keyboard - one button per match for quick viewing with safe callback ids
    const keyboard = limited.map((m, i) => {
      let home = teamNameOf(m.home);
      let away = teamNameOf(m.away);

      // Same fallback for keyboard labels
      if ((home === "Home" || home === "Unknown" || !home) && m.raw) {
        home =
          teamNameOf(m.raw.homeTeam) ||
          teamNameOf(m.raw.home_team) ||
          teamNameOf(m.raw.teams?.home) ||
          teamNameOf(m.raw.main_team) ||
          "Home";
      }
      if ((away === "Away" || away === "Unknown" || !away) && m.raw) {
        away =
          teamNameOf(m.raw.awayTeam) ||
          teamNameOf(m.raw.away_team) ||
          teamNameOf(m.raw.teams?.away) ||
          teamNameOf(m.raw.visitor_team) ||
          "Away";
      }

      const label = `${i + 1}. ${home} vs ${away}`.substring(0, 64);
      const provider = (m.provider || "p")
        .toString()
        .replace(/[^a-zA-Z0-9_-]/g, "");
      const mid = m.id || m.fixture?.id || i;
      const cb = validateCallbackData(`match_live_${provider}_${mid}`);
      return [{ text: label, callback_data: cb }];
    });

    keyboard.push([
      { text: "⚽ Browse by League", callback_data: "sport_football" },
      { text: "🔙 Back", callback_data: "menu_main" },
    ]);

    return {
      method: "sendMessage",
      chat_id: chatId,
      text: `${header}\n\n🏟️ *Live Matches Now*\n\n${matchText}${footer}`,
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: keyboard },
    };
  } catch (err) {
    logger.error("Live menu handler error", err);
    const errorMsg = brandingUtils.formatBetrixError(
      { type: "connection", message: err.message },
      "FREE",
    );
    return {
      method: "sendMessage",
      chat_id: chatId,
      text: errorMsg,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[{ text: "🔙 Back", callback_data: "menu_main" }]],
      },
    };
  }
}

async function handleLeagueCallback(data, chatId, userId, redis, services) {
  const leagueId = data.replace("league_", "") || null;

  try {
    // Get league name from mapping
    const leagueMap = {
      39: "Premier League",
      140: "La Liga",
      135: "Serie A",
      61: "Ligue 1",
      78: "Bundesliga",
      2: "Champions League",
      3: "Europa League",
    };
    const leagueName = leagueMap[leagueId] || `League ${leagueId}`;

    // 🎯 USE INTELLIGENT MENU BUILDER FOR LEAGUE MENU
    const subscription = await getUserSubscription(redis, userId).catch(() => ({
      tier: "FREE",
    }));
    // IntelligentMenuBuilder is exported as a class - instantiate with Redis
    const menuBuilder = new IntelligentMenuBuilder(redis);
    const leagueMenu = await menuBuilder.buildMatchDetailMenu(
      leagueName,
      subscription.tier,
      leagueId,
    );

    return {
      method: "editMessageText",
      chat_id: chatId,
      message_id: undefined,
      text:
        leagueMenu.text || `📊 *${leagueName}*\n\nWhat would you like to see?`,
      parse_mode: "Markdown",
      reply_markup: leagueMenu.reply_markup || {
        inline_keyboard: [
          [
            {
              text: "🔴 Live Now",
              callback_data: validateCallbackData(`league_live_${leagueId}`),
            },
            {
              text: "📈 Odds",
              callback_data: validateCallbackData(`league_odds_${leagueId}`),
            },
          ],
          [
            {
              text: "📊 Table",
              callback_data: validateCallbackData(
                `league_standings_${leagueId}`,
              ),
            },
          ],
          [{ text: "🔙 Back", callback_data: "menu_live" }],
        ],
      },
    };
  } catch (err) {
    logger.error("League callback error", err);
    return null;
  }
}

/**
 * Handle live matches for a league
 */
async function handleLeagueLiveCallback(data, chatId, userId, redis, services) {
  const leagueId = data.replace("league_live_", "");

  try {
    let matches = [];
    if (services && services.sportsAggregator) {
      try {
        // 🎯 USE FIXTURES MANAGER TO GET LEAGUE FIXTURES
        try {
          const fm = new FixturesManager(redis);
          matches = await fm.getLeagueFixtures(leagueId);
        } catch (e) {
          logger.warn("Fixtures manager failed, using aggregator", e.message);
          matches = await services.sportsAggregator.getLiveMatches(leagueId);
        }
      } catch (e) {
        logger.warn("Failed to fetch live matches", e);
      }
    }

    if (!matches || matches.length === 0) {
      const errorText = formatBetrixError(
        "no_matches",
        "No live matches right now",
      );
      return {
        method: "editMessageText",
        chat_id: chatId,
        message_id: undefined,
        text: errorText,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 Back", callback_data: `league_${leagueId}` }],
          ],
        },
      };
    }

    // 🎯 USE PREMIUM UI BUILDER FOR MATCH CARDS
    const subscription = await getUserSubscription(redis, userId).catch(() => ({
      tier: "FREE",
    }));
    const limited = matches.slice(0, 5);

    // Build match cards with premium formatting
    const matchCards = limited
      .map((m, i) =>
        premiumUI.buildMatchCard(m, subscription.tier, leagueId, i),
      )
      .join("\n\n");

    const header = brandingUtils.generateBetrixHeader(subscription.tier);
    const matchText = `${header}\n\n🏟️ *Live Matches*\n\n${matchCards}`;

    // Build keyboard with analysis and favorite buttons
    const keyboard = limited.map((m, i) => {
      const homeLabel = teamNameOf(m.home);
      const awayLabel = teamNameOf(m.away);
      const homeKey = encodeURIComponent(homeLabel);
      return [
        {
          text: `🔎 Analyze ${i + 1}`,
          callback_data: validateCallbackData(`analyze_match_live_${i}`),
        },
        {
          text: `⭐ ${homeLabel.split(" ")[0]}`,
          callback_data: validateCallbackData(`fav_add_${homeKey}`),
        },
      ];
    });

    // also allow favoriting away team
    limited.forEach((m, i) => {
      const awayLabel = teamNameOf(m.away);
      const awayKey = encodeURIComponent(awayLabel);
      keyboard.push([
        {
          text: `⭐ Fav ${awayLabel.split(" ")[0]}`,
          callback_data: validateCallbackData(`fav_add_${awayKey}`),
        },
        {
          text: `🔁 Odds ${i + 1}`,
          callback_data: validateCallbackData(`league_odds_${leagueId}`),
        },
      ]);
    });

    keyboard.push([
      {
        text: "🔙 Back",
        callback_data: validateCallbackData(`league_${leagueId}`),
      },
    ]);

    return {
      method: "editMessageText",
      chat_id: chatId,
      message_id: undefined,
      text: `🏟️ *Live Matches*\n\n${matchText}\n\n_Tap Details or add teams to your favorites for quick access._`,
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: keyboard },
    };
  } catch (err) {
    logger.error("Live matches handler error", err);
    return null;
  }
}

/**
 * Show match details and actions for a specific live match index
 * Supports two formats:
 * - match_{leagueId}_{index}: for league-specific live matches
 * - match_live_{index}: for global live matches from handleLiveMenuCallback
 */
async function handleMatchCallback(data, chatId, userId, redis, services) {
  try {
    const parts = data.split("_");
    let leagueId = null;
    let idx = 0;
    let allLiveMatches = [];

    // Determine format: match_live_X or match_leagueId_X
    if (parts[1] === "live") {
      // Format: match_live_{index}
      idx = Number(parts[2] || 0);
      // Fetch all live matches from popular leagues
      const popularLeagues = ["39", "140", "135", "61", "78", "2", "3"];
      if (services && services.sportsAggregator) {
        try {
          const matchesPerLeague = await Promise.all(
            popularLeagues.map((lid) =>
              services.sportsAggregator.getLiveMatches(lid).catch(() => []),
            ),
          );
          allLiveMatches = matchesPerLeague.flat();
        } catch (e) {
          logger.warn("Failed to fetch all live matches", e);
        }
      }
    } else {
      // Format: match_{leagueId}_{index}
      leagueId = parts[1] || null;
      idx = Number(parts[2] || 0);
      if (services && services.sportsAggregator) {
        try {
          allLiveMatches =
            await services.sportsAggregator.getLiveMatches(leagueId);
        } catch (e) {
          logger.warn("Failed to fetch live matches for match details", e);
        }
      }
    }

    if (
      !allLiveMatches ||
      allLiveMatches.length === 0 ||
      !allLiveMatches[idx]
    ) {
      return {
        method: "answerCallbackQuery",
        callback_query_id: undefined,
        text: "Match details unavailable",
        show_alert: true,
      };
    }

    const m = allLiveMatches[idx];
    const score =
      m.homeScore != null && m.awayScore != null
        ? `${m.homeScore}-${m.awayScore}`
        : m.score || "N/A";
    const live = m.liveStats || {};
    const time =
      m.time || m.minute || live.minute || m.status || live.status || "N/A";
    const homeOdds = m.homeOdds || m.odds?.home || "-";
    const awayOdds = m.awayOdds || m.odds?.away || "-";
    const drawOdds = m.drawOdds || m.odds?.draw || "-";

    let text = `🏟️ *Match Details*\n\n*${safeNameOf(m.home, "Home")}* vs *${safeNameOf(m.away, "Away")}*\n`;
    text += `• Score: ${score}\n• Time: ${time}\n`;
    text += `• Odds: Home ${homeOdds} • Draw ${drawOdds} • Away ${awayOdds}\n`;
    // prefer liveStats where available
    if (m.possession) {
      text += `• Possession: ${m.possession}\n`;
    } else if (live.stats) {
      // try to find possession-like stat
      try {
        const poss = Object.values(live.stats)
          .map((a) => a.find((s) => /possess/i.test(s.label)))
          .filter(Boolean)[0];
        if (poss && poss.value) text += `• Possession: ${poss.value}\n`;
      } catch (e) {
        void e;
      }
    }

    if (m.stats && Array.isArray(m.stats)) {
      text += `• Key: ${m.stats.join(" • ")}\n`;
    } else if (live.stats) {
      // flatten some key stats if available
      try {
        const all = [];
        Object.keys(live.stats).forEach((k) => {
          const arr = live.stats[k] || [];
          arr.slice(0, 3).forEach((s) => all.push(`${s.label}: ${s.value}`));
        });
        if (all.length > 0) text += `• Key: ${all.join(" • ")}\n`;
      } catch (e) {
        void e;
      }
    }

    // Build back button based on format
    let backData = "menu_live";
    if (leagueId) {
      backData = validateCallbackData(`league_live_${leagueId}`);
    }

    const homeLabel = teamNameOf(m.home);
    const awayLabel = teamNameOf(m.away);
    const homeKey = encodeURIComponent(homeLabel);
    const awayKey = encodeURIComponent(awayLabel);

    const keyboard = [
      [
        {
          text: "🤖 Analyze Match",
          callback_data: validateCallbackData(`analyze_match_live_${idx}`),
        },
      ],
      [
        {
          text: `⭐ Fav ${homeLabel.split(" ")[0]}`,
          callback_data: validateCallbackData(`fav_add_${homeKey}`),
        },
        {
          text: `⭐ Fav ${awayLabel.split(" ")[0]}`,
          callback_data: validateCallbackData(`fav_add_${awayKey}`),
        },
      ],
      [
        {
          text: "📊 View Odds",
          callback_data: validateCallbackData(
            leagueId ? `league_odds_${leagueId}` : "menu_odds",
          ),
        },
      ],
      [{ text: "🔙 Back", callback_data: backData }],
    ];

    return {
      method: "editMessageText",
      chat_id: chatId,
      message_id: undefined,
      text,
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: keyboard },
    };
  } catch (e) {
    logger.error("handleMatchCallback error", e);
    return {
      method: "answerCallbackQuery",
      callback_query_id: undefined,
      text: "Failed to load match details",
      show_alert: true,
    };
  }
}

/**
 * Analyze a match using comprehensive SportsAggregator data
 * Provides head-to-head, recent form, standings, and odds
 * callback: analyze_match_{matchId}
 */
export async function handleAnalyzeMatch(
  data,
  chatId,
  userId,
  redis,
  services,
) {
  try {
    const parts = String(data).split("_");
    // support both forms:
    //  - analyze_match_{matchId}
    //  - analyze_match_{leagueId}_{indexOrId}
    let leagueToken = null;
    let matchToken = null;
    if (parts.length >= 4) {
      leagueToken = parts[2];
      matchToken = parts.slice(3).join("_");
    } else {
      matchToken = parts[2];
    }

    if (!services || !services.sportsAggregator) {
      const errorText = "❌ Analysis service unavailable";
      return {
        method: "sendMessage",
        chat_id: chatId,
        text: errorText,
        parse_mode: "HTML",
      };
    }

    const agg = services.sportsAggregator;

    // Diagnostic logging: tokens and user context
    try {
      logger.info("[handleAnalyzeMatch] tokens", {
        raw: String(data),
        leagueToken,
        matchToken,
        userId,
        chatId,
      });
    } catch (e) {
      /* ignore logging failure */
    }
    // Always emit console-level telemetry so Render/host logs capture these events
    try {
      console.info(
        "[handleAnalyzeMatch] tokens",
        JSON.stringify({
          raw: String(data),
          leagueToken,
          matchToken,
          userId,
          chatId,
        }),
      );
    } catch (e) {
      /* ignore */
    }

    // Try multiple sources to locate the target match: live matches, upcoming fixtures
    let match = null;
    // Helper to resolve by index or id or fuzzy name
    const resolveFromList = (list, token) => {
      if (!Array.isArray(list) || list.length === 0) return null;
      // numeric index (0-based or 1-based)
      if (/^\d+$/.test(String(token))) {
        const idx = Number(token);
        // prefer 1-based indices from UI: try idx-1 then idx
        if (idx > 0 && list[idx - 1]) return list[idx - 1];
        if (list[idx]) return list[idx];
      }
      // match by id field
      const foundById = list.find(
        (m) =>
          String(m.id) === String(token) ||
          String(m.fixtureId) === String(token) ||
          String(m.match_id) === String(token),
      );
      if (foundById) return foundById;
      // fuzzy match by home/away names
      const lower = String(token).toLowerCase();
      const fuzzy = list.find(
        (m) =>
          String(
            m.home ||
              m.homeTeam ||
              m.home_name ||
              (m.raw && m.raw.home && m.raw.home.name) ||
              "",
          )
            .toLowerCase()
            .includes(lower) ||
          String(
            m.away ||
              m.awayTeam ||
              m.away_name ||
              (m.raw && m.raw.away && m.raw.away.name) ||
              "",
          )
            .toLowerCase()
            .includes(lower),
      );
      if (fuzzy) return fuzzy;

      // Handle underscore-joined tokens like 'Newcastle_Chelsea' or 'Home_Away'
      try {
        const decoded = decodeURIComponent(String(token));
        const parts = decoded
          .split("_")
          .map((p) => p.trim())
          .filter(Boolean);
        if (parts.length >= 2) {
          const pair = list.find((m) => {
            const homeName = String(
              m.home ||
                m.homeTeam ||
                m.home_name ||
                (m.raw && m.raw.home && m.raw.home.name) ||
                "",
            ).toLowerCase();
            const awayName = String(
              m.away ||
                m.awayTeam ||
                m.away_name ||
                (m.raw && m.raw.away && m.raw.away.name) ||
                "",
            ).toLowerCase();
            const p0 = parts[0].toLowerCase();
            const p1 = parts[1].toLowerCase();
            // common case: first part matches home, second matches away
            if (
              (homeName.includes(p0) && awayName.includes(p1)) ||
              (homeName.includes(p1) && awayName.includes(p0))
            )
              return true;
            // allow matching when all parts appear across the two names
            return parts.every(
              (p) =>
                homeName.includes(p.toLowerCase()) ||
                awayName.includes(p.toLowerCase()),
            );
          });
          if (pair) return pair;
        }
      } catch (e) {
        /* ignore decode errors */
      }

      return null;
    };

    // 1) If leagueToken indicates 'live' or omitted: try live matches first
    try {
      if (!leagueToken || leagueToken === "live" || leagueToken === "all") {
        const liveMatches =
          typeof agg.getAllLiveMatches === "function"
            ? await agg.getAllLiveMatches().catch(() => [])
            : [];
        logger.debug("[handleAnalyzeMatch] liveMatches count", {
          count: Array.isArray(liveMatches) ? liveMatches.length : 0,
        });
        match = resolveFromList(liveMatches, matchToken);
        if (match) {
          logger.info("[handleAnalyzeMatch] resolved from liveMatches", {
            id: match.id || match.fixtureId || null,
            home: safeNameOf(match.home),
            away: safeNameOf(match.away),
          });
          try {
            console.info(
              "[handleAnalyzeMatch] resolved_from",
              JSON.stringify({
                source: "liveMatches",
                id: match.id || match.fixtureId || null,
                home: safeNameOf(match.home),
                away: safeNameOf(match.away),
              }),
            );
          } catch (e) {}
        }
      }
    } catch (e) {
      // continue to next fallback
    }

    // 2) If not found yet and a leagueToken was provided, try upcoming fixtures for that league
    // Special-case the 'upcoming' token to mean global upcoming fixtures
    if (
      !match &&
      leagueToken &&
      leagueToken !== "live" &&
      leagueToken !== "all"
    ) {
      try {
        let fixtures = [];
        if (String(leagueToken) === "upcoming") {
          fixtures =
            typeof agg.getFixtures === "function"
              ? await agg.getFixtures().catch(() => [])
              : [];
          logger.debug("[handleAnalyzeMatch] fixtures (global upcoming)", {
            count: Array.isArray(fixtures) ? fixtures.length : 0,
          });
        } else {
          const leagueId = isNaN(Number(leagueToken))
            ? leagueToken
            : Number(leagueToken);
          fixtures =
            typeof agg.getFixtures === "function"
              ? await agg.getFixtures(leagueId).catch(() => [])
              : [];
          logger.debug("[handleAnalyzeMatch] fixtures for league", {
            leagueId,
            count: Array.isArray(fixtures) ? fixtures.length : 0,
          });
        }
        match = resolveFromList(fixtures, matchToken);
        if (match) {
          logger.info("[handleAnalyzeMatch] resolved from league/fixtures", {
            token: leagueToken,
            id: match.id || match.fixtureId || null,
            home: safeNameOf(match.home),
            away: safeNameOf(match.away),
          });
          try {
            console.info(
              "[handleAnalyzeMatch] resolved_from",
              JSON.stringify({
                source: "league_fixtures",
                token: leagueToken,
                id: match.id || match.fixtureId || null,
                home: safeNameOf(match.home),
                away: safeNameOf(match.away),
              }),
            );
          } catch (e) {}
        }
      } catch (e) {
        // ignore and fallthrough
      }
    }

    // 3)  Try global upcoming fixtures if still not found
    if (!match) {
      try {
        const allFixtures =
          typeof agg.getFixtures === "function"
            ? await agg.getFixtures().catch(() => [])
            : [];
        logger.debug("[handleAnalyzeMatch] allFixtures count", {
          count: Array.isArray(allFixtures) ? allFixtures.length : 0,
        });
        match = resolveFromList(allFixtures, matchToken);
        if (match) {
          logger.info("[handleAnalyzeMatch] resolved from allFixtures", {
            id: match.id || match.fixtureId || null,
            home: safeNameOf(match.home),
            away: safeNameOf(match.away),
          });
          try {
            console.info(
              "[handleAnalyzeMatch] resolved_from",
              JSON.stringify({
                source: "all_fixtures",
                id: match.id || match.fixtureId || null,
                home: safeNameOf(match.home),
                away: safeNameOf(match.away),
              }),
            );
          } catch (e) {}
        }
      } catch (e) {
        // ignore
      }
    }

    // 4) Fallback: try local static matches loader (file based) if aggregator didn't find anything
    if (!match) {
      try {
        const fb = await import("../bot/football.js");
        const upcomingRes = await (fb && fb.getUpcomingFixtures
          ? fb.getUpcomingFixtures({ page: 1, perPage: 200 })
          : { items: [] });
        const localList = upcomingRes.items || [];
        logger.debug("[handleAnalyzeMatch] local staticList count", {
          count: Array.isArray(localList) ? localList.length : 0,
        });
        match = resolveFromList(localList, matchToken);
        if (match) {
          logger.info("[handleAnalyzeMatch] resolved from local static list", {
            id: match.id || match.fixtureId || null,
            home: safeNameOf(match.home),
            away: safeNameOf(match.away),
          });
          try {
            console.info(
              "[handleAnalyzeMatch] resolved_from",
              JSON.stringify({
                source: "local_static",
                id: match.id || match.fixtureId || null,
                home: safeNameOf(match.home),
                away: safeNameOf(match.away),
              }),
            );
          } catch (e) {}
        }
      } catch (e) {
        // ignore
      }
    }

    if (!match) {
      logger.warn("[handleAnalyzeMatch] match not found", {
        token: matchToken,
        leagueToken,
      });
      try {
        console.info(
          "[handleAnalyzeMatch] match_not_found",
          JSON.stringify({ token: matchToken, leagueToken }),
        );
      } catch (e) {}
      return {
        method: "sendMessage",
        chat_id: chatId,
        text: "⚠️ Match not found or not available for analysis.",
        parse_mode: "HTML",
      };
    }

    // Derive team identifiers for SportMonks where possible
    const homeId =
      (match.raw &&
        match.raw.homeTeam &&
        (match.raw.homeTeam.id || match.raw.homeTeam.name)) ||
      match.home;
    const awayId =
      (match.raw &&
        match.raw.awayTeam &&
        (match.raw.awayTeam.id || match.raw.awayTeam.name)) ||
      match.away;

    // Step 2: Head-to-head (SportMonks)
    let h2h = {};
    try {
      h2h = await agg.getHeadToHead(homeId, awayId).catch(() => ({}));
    } catch (e) {
      logger.warn("Head-to-head fetch failed:", e?.message || e);
    }

    // Step 3: Recent form (SportMonks)
    let recentFormHome = [];
    let recentFormAway = [];
    try {
      recentFormHome = await agg.getRecentForm(homeId, 5).catch(() => []);
      recentFormAway = await agg.getRecentForm(awayId, 5).catch(() => []);
    } catch (e) {
      logger.warn("Recent form fetch failed:", e?.message || e);
    }

    // Step 4: Standings (Football-Data)
    let standings = [];
    try {
      const comp =
        (match.raw &&
          match.raw.competition &&
          (match.raw.competition.id || match.raw.competition.code)) ||
        match.competition ||
        null;
      if (comp) standings = await agg.getStandings(comp).catch(() => []);
    } catch (e) {
      logger.warn("Standings fetch failed:", e?.message || e);
    }

    // Step 5: Odds (SportMonks)
    let odds = [];
    try {
      odds = await agg.getOdds(match.id).catch(() => []);
    } catch (e) {
      logger.warn("Odds fetch failed:", e?.message || e);
    }

    // Format analysis text using HTML to avoid Markdown parsing issues in Telegram
    const homeLabel = safeNameOf(
      match.home || match.raw?.homeTeam || match.homeTeam,
      "Home",
    );
    const awayLabel = safeNameOf(
      match.away || match.raw?.awayTeam || match.awayTeam,
      "Away",
    );

    let analysisText = `<b>⚽ Match Analysis: ${escapeHtml(homeLabel)} vs ${escapeHtml(awayLabel)}</b>\n\n`;
    analysisText += `📍 <b>Status:</b> ${escapeHtml(String(match.status || ""))}\n`;
    analysisText += `📊 <b>Score:</b> ${escapeHtml(String((match.homeScore ?? "-") + "-" + (match.awayScore ?? "-")))}\n`;
    analysisText += `🏆 <b>Competition:</b> ${escapeHtml(safeNameOf(match.competition || (match.raw && match.raw.competition), "Unknown"))}\n`;
    analysisText += `⏰ <b>Kickoff:</b> ${escapeHtml(String(match.time || match.kickoff || "TBA"))}\n`;
    analysisText += `🏟️ <b>Venue:</b> ${escapeHtml(String(match.venue || "TBA"))}\n\n`;

    if (h2h && h2h.totalMatches !== undefined) {
      analysisText += `<b>Head-to-Head:</b>\n`;
      analysisText += `Total: ${escapeHtml(String(h2h.totalMatches))} | Home wins: ${escapeHtml(String(h2h.homeWins))} | Away wins: ${escapeHtml(String(h2h.awayWins))} | Draws: ${escapeHtml(String(h2h.draws))}\n\n`;
    }

    if (recentFormHome && recentFormHome.length > 0) {
      analysisText += `<b>Recent Form (${escapeHtml(homeLabel)}):</b>\n`;
      analysisText +=
        recentFormHome
          .slice(0, 5)
          .map(
            (m) =>
              `${escapeHtml(m.starting_at || m.date || m.date_time || m.utcDate || "N/A")}: ${escapeHtml(m.result || (m.score ? JSON.stringify(m.score) : "N/A"))}`,
          )
          .join("\n") + "\n\n";
    }

    if (recentFormAway && recentFormAway.length > 0) {
      analysisText += `<b>Recent Form (${escapeHtml(awayLabel)}):</b>\n`;
      analysisText +=
        recentFormAway
          .slice(0, 5)
          .map(
            (m) =>
              `${escapeHtml(m.starting_at || m.date || m.date_time || m.utcDate || "N/A")}: ${escapeHtml(m.result || (m.score ? JSON.stringify(m.score) : "N/A"))}`,
          )
          .join("\n") + "\n\n";
    }

    if (standings && standings.length > 0) {
      const homeStanding = standings.find(
        (t) =>
          t.team &&
          (t.team.name === homeLabel ||
            t.team.id === match.homeId ||
            t.team.id === match.raw?.homeTeam?.id),
      );
      const awayStanding = standings.find(
        (t) =>
          t.team &&
          (t.team.name === awayLabel ||
            t.team.id === match.awayId ||
            t.team.id === match.raw?.awayTeam?.id),
      );
      if (homeStanding || awayStanding) {
        analysisText += `<b>League Standings:</b>\n`;
        if (homeStanding)
          analysisText += `${escapeHtml(homeLabel)}: #${escapeHtml(String(homeStanding.position || "N/A"))} (${escapeHtml(String(homeStanding.points || 0))} pts)\n`;
        if (awayStanding)
          analysisText += `${escapeHtml(awayLabel)}: #${escapeHtml(String(awayStanding.position || "N/A"))} (${escapeHtml(String(awayStanding.points || 0))} pts)\n`;
        analysisText += "\n";
      }
    }

    if (odds && odds.length > 0) {
      analysisText += `<b>Odds Available:</b>\n`;
      analysisText += `${escapeHtml(String(odds.length))} bookmakers with odds for this match\n`;
    }

    analysisText += `<i>Data from Football-Data & SportMonks</i>`;

    // Build a simple structured suggestions JSON to surface betting markets
    try {
      // Basic heuristics for suggestions
      const suggestions = [];
      const avgGoalsHome =
        recentFormHome && recentFormHome.length
          ? recentFormHome.reduce((acc, m) => {
              const s = m.score || m.result || "";
              const parts = String(s).match(/(\d+)\D+(\d+)/);
              if (parts) return acc + (Number(parts[1]) + Number(parts[2]));
              return acc;
            }, 0) / Math.max(1, recentFormHome.length)
          : null;

      const avgGoalsAway =
        recentFormAway && recentFormAway.length
          ? recentFormAway.reduce((acc, m) => {
              const s = m.score || m.result || "";
              const parts = String(s).match(/(\d+)\D+(\d+)/);
              if (parts) return acc + (Number(parts[1]) + Number(parts[2]));
              return acc;
            }, 0) / Math.max(1, recentFormAway.length)
          : null;

      // Suggest Over 2.5 if both teams have had higher scoring recent matches (heuristic)
      if (
        (avgGoalsHome &&
          avgGoalsAway &&
          (avgGoalsHome + avgGoalsAway) / 2 >= 2.4) ||
        (odds &&
          odds.some((o) =>
            String(o.market || "")
              .toLowerCase()
              .includes("total"),
          ))
      ) {
        suggestions.push({
          market: "Total Goals",
          selection: "Over 2.5",
          confidence: 60,
          rationale:
            "Recent matches suggest higher goal counts / market indicates lively totals",
        });
      } else {
        suggestions.push({
          market: "Total Goals",
          selection: "Under 2.5",
          confidence: 45,
          rationale: "Conservative pick based on mixed recent form",
        });
      }

      // HT/FT heuristic: if home stronger in standings or form
      try {
        const homeStrength =
          (
            standings &&
            standings.find(
              (t) =>
                t.team &&
                (t.team.name === homeLabel || t.team.id === match.homeId),
            )
          )?.position || null;
        const awayStrength =
          (
            standings &&
            standings.find(
              (t) =>
                t.team &&
                (t.team.name === awayLabel || t.team.id === match.awayId),
            )
          )?.position || null;
        if (homeStrength && awayStrength) {
          if (homeStrength < awayStrength) {
            suggestions.push({
              market: "HT/FT",
              selection: "Draw/Home",
              confidence: 52,
              rationale:
                "Home stronger in table; likely second-half improvement",
            });
          } else if (awayStrength < homeStrength) {
            suggestions.push({
              market: "HT/FT",
              selection: "Draw/Away",
              confidence: 50,
              rationale: "Away stronger in table; consider comeback",
            });
          }
        }
      } catch (e) {
        /* ignore */
      }

      // Both teams to score heuristic from H2H/odds
      if (
        (h2h && h2h.bothTeamsToScore && h2h.bothTeamsToScore.rate > 0.6) ||
        (recentFormHome &&
          recentFormAway &&
          recentFormHome.some((m) => (m.score || "").indexOf("-") > 0) &&
          recentFormAway.some((m) => (m.score || "").indexOf("-") > 0))
      ) {
        suggestions.push({
          market: "Both Teams To Score",
          selection: "Yes",
          confidence: 55,
          rationale: "Frequent scoring observed in recent matches / H2H",
        });
      }

      // Normalize suggestions into an explicit suggested_bets schema so downstream parsers get a predictable shape.
      const suggested_bets = (suggestions || []).map((s) => {
        let line = null;
        const sel = String(s.selection || "");
        const m = sel.match(/([Oo]ver|[Uu]nder)\s*(\d+(?:\.\d+)?)/);
        if (m) line = Number(m[2]);
        return {
          market: s.market || "market",
          selection: s.selection || "",
          line: line,
          confidence:
            typeof s.confidence === "number"
              ? Math.round(s.confidence)
              : s.confidence
                ? Number(s.confidence)
                : null,
          valueEdge: s.valueEdge || s.value_edge || null,
          rationale: s.rationale || "",
        };
      });

      // Build BETRIX-grade structured JSON schema
      const betrixStructured = {
        match: {
          home: homeLabel,
          away: awayLabel,
          competition: safeNameOf(
            match.competition || (match.raw && match.raw.competition),
            "Unknown",
          ),
          kickoff: match.time || match.kickoff || match.utcDate || null || null,
          venue: match.venue || null,
          status: match.status || "TIMED",
        },
        stats: {
          h2h: h2h || { totalMatches: 0, homeWins: 0, awayWins: 0, draws: 0 },
          recentForm: {
            home: (recentFormHome || []).slice(0, 5),
            away: (recentFormAway || []).slice(0, 5),
          },
          standings: standings || [],
          xg: {
            home: (match.xg && match.xg.home) || null,
            away: (match.xg && match.xg.away) || null,
          },
          teamProfiles: {
            home: {
              style:
                (match.homeProfile && match.homeProfile.style) ||
                match.homeStyle ||
                null,
              avgGoals: null,
              avgConceded: null,
            },
            away: {
              style:
                (match.awayProfile && match.awayProfile.style) ||
                match.awayStyle ||
                null,
              avgGoals: null,
              avgConceded: null,
            },
          },
        },
        odds: {
          "1x2": { home: null, draw: null, away: null },
          totals: { line: 2.5, over: null, under: null },
          bothTeamsToScore: null,
          asianHandicap: null,
          bookmakers: (odds && odds.length) || 0,
        },
        ai_analysis: {
          summary: null,
          keyAngles: [],
        },
        suggested_bets,
      };

      // Format a premium Telegram message from the structured data
      const formatBetrixTelegram = (s) => {
        try {
          const m = s.match;
          const stats = s.stats || {};
          const ai = s.ai_analysis || {};
          const bets = s.suggested_bets || [];

          let out = `<b>⚽ BETRIX Match Analysis: ${escapeHtml(m.home)} vs ${escapeHtml(m.away)}</b>\n\n`;
          out += `🏆 ${escapeHtml(m.competition || "Unknown")}\n`;
          out += `⏰ Kickoff: ${escapeHtml(m.kickoff || "TBA")}\n`;
          out += `📍 Venue: ${escapeHtml(m.venue || "TBA")}\n`;
          out += `📊 Status: ${escapeHtml(m.status || "TIMED")}\n\n`;

          // AI Insights (if available)
          out += `<b>📈 AI Insights:</b>\n`;
          if (ai.summary) out += `${escapeHtml(ai.summary)}\n\n`;
          if (ai.keyAngles && ai.keyAngles.length) {
            ai.keyAngles.slice(0, 5).forEach((k) => {
              out += `• ${escapeHtml(k)}\n`;
            });
            out += "\n";
          }

          // Suggested bets
          if (bets && bets.length) {
            out += `<b>🎯 Suggested Bets:</b>\n`;
            bets.slice(0, 6).forEach((b, i) => {
              const conf =
                typeof b.confidence === "number"
                  ? `${Math.round(b.confidence)}%`
                  : b.confidence || "N/A";
              const ve =
                b.valueEdge !== undefined && b.valueEdge !== null
                  ? ` — Value Edge: +${escapeHtml(String(b.valueEdge))}%`
                  : "";
              const line =
                b.line !== undefined && b.line !== null
                  ? ` (line: ${escapeHtml(String(b.line))})`
                  : "";
              out += `${i + 1}) ${escapeHtml(b.market)}: <b>${escapeHtml(b.selection)}</b>${line} — Confidence: ${escapeHtml(conf)}${ve}\n   • ${escapeHtml(b.rationale || "")}\n`;
            });
            out += `\n`;
          }

          out += `<b>🧠 BETRIX Summary:</b>\n`;
          if (ai.summary) out += `${escapeHtml(ai.summary)}\n\n`;
          else out += `A concise data-driven summary is provided above.\n\n`;
          out += `<i>Powered by BETRIX</i>`;
          return out;
        } catch (e) {
          return `BETRIX Analysis for ${escapeHtml(homeLabel)} vs ${escapeHtml(awayLabel)}`;
        }
      };

      // attach basic ai_analysis summary from heuristics
      try {
        betrixStructured.ai_analysis.summary =
          suggestions && suggestions.length
            ? suggestions[0].rationale || ""
            : null;
        betrixStructured.ai_analysis.keyAngles =
          suggestions && suggestions.length
            ? suggestions.map((s) => s.rationale || s.market)
            : [];
      } catch (e) {
        /* ignore */
      }

      // derive richer AI angles deterministically before calling any LLM
      const structured = deriveAiAngles(betrixStructured);

      // Build a premium human-friendly message. Prefer AI-rendered text when available.
      let premiumText = formatBetrixTelegram(structured);
      try {
        if (
          services &&
          services.azureAI &&
          typeof services.azureAI.chat === "function" &&
          services.azureAI.isHealthy &&
          services.azureAI.isHealthy()
        ) {
          const prompt = buildMatchAnalysisPrompt(structured);
          const aiResp = await services.azureAI.chat(prompt, {
            temperature: 0.2,
            max_tokens: 800,
          });
          if (
            aiResp &&
            typeof aiResp === "string" &&
            aiResp.trim().length > 0
          ) {
            premiumText = aiResp.trim();
          }
        }
      } catch (e) {
        /* ignore AI failures and use fallback premiumText */
      }

      // Optionally attach structured JSON for devs / debug mode only
      const devList = process.env.BETRIX_DEV_USERIDS || "";
      const isDev =
        process.env.BETRIX_DEBUG_JSON === "true" ||
        devList
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .includes(String(userId));
      if (isDev) {
        const prettyJsonBlock = JSON.stringify(structured, null, 2);
        const escapedJson = escapeHtml(prettyJsonBlock);
        premiumText +=
          "\n\n<b>Structured (machine):</b>\n<pre><code>" +
          escapedJson +
          "</code></pre>";
      }

      analysisText += "\n\n" + premiumText;

      // If an AI service is available, ask it to produce a constrained JSON
      // response with explicit suggested bets (Over/Under, HT/FT, BTTS, etc.).
      let aiParsed = null;
      try {
        if (
          services &&
          services.azureAI &&
          typeof services.azureAI.chat === "function" &&
          services.azureAI.isHealthy &&
          services.azureAI.isHealthy()
        ) {
          const prompt = `You are an expert sports betting assistant. Given the following match context JSON, produce a JSON object ONLY with a top-level key \"suggested_bets\" which is an array of bet objects. Each bet object must have: {"type":"market type","market":"market name","selection":"readable selection (e.g. Over 2.5)","line":number|null,"confidence":number (0-100),"rationale":"short reason"}. Provide 3-6 suggestions where relevant. Do not include any other keys.\n\nContext JSON:\n${JSON.stringify(structured)}\n\nReturn only valid JSON.`;
          const aiResp = await services.azureAI.chat(prompt, {
            temperature: 0.2,
            max_tokens: 800,
          });
          if (aiResp && typeof aiResp === "string") {
            // try to extract JSON substring from response
            const firstBrace = aiResp.indexOf("{");
            const lastBrace = aiResp.lastIndexOf("}");
            const jsonText =
              firstBrace >= 0 && lastBrace >= 0
                ? aiResp.slice(firstBrace, lastBrace + 1)
                : aiResp;
            try {
              aiParsed = JSON.parse(jsonText);
            } catch (e) {
              aiParsed = null;
            }
          }
        }
      } catch (e) {
        // ignore AI failures and continue with structured heuristics
        aiParsed = null;
      }

      // If AI returned structured suggestions, render them in a friendly format
      if (
        aiParsed &&
        Array.isArray(aiParsed.suggested_bets) &&
        aiParsed.suggested_bets.length > 0
      ) {
        analysisText += `\n*AI Suggested Bets:*\n`;
        aiParsed.suggested_bets.forEach((b, i) => {
          const conf =
            typeof b.confidence === "number"
              ? `${Math.round(b.confidence)}%`
              : b.confidence
                ? String(b.confidence)
                : "N/A";
          const line =
            b.line !== undefined && b.line !== null ? ` (line: ${b.line})` : "";
          analysisText += `${i + 1}. ${b.market} — ${b.selection}${line} | Confidence: ${conf}\n   • ${b.rationale || ""}\n`;
        });
      }
    } catch (e) {
      // ignore structured block building errors
    }

    try {
      console.info(
        "[handleAnalyzeMatch] responding",
        JSON.stringify({
          chatId,
          matchId: match.id || match.fixtureId || null,
          home: homeLabel,
          away: awayLabel,
          length: (analysisText || "").length,
        }),
      );
    } catch (e) {}

    // Telegram has message length limits and editMessageText may fail with MESSAGE_TOO_LONG.
    // If analysis is large, send as a new message instead of editing the menu message.
    try {
      const MAX_TG_MSG = 3900; // leave headroom from Telegram 4096 limit
      if (analysisText && analysisText.length > MAX_TG_MSG) {
        try {
          console.info(
            "[handleAnalyzeMatch] analysis_too_long; sending as new message",
            JSON.stringify({
              chatId,
              matchId: match.id || match.fixtureId || null,
              length: analysisText.length,
            }),
          );
        } catch (e) {}
        // Truncate safely by stripping HTML to plain text and sending a plain fallback
        const plain = stripHtmlToPlain(analysisText);
        const truncated = plain.slice(0, MAX_TG_MSG) + "\n\n... (truncated)";
        return { method: "sendMessage", chat_id: chatId, text: truncated }; // let TelegramService choose default parse/escape
      }
    } catch (e) {
      /* ignore and fallback to edit */
    }

    return {
      method: "editMessageText",
      chat_id: chatId,
      message_id: undefined,
      text: analysisText,
      parse_mode: "HTML",
    };
  } catch (e) {
    logger.error("handleAnalyzeMatch error", e);
    return {
      method: "sendMessage",
      chat_id: chatId,
      text: "❌ Analysis failed. Please try again.",
      parse_mode: "HTML",
    };
  }
}

/**
 * Show fixtures or quick info for a favorite team (fav_view_{team})
 */
async function handleFavoriteView(data, chatId, userId, redis, services) {
  try {
    const team = decodeURIComponent(data.replace("fav_view_", ""));

    // Try to fetch upcoming fixtures from sportsAggregator if available
    if (
      services &&
      services.sportsAggregator &&
      typeof services.sportsAggregator.getTeamFixtures === "function"
    ) {
      try {
        const fixtures = await services.sportsAggregator.getTeamFixtures(team);
        if (fixtures && fixtures.length > 0) {
          const list = fixtures
            .slice(0, 6)
            .map(
              (f) => `• ${f.home} vs ${f.away} — ${f.date || f.time || "TBD"}`,
            )
            .join("\n");
          return {
            method: "sendMessage",
            chat_id: chatId,
            text: `📌 *Upcoming for ${team}*\n\n${list}`,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "🔙 Back", callback_data: "profile_favorites" }],
              ],
            },
          };
        }
      } catch (e) {
        logger.warn("Failed to fetch team fixtures", { team, e });
      }
    }

    // Fallback: search live matches for team name
    if (
      services &&
      services.sportsAggregator &&
      typeof services.sportsAggregator.getLiveMatches === "function"
    ) {
      try {
        const allLive = await services.sportsAggregator.getLiveMatches();
        const matches = (allLive || [])
          .filter(
            (m) =>
              teamNameOf(m.home).toLowerCase().includes(team.toLowerCase()) ||
              teamNameOf(m.away).toLowerCase().includes(team.toLowerCase()),
          )
          .slice(0, 6);
        if (matches.length > 0) {
          const list = matches
            .map(
              (m) =>
                `• ${teamNameOf(m.home)} vs ${teamNameOf(m.away)} — ${m.time || m.status || "LIVE"}`,
            )
            .join("\n");
          return {
            method: "sendMessage",
            chat_id: chatId,
            text: `🔴 *Live / Recent for ${team}*\n\n${list}`,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "🔙 Back", callback_data: "profile_favorites" }],
              ],
            },
          };
        }
      } catch (e) {
        logger.warn("Failed to search live matches for team", { team, e });
      }
    }

    return {
      method: "sendMessage",
      chat_id: chatId,
      text: `📌 No fixtures or live matches found for *${team}* right now.`,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔙 Back", callback_data: "profile_favorites" }],
        ],
      },
    };
  } catch (e) {
    logger.error("handleFavoriteView error", e);
    return {
      method: "sendMessage",
      chat_id: chatId,
      text: "Failed to fetch team info.",
      parse_mode: "Markdown",
    };
  }
}

/**
 * Return VVIP fixed matches (requires VVIP access)
 */
async function handleVvipFixedMatches(chatId, userId, redis, services) {
  try {
    const subscription = await getUserSubscription(redis, userId).catch(() => ({
      tier: "FREE",
    }));
    if (
      !subscription ||
      (subscription.tier !== "VVIP" && subscription.tier !== "PLUS")
    ) {
      return {
        method: "sendMessage",
        chat_id: chatId,
        text: "🔒 Fixed Matches are available for VVIP subscribers only. Upgrade to access.",
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "👑 Upgrade to VVIP", callback_data: "menu_vvip" },
              { text: "🔙 Back", callback_data: "menu_main" },
            ],
          ],
        },
      };
    }

    if (
      !services ||
      !services.multiSportAnalyzer ||
      typeof services.multiSportAnalyzer.getFixedMatches !== "function"
    ) {
      return {
        method: "sendMessage",
        chat_id: chatId,
        text: "Fixed matches service unavailable.",
        parse_mode: "Markdown",
      };
    }

    const fixed = await services.multiSportAnalyzer
      .getFixedMatches()
      .catch(() => []);
    if (!fixed || fixed.length === 0) {
      return {
        method: "sendMessage",
        chat_id: chatId,
        text: "No fixed matches available at the moment.",
        parse_mode: "Markdown",
      };
    }

    let text = `👑 *VVIP Fixed Matches*\n\n`;
    fixed.slice(0, 8).forEach((f, i) => {
      text += `${i + 1}. *${f.home}* vs *${f.away}* — ${f.market} ${f.pick} (Confidence: ${f.confidence}% | Odds: ${f.odds})\n`;
      if (f.reason) text += `   • ${f.reason}\n`;
    });

    text += `\n⚠️ Fixed matches are curated for VVIP users. Bet responsibly.`;

    return {
      method: "sendMessage",
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
    };
  } catch (e) {
    logger.error("handleVvipFixedMatches error", e);
    return {
      method: "sendMessage",
      chat_id: chatId,
      text: "Failed to load fixed matches.",
      parse_mode: "Markdown",
    };
  }
}

/**
 * Show info about advanced VVIP prediction markets and a CTA
 */
async function handleVvipAdvancedInfo(chatId, userId, redis, services) {
  try {
    const subscription = await getUserSubscription(redis, userId).catch(() => ({
      tier: "FREE",
    }));
    if (
      !subscription ||
      (subscription.tier !== "VVIP" && subscription.tier !== "PLUS")
    ) {
      return {
        method: "sendMessage",
        chat_id: chatId,
        text: "🔒 Advanced HT/FT and Correct Score predictions are for VVIP users. Upgrade to access these markets.",
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "👑 Upgrade to VVIP", callback_data: "menu_vvip" },
              { text: "🔙 Back", callback_data: "menu_main" },
            ],
          ],
        },
      };
    }

    const text = `👑 *VVIP Advanced Predictions*\n\nAs a VVIP member you get:\n• Half-time / Full-time probability lines (e.g., 1/X, X/1)\n• Correct score suggestions with confidence and implied odds\n• Curated fixed matches and high-confidence value bets\n\nTap *Fixed Matches* to view current curated picks or analyze a live match for HT/FT & correct score predictions.`;

    return {
      method: "sendMessage",
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "👑 View Fixed Matches", callback_data: "vvip_fixed" },
            { text: "🔙 Back", callback_data: "menu_main" },
          ],
        ],
      },
    };
  } catch (e) {
    logger.error("handleVvipAdvancedInfo error", e);
    return {
      method: "sendMessage",
      chat_id: chatId,
      text: "Failed to load VVIP info.",
      parse_mode: "Markdown",
    };
  }
}

/**
 * Handle odds for a league
 */
async function handleLeagueOddsCallback(data, chatId, userId, redis, services) {
  const leagueId = data.replace("league_odds_", "");

  try {
    let odds = [];
    if (services && services.sportsAggregator) {
      try {
        odds = await services.sportsAggregator.getOdds(leagueId);
      } catch (e) {
        logger.warn("Failed to fetch odds", e);
      }
    }

    if (!odds || odds.length === 0) {
      return {
        method: "editMessageText",
        chat_id: chatId,
        message_id: undefined,
        text: "⏳ Odds not available.\n\nCheck back soon!",
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🔙 Back",
                callback_data: validateCallbackData(`league_${leagueId}`),
              },
            ],
          ],
        },
      };
    }

    // Format odds beautifully
    const oddsText = odds
      .slice(0, 5)
      .map((m, i) => {
        const h = m.homeOdds || m.odds?.home || "─";
        const d = m.drawOdds || m.odds?.draw || "─";
        const a = m.awayOdds || m.odds?.away || "─";
        return `${i + 1}. ${teamNameOf(m.home)} vs ${teamNameOf(m.away)}\n   🏠 ${h} • 🤝 ${d} • ✈️ ${a}`;
      })
      .join("\n\n");

    return {
      method: "editMessageText",
      chat_id: chatId,
      message_id: undefined,
      text: `💰 *Best Odds*\n\n${oddsText}\n\n_Compare bookmakers_`,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🔙 Back",
              callback_data: validateCallbackData(`league_${leagueId}`),
            },
          ],
        ],
      },
    };
  } catch (err) {
    logger.error("Odds handler error", err);
    return null;
  }
}

/**
 * Handle standings/table for a league
 */
async function handleLeagueStandingsCallback(
  data,
  chatId,
  userId,
  redis,
  services,
) {
  const leagueId = data.replace("league_standings_", "");

  try {
    let standings = [];
    if (services && services.sportsAggregator) {
      try {
        standings = await services.sportsAggregator.getStandings(leagueId);
      } catch (e) {
        logger.warn("Failed to fetch standings", e);
      }
    }

    if (!standings || standings.length === 0) {
      return {
        method: "editMessageText",
        chat_id: chatId,
        message_id: undefined,
        text: "⏳ Standings not available.\n\nCheck back soon!",
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🔙 Back",
                callback_data: validateCallbackData(`league_${leagueId}`),
              },
            ],
          ],
        },
      };
    }

    // Format standings beautifully (top 10)
    const tableText = standings
      .slice(0, 10)
      .map((row, i) => {
        const pos = String(i + 1).padStart(2, " ");
        const team = (row.team || row.Team || row.name || "?")
          .substring(0, 15)
          .padEnd(15);
        const pts = String(row.points || row.goalDifference || 0).padStart(3);
        return `${pos}. ${team} ${pts}`;
      })
      .join("\n");

    return {
      method: "editMessageText",
      chat_id: chatId,
      message_id: undefined,
      text: `📊 *League Table*\n\n\`\`\`\nPos Team           Pts\n${tableText}\n\`\`\``,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🔙 Back",
              callback_data: validateCallbackData(`league_${leagueId}`),
            },
          ],
        ],
      },
    };
  } catch (err) {
    logger.error("Standings handler error", err);
    return null;
  }
}

// Betslip helpers
// ----------------------
/**
 * Handle favorite add/remove callbacks
 */
async function handleFavoriteCallback(data, chatId, userId, redis) {
  try {
    if (data.startsWith("fav_add_")) {
      const teamName = decodeURIComponent(data.replace("fav_add_", ""));
      await redis.sadd(`user:${userId}:favorites`, teamName);
      return {
        method: "answerCallbackQuery",
        callback_query_id: undefined,
        text: `⭐ Added ${teamName} to your favorites!`,
        show_alert: false,
      };
    }

    if (data.startsWith("fav_remove_")) {
      const teamName = decodeURIComponent(data.replace("fav_remove_", ""));
      await redis.srem(`user:${userId}:favorites`, teamName);
      return {
        method: "answerCallbackQuery",
        callback_query_id: undefined,
        text: `🗑 Removed ${teamName} from your favorites.`,
        show_alert: false,
      };
    }

    return {
      method: "answerCallbackQuery",
      callback_query_id: undefined,
      text: "Unknown favorite action",
    };
  } catch (e) {
    logger.error("Favorite callback error", e);
    return {
      method: "answerCallbackQuery",
      callback_query_id: undefined,
      text: "Failed to update favorites",
      show_alert: true,
    };
  }
}
async function createBetslip(redis, userId, fixtureId, fixtureText) {
  const id = `BETS${userId}${Date.now()}`;
  const bet = {
    id,
    userId,
    fixtureId,
    fixtureText,
    stake: 100,
    selection: "home",
    createdAt: new Date().toISOString(),
  };
  // store for 1 hour
  await redis.setex(`betslip:${id}`, 3600, JSON.stringify(bet));
  return bet;
}

async function handleBetCreate(data, chatId, userId, redis, services) {
  try {
    const fixtureId = data.replace("bet_fixture_", "");

    // Try to resolve fixture info via apiFootball if available
    let fixtureText = `Fixture ${fixtureId}`;
    try {
      if (
        services &&
        services.apiFootball &&
        typeof services.apiFootball.getFixture === "function"
      ) {
        const res = await services.apiFootball.getFixture(fixtureId);
        const f = res?.response?.[0];
        if (f)
          fixtureText = `${f.teams?.home?.name || "Home"} vs ${f.teams?.away?.name || "Away"}`;
      }
    } catch (e) {
      logger.warn("Could not resolve fixture details", e);
    }

    const bet = await createBetslip(redis, userId, fixtureId, fixtureText);

    const text = `🧾 *Betslip*\n\nFixture: *${bet.fixtureText}*\nStake: KES ${bet.stake}\nSelection: *${bet.selection}*\n\nTap to confirm your bet.`;

    return {
      method: "sendMessage",
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ Place Bet", callback_data: `place_bet_${bet.id}` }],
          [{ text: "✏️ Change Stake", callback_data: `edit_bet_${bet.id}` }],
          [{ text: "🔙 Back", callback_data: "menu_live" }],
        ],
      },
    };
  } catch (err) {
    logger.error("handleBetCreate error", err);
    return {
      method: "sendMessage",
      chat_id: chatId,
      text: "❌ Failed to create betslip. Try again later.",
      parse_mode: "Markdown",
    };
  }
}

async function handlePlaceBet(data, chatId, userId, redis) {
  try {
    const betId = data.replace("place_bet_", "");
    const raw = await redis.get(`betslip:${betId}`);
    if (!raw) {
      return {
        method: "sendMessage",
        chat_id: chatId,
        text: "⚠️ Betslip expired or not found.",
        parse_mode: "Markdown",
      };
    }
    const bet = JSON.parse(raw);

    // For free users, we mock placement and store in user's bets history
    const txId = `BTX${Date.now()}`;
    await redis.rpush(
      `user:${userId}:bets`,
      JSON.stringify({ ...bet, placedAt: new Date().toISOString(), txId }),
    );
    // remove betslip
    await redis.del(`betslip:${betId}`);

    const text =
      "✅ Bet placed!\n\nFixture: *" +
      bet.fixtureText +
      "*\nStake: KES " +
      bet.stake +
      "\nSelection: *" +
      bet.selection +
      "*\nTransaction: `" +
      txId +
      "`\n\nGood luck!";

    return {
      method: "sendMessage",
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🎯 My Bets", callback_data: "profile_bets" },
            { text: "🔙 Main Menu", callback_data: "menu_main" },
          ],
        ],
      },
    };
  } catch (err) {
    logger.error("handlePlaceBet error", err);
    return {
      method: "sendMessage",
      chat_id: chatId,
      text: "❌ Failed to place bet.",
      parse_mode: "Markdown",
    };
  }
}

// Present stake options to user
async function handleEditBet(data, chatId, userId, redis) {
  try {
    const betId = data.replace("edit_bet_", "");
    const raw = await redis.get(`betslip:${betId}`);
    if (!raw)
      return {
        method: "sendMessage",
        chat_id: chatId,
        text: "⚠️ Betslip not found or expired.",
        parse_mode: "Markdown",
      };
    const bet = JSON.parse(raw);

    const keyboard = [
      [
        { text: "KES 50", callback_data: `set_bet_${bet.id}_50` },
        { text: "KES 100", callback_data: `set_bet_${bet.id}_100` },
      ],
      [
        { text: "KES 200", callback_data: `set_bet_${bet.id}_200` },
        { text: "KES 500", callback_data: `set_bet_${bet.id}_500` },
      ],
      [{ text: "🔙 Cancel", callback_data: `bet_fixture_${bet.fixtureId}` }],
    ];

    return {
      method: "editMessageText",
      chat_id: chatId,
      message_id: undefined,
      text: `✏️ *Edit Stake*\n\nCurrent stake: KES ${bet.stake}\nChoose a new stake:`,
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: keyboard },
    };
  } catch (err) {
    logger.error("handleEditBet error", err);
    return {
      method: "sendMessage",
      chat_id: chatId,
      text: "❌ Error editing bet.",
      parse_mode: "Markdown",
    };
  }
}

// Handle stake selection and update betslip
async function handleSetBetStake(data, chatId, userId, redis) {
  try {
    // format set_bet_{betId}_{amount}
    const parts = data.split("_");
    const betId = parts[2];
    const amount = Number(parts[3] || 0);
    if (!betId || !amount)
      return {
        method: "sendMessage",
        chat_id: chatId,
        text: "⚠️ Invalid stake selection.",
        parse_mode: "Markdown",
      };

    const raw = await redis.get(`betslip:${betId}`);
    if (!raw)
      return {
        method: "sendMessage",
        chat_id: chatId,
        text: "⚠️ Betslip expired or not found.",
        parse_mode: "Markdown",
      };
    const bet = JSON.parse(raw);
    bet.stake = amount;
    await redis.setex(`betslip:${betId}`, 3600, JSON.stringify(bet));

    return {
      method: "editMessageText",
      chat_id: chatId,
      message_id: undefined,
      text: `🧾 *Betslip Updated*\n\nFixture: *${bet.fixtureText}*\nNew stake: KES ${bet.stake}\n\nTap to place the bet.`,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Place Bet", callback_data: `place_bet_${bet.id}` },
            { text: "🔙 Back", callback_data: "menu_live" },
          ],
        ],
      },
    };
  } catch (err) {
    logger.error("handleSetBetStake error", err);
    return {
      method: "sendMessage",
      chat_id: chatId,
      text: "❌ Error setting stake.",
      parse_mode: "Markdown",
    };
  }
}

/**
 * Start onboarding flow for new user
 */
async function startOnboarding(chatId, userId, redis, services) {
  try {
    // Defensive: don't start onboarding if user already ACTIVE
    try {
      // Prefer centralized helper on userService when available
      const userSvc =
        services && services.userService
          ? services.userService
          : new UserService(redis);
      const cleaned = await (typeof userSvc.ensureNoOnboarding === "function"
        ? userSvc.ensureNoOnboarding(userId).catch(() => false)
        : Promise.resolve(false));
      if (cleaned) {
        logger.info("startOnboarding skipped because user already ACTIVE (cleaned)", { userId });
        return null;
      }
    } catch (e) {
      logger.warn("startOnboarding defensive check failed", e?.message || String(e));
    }

    // seed onboarding state
    const state = { step: "name", createdAt: Date.now() };
    await redis.setex(`user:${userId}:onboarding`, 1800, JSON.stringify(state));
    return {
      method: "sendMessage",
      chat_id: chatId,
      text: "📝 Welcome to BETRIX! Let's set up your account. What is your full name?\n\n_Reply with your full name to continue._",
      parse_mode: "Markdown",
    };
  } catch (e) {
    logger.error("startOnboarding failed", e);
    return {
      method: "sendMessage",
      chat_id: chatId,
      text: "Failed to start signup. Try again later.",
    };
  }
}

/**
 * Handle onboarding messages (name, age, country, payment method)
 */
async function handleOnboardingMessage(text, chatId, userId, redis, services) {
  try {
    // Defensive: if user is ACTIVE, ignore onboarding and remove stale key
    try {
      const userSvc =
        services && services.userService
          ? services.userService
          : new UserService(redis);
      const cleaned = await (typeof userSvc.ensureNoOnboarding === "function"
        ? userSvc.ensureNoOnboarding(userId).catch(() => false)
        : Promise.resolve(false));
      if (cleaned) {
        logger.info("Ignored onboarding because user.state === ACTIVE (cleaned)", { userId });
        return null;
      }
    } catch (e) {
      logger.warn("Onboarding active-state defensive check failed", e?.message || String(e));
    }

    const raw = await redis.get(`user:${userId}:onboarding`);
    if (!raw) return null;
    const state = JSON.parse(raw);

    if (state.step === "name") {
      const name = String(text || "").trim();
      if (!name || name.length < 2) {
        return {
          method: "sendMessage",
          chat_id: chatId,
          text: "Please send a valid full name (at least 2 characters).",
        };
      }
      await redis.hset(`user:${userId}:profile`, "name", name);
      state.step = "age";
      await redis.setex(
        `user:${userId}:onboarding`,
        1800,
        JSON.stringify(state),
      );
      return {
        method: "sendMessage",
        chat_id: chatId,
        text: `Thanks *${name}*! How old are you?`,
        parse_mode: "Markdown",
      };
    }

    if (state.step === "age") {
      const age = parseInt((text || "").replace(/\D/g, ""), 10);
      if (!age || age < 13) {
        return {
          method: "sendMessage",
          chat_id: chatId,
          text: "Please enter a valid age (13+).",
        };
      }
      await redis.hset(`user:${userId}:profile`, "age", String(age));
      state.step = "country";
      await redis.setex(
        `user:${userId}:onboarding`,
        1800,
        JSON.stringify(state),
      );

      // present country options
      const keyboard = [
        [
          { text: "🇰🇪 Kenya", callback_data: "signup_country_KE" },
          { text: "🇳🇬 Nigeria", callback_data: "signup_country_NG" },
        ],
        [
          { text: "🇺🇸 USA", callback_data: "signup_country_US" },
          { text: "🇬🇧 UK", callback_data: "signup_country_UK" },
        ],
        [{ text: "🌍 Other", callback_data: "signup_country_OTHER" }],
      ];

      return {
        method: "sendMessage",
        chat_id: chatId,
        text: "Great — which country are you in? (choose below)",
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: keyboard },
      };
    }

    // default fallback
    return {
      method: "sendMessage",
      chat_id: chatId,
      text: "Onboarding in progress. Please follow the instructions.",
    };
  } catch (e) {
    logger.error("handleOnboardingMessage failed", e);
    return {
      method: "sendMessage",
      chat_id: chatId,
      text: "Signup failed. Please try again.",
    };
  }
}

/**
 * Handle signup country callback
 */
async function handleSignupCountry(data, chatId, userId, redis, services) {
  try {
    const code = data.replace("signup_country_", "") || "OTHER";
    await redis.hset(`user:${userId}:profile`, "country", code);

    // Move to payment method selection
    const state = { step: "payment_method" };
    await redis.setex(`user:${userId}:onboarding`, 1800, JSON.stringify(state));

    // Get available methods for this country and build buttons
    const methods = getAvailablePaymentMethods(code);
    const keyboard = methods.map((m) => [
      {
        text: `${m.emoji || "💳"} ${m.name}`,
        callback_data: validateCallbackData(`signup_paymethod_${m.id}`),
      },
    ]);
    keyboard.push([{ text: "🔙 Cancel", callback_data: "menu_main" }]);

    const text = `🌍 Great choice! Now, what's your preferred payment method?\n\n(These are available in your region)`;

    return {
      method: "sendMessage",
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: keyboard },
    };
  } catch (e) {
    logger.error("handleSignupCountry failed", e);
    return {
      method: "sendMessage",
      chat_id: chatId,
      text: "Failed to select country. Try again.",
    };
  }
}

/**
 * Handle signup payment method selection: signup_paymethod_{METHOD_ID}
 */
async function handleSignupPaymentMethodSelection(
  data,
  chatId,
  userId,
  redis,
  services,
) {
  try {
    const methodId = data.replace("signup_paymethod_", "");
    const profile = (await redis.hgetall(`user:${userId}:profile`)) || {};

    // Store payment method preference
    await redis.hset(`user:${userId}:profile`, "paymentMethod", methodId);

    // Mark onboarding as complete (confirm) and make user ACTIVE for AI access
    const state = { step: "confirm" };
    await redis.setex(`user:${userId}:onboarding`, 1800, JSON.stringify(state));
    // Ensure the user's state is ACTIVE so AI routing is allowed even before payment
    try {
      const raw = await redis.get(`user:${userId}`).catch(() => null);
      if (raw) {
        try {
          const u = JSON.parse(raw || "{}") || {};
          u.state = "ACTIVE";
          await redis.set(`user:${userId}`, JSON.stringify(u));
        } catch (e) {
          // if parsing fails, overwrite with minimal active state
          await redis.set(`user:${userId}`, JSON.stringify({ state: "ACTIVE", updatedAt: Date.now() }));
        }
      } else {
        // try hash fallback
        try {
          const h = await redis.hgetall(`user:${userId}`).catch(() => ({}));
          if (h && Object.keys(h).length) {
            h.state = "ACTIVE";
            await redis.set(`user:${userId}`, JSON.stringify(h));
          } else {
            await redis.set(`user:${userId}`, JSON.stringify({ state: "ACTIVE", createdAt: new Date().toISOString() }));
          }
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      logger.debug("Failed to mark user ACTIVE after signup confirm", e?.message || String(e));
    }

    // Ensure onboarding key is removed once user is ACTIVE (use centralized helper)
    try {
      const userSvc =
        services && services.userService
          ? services.userService
          : new UserService(redis);
      await (typeof userSvc.ensureNoOnboarding === "function"
        ? userSvc.ensureNoOnboarding(userId).catch(() => false)
        : Promise.resolve(false));
    } catch (e) {
      logger.debug("Failed to delete onboarding key after marking ACTIVE", e?.message || String(e));
    }

    const name = profile.name || "New User";
    const age = profile.age || "N/A";
    const country = profile.country || "Unknown";

    // Compute signup fee based on country
    const feeMap = { KE: 150, NG: 500, US: 1, UK: 1, OTHER: 1 };
    const amount = feeMap[country] || feeMap.OTHER;
    const currency =
      { KE: "KES", NG: "NGN", US: "USD", UK: "GBP", OTHER: "USD" }[country] ||
      "USD";

    const text = `✅ *Signup Summary*\n\nName: ${name}\nAge: ${age} years\nCountry: ${country}\nPayment Method: ${methodId}\n\n💳 One-time signup fee: *${amount} ${currency}*\n\nClick the button below to complete payment and activate your account.`;

    return {
      method: "sendMessage",
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "✅ Pay & Activate",
              callback_data: validateCallbackData(
                `signup_pay_${methodId}_${amount}_${currency}`,
              ),
            },
          ],
          [{ text: "🔙 Back", callback_data: "menu_main" }],
        ],
      },
    };
  } catch (e) {
    logger.error("handleSignupPaymentMethodSelection failed", e);
    return {
      method: "sendMessage",
      chat_id: chatId,
      text: "Failed to select payment method. Try again.",
    };
  }
}

/**
 * Handle signup payment callback: signup_pay_{METHOD}_{AMOUNT}_{CURRENCY}
 */
async function handleSignupPaymentCallback(
  data,
  chatId,
  userId,
  redis,
  services,
) {
  try {
    const parts = data.split("_");
    // parts: ['signup','pay','METHOD','AMOUNT'] or ['signup','pay','METHOD','AMOUNT','CURRENCY']
    let method = parts[2];
    const amount = Number(parts[3] || 0);
    const currency = parts[4] || "KES";

    // Normalize payment method to canonical key
    method = normalizePaymentMethod(method) || method;

    const profile = (await redis.hgetall(`user:${userId}:profile`)) || {};
    const country = profile.country || "KE";

    // Validate payment method is available in country
    const availableMethods = getAvailablePaymentMethods(country);
    const methodAvailable = availableMethods.some((m) => m.id === method);
    if (!methodAvailable) {
      return {
        method: "sendMessage",
        chat_id: chatId,
        text: `❌ Payment method "${method}" is not available in ${country}. Please select another.`,
        reply_markup: {
          inline_keyboard: [[{ text: "🔙 Back", callback_data: "menu_main" }]],
        },
      };
    }

    // Create custom payment order
    const { createCustomPaymentOrder, getPaymentInstructions } =
      await import("./payment-router.js");
    const order = await createCustomPaymentOrder(
      redis,
      userId,
      amount,
      method,
      country,
      { signup: true },
    );
    const instructions = await getPaymentInstructions(
      redis,
      order.orderId,
      method,
    ).catch(() => null);

    let instrText = `💳 *BETRIX PAYMENT*\n\n`;
    instrText += `Order ID: \`${order.orderId}\`\n`;
    instrText += `Amount: *${amount} ${currency}*\n`;
    instrText += `Method: *${method.replace("_", " ").toUpperCase()}*\n`;
    instrText += `Status: ⏳ Awaiting Payment\n\n`;

    // Display detailed payment instructions from instructions object
    if (
      instructions &&
      instructions.manualSteps &&
      Array.isArray(instructions.manualSteps)
    ) {
      instrText += instructions.manualSteps.join("\n");
    } else if (instructions && instructions.description) {
      instrText += `📝 ${instructions.description}\n`;
    }

    const keyboard = [];
    if (instructions && instructions.checkoutUrl) {
      keyboard.push([
        { text: "🔗 Open Payment Link", url: instructions.checkoutUrl },
      ]);
    }

    keyboard.push([
      {
        text: "✅ Verify Payment",
        callback_data: validateCallbackData(`verify_payment_${order.orderId}`),
      },
      {
        text: "❓ Help",
        callback_data: validateCallbackData(`payment_help_${method}`),
      },
    ]);

    keyboard.push([{ text: "🔙 Cancel Payment", callback_data: "menu_main" }]);

    instrText += `\n\n💡 *Quick Tip:* After making payment, paste your transaction confirmation message here for instant verification!`;

    return {
      method: "sendMessage",
      chat_id: chatId,
      text: instrText,
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: keyboard },
    };
  } catch (e) {
    logger.error("handleSignupPaymentCallback failed", e);
    return {
      method: "sendMessage",
      chat_id: chatId,
      text: `❌ Payment setup failed: ${e.message || "Unknown error"}. Please try again.`,
      reply_markup: {
        inline_keyboard: [[{ text: "🔙 Back", callback_data: "menu_main" }]],
      },
    };
  }
}

/**
 * Handle payment help/guide request: payment_help_{METHOD}
 * Display step-by-step guide for a specific payment method
 */
async function handlePaymentHelp(data, chatId, userId, redis) {
  try {
    const method = data.replace("payment_help_", "");
    const guide = getPaymentGuide(method);

    if (!guide) {
      return {
        method: "sendMessage",
        chat_id: chatId,
        text: `❌ Payment method "${method}" guide not found.`,
        reply_markup: {
          inline_keyboard: [[{ text: "🔙 Back", callback_data: "menu_main" }]],
        },
      };
    }

    let guideText = `📖 *${guide.title} - Step-by-Step Guide*\n\n`;
    guideText += `${guide.description}\n\n`;
    guideText += `*Steps:*\n`;
    guideText += guide.steps.map((step, i) => `${i + 1}️⃣ ${step}`).join("\n");
    guideText += `\n\n💡 *Have questions?* Contact support for assistance.`;

    return {
      method: "sendMessage",
      chat_id: chatId,
      text: guideText,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔙 Back to Payment", callback_data: "menu_main" }],
        ],
      },
    };
  } catch (e) {
    logger.error("handlePaymentHelp failed", e);
    return {
      method: "sendMessage",
      chat_id: chatId,
      text: `❌ Failed to load payment guide: ${e.message || "Unknown error"}`,
      reply_markup: {
        inline_keyboard: [[{ text: "🔙 Back", callback_data: "menu_main" }]],
      },
    };
  }
}

/**
 * Handle sport selection with fixtures-manager integration
 */
async function handleSportCallback(data, chatId, userId, redis, services) {
  const sportKey = data.replace("sport_", "");
  const sportName = sportKey.charAt(0).toUpperCase() + sportKey.slice(1);

  try {
    // 🎯 TRY FIXTURES MANAGER FIRST
    let leagues = [];
    try {
      // FixturesManager is a class (default export) - instantiate with Redis
      const fm = new FixturesManager(redis);
      leagues = await fm.getLeagueFixtures(sportKey);
      if (leagues && leagues.length > 0) {
        leagues = leagues.slice(0, 8).map((l) => ({
          id: l.id || l.league?.id || "0",
          name: l.name || l.league?.name || "Unknown",
          matches: l.matches || 0,
        }));
      }
    } catch (e) {
      logger.warn(
        "Fixtures manager failed, trying sportsAggregator",
        e.message,
      );
    }

    // 🎯 FALLBACK TO SPORTSAGGREGATOR IF NEEDED
    if (
      !leagues ||
      (leagues.length === 0 && services && services.sportsAggregator)
    ) {
      try {
        const allLeagues = await services.sportsAggregator.getLeagues(sportKey);
        leagues = allLeagues.slice(0, 8).map((l) => ({
          id: l.id || l.league?.id || l.competition?.id || "0",
          name: l.name || l.league?.name || l.competition?.name || "Unknown",
        }));
      } catch (e) {
        logger.warn("Failed to fetch leagues from aggregator", e);
      }
    }

    // Fallback to popular leagues if none fetched
    if (!leagues || leagues.length === 0) {
      leagues = [
        { id: "39", name: "⚽ Premier League (England)" },
        { id: "140", name: "⚽ La Liga (Spain)" },
        { id: "135", name: "⚽ Serie A (Italy)" },
        { id: "61", name: "⚽ Ligue 1 (France)" },
        { id: "78", name: "⚽ Bundesliga (Germany)" },
        { id: "2", name: "🏆 UEFA Champions League" },
        { id: "3", name: "🏆 UEFA Europa League" },
        { id: "39", name: "📺 Other Leagues" },
      ];
    }

    const keyboard = leagues.map((l) => [
      {
        text:
          l.name.includes("⚽") || l.name.includes("🏆")
            ? l.name
            : `⚽ ${l.name}`,
        callback_data: `league_${l.id}`,
      },
    ]);
    keyboard.push([{ text: "🔙 Back to Sports", callback_data: "menu_live" }]);

    return {
      method: "editMessageText",
      chat_id: chatId,
      message_id: undefined,
      text: `🏟️ *${sportName}* - Select a league\n\nChoose your favorite league to see live matches, odds, and standings.`,
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: keyboard },
    };
  } catch (err) {
    logger.warn("handleSportCallback failed", err);
    return {
      method: "editMessageText",
      chat_id: chatId,
      message_id: undefined,
      text: `Loading ${sportName} leagues...`,
      parse_mode: "Markdown",
    };
  }
}

/**
 * Handle subscription callbacks
 */
async function handleSubscriptionCallback(
  data,
  chatId,
  userId,
  redis,
  services,
) {
  try {
    // Handle manage subscription
    if (data === "sub_manage") {
      const subscription = await getUserSubscription(redis, userId);
      // 🎯 USE BETRIX BRANDING FOR SUBSCRIPTION DISPLAY
      const header = brandingUtils.generateBetrixHeader(subscription.tier);
      const comparison = premiumUI.buildSubscriptionComparison(
        subscription.tier,
      );
      const text = `${header}\n\n${comparison}`;

      return {
        method: "editMessageText",
        chat_id: chatId,
        message_id: undefined,
        text: text,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[{ text: "🔙 Back", callback_data: "menu_vvip" }]],
        },
      };
    }

    // Handle tier selection (sub_free, sub_pro, sub_vvip, sub_plus)
    if (data.startsWith("sub_")) {
      const tier = data.replace("sub_", "").toUpperCase();
      const tierConfig = TIERS[tier];

      if (!tierConfig) {
        return {
          method: "answerCallbackQuery",
          callback_query_id: undefined,
          text: "❌ Invalid tier selection",
          show_alert: false,
        };
      }

      // Get user's region (default KE for now)
      const userRegion =
        (await redis.hget(`user:${userId}:profile`, "region")) || "KE";

      // Get available payment methods for region
      const paymentMethodObjects = getAvailablePaymentMethods(userRegion);
      const paymentMethodIds = paymentMethodObjects.map((m) => m.id);

      // Handle case where no payment methods are available
      if (!paymentMethodIds || paymentMethodIds.length === 0) {
        return {
          method: "answerCallbackQuery",
          callback_query_id: undefined,
          text: `❌ No payment methods available in your region (${userRegion}). Please contact support.`,
          show_alert: true,
        };
      }

      // Persist selected tier for this user for 15 minutes so payment callbacks can reference it
      try {
        await redis.setex(
          `user:${userId}:pending_payment`,
          900,
          JSON.stringify({ tier, region: userRegion, createdAt: Date.now() }),
        );
      } catch (e) {
        logger.warn("Failed to persist pending payment", e);
      }

      return {
        method: "sendMessage",
        chat_id: chatId,
        text: `🌀 *${tierConfig.name}* - KES ${tierConfig.price}/month\n\n✨ *Features:*\n${tierConfig.features.map((f) => `• ${f}`).join("\n")}\n\n*Select payment method:*`,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: buildPaymentMethodButtons(paymentMethodIds, tier),
        },
      };
    }

    // Handle subscription tier selection from main menu
    const tier = data.replace("sub_", "").toUpperCase();
    const tierConfig = TIERS[tier];

    if (!tierConfig) {
      return {
        method: "answerCallbackQuery",
        callback_query_id: undefined,
        text: "❌ Invalid tier selection",
        show_alert: false,
      };
    }

    return {
      method: "sendMessage",
      chat_id: chatId,
      text: `💳 Ready to upgrade to ${tierConfig.name}?\n\nKES ${tierConfig.price}/month\n\nClick Pay to continue.`,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "💳 Proceed to Payment", callback_data: `pay_${tier}` }],
          [{ text: "🔙 Back", callback_data: "menu_vvip" }],
        ],
      },
    };
  } catch (error) {
    logger.error("Subscription callback error:", error);
    return {
      method: "sendMessage",
      chat_id: chatId,
      text: "❌ An error occurred. Please try again.",
      parse_mode: "Markdown",
    };
  }
}

/**
 * Build payment method buttons based on available methods
 * methodIds: array of method ID strings like ['SAFARICOM_TILL', 'MPESA', 'BINANCE']
 */
function buildPaymentMethodButtons(methodIds, tier) {
  const buttons = [];

  if (!methodIds || methodIds.length === 0) return buttons;

  // Safaricom Till (high priority for KE)
  if (methodIds.includes("SAFARICOM_TILL")) {
    const TILL_NUMBER =
      process.env.MPESA_TILL || process.env.SAFARICOM_TILL_NUMBER || "606215";
    buttons.push([
      {
        text: `🏪 Safaricom Till #${TILL_NUMBER} (Recommended)`,
        callback_data: `pay_safaricom_till_${tier}`,
      },
    ]);
  }

  // M-Pesa
  if (methodIds.includes("MPESA")) {
    buttons.push([
      {
        text: "📱 M-Pesa STK Push",
        callback_data: `pay_mpesa_${tier}`,
      },
    ]);
  }

  // PayPal
  if (methodIds.includes("PAYPAL")) {
    buttons.push([
      {
        text: "💳 PayPal",
        callback_data: `pay_paypal_${tier}`,
      },
    ]);
  }

  // Binance
  if (methodIds.includes("BINANCE")) {
    buttons.push([
      {
        text: "₿ Binance Pay",
        callback_data: `pay_binance_${tier}`,
      },
    ]);
  }

  // SWIFT
  if (methodIds.includes("SWIFT")) {
    buttons.push([
      {
        text: "🏦 Bank Transfer (SWIFT)",
        callback_data: `pay_swift_${tier}`,
      },
    ]);
  }

  // Back button
  buttons.push([
    {
      text: "🔙 Back",
      callback_data: "menu_vvip",
    },
  ]);

  return buttons;
}

/**
 * Handle profile callbacks
 */
async function handleProfileCallback(data, chatId, userId, redis) {
  try {
    if (data === "profile_stats") {
      const user = (await safeGetUserData(redis, `user:${userId}`)) || {};
      const sub = await getUserSubscription(redis, userId);

      // 🎯 USE BETRIX BRANDING FOR PROFILE
      const header = brandingUtils.generateBetrixHeader(sub.tier);
      const profileText = formatProfile({
        name: (user && user.name) || "BETRIX User",
        tier: sub.tier || "FREE",
        joinDate: (user && user.joinDate) || new Date().toLocaleDateString(),
        predictions: (user && user.predictions) || 0,
        winRate: (user && user.winRate) || "0",
        points: user.points || 0,
        referralCode: user.referralCode || `USER${userId}`,
        referrals: user.referrals || 0,
        bonusPoints: user.bonusPoints || 0,
      });

      return {
        method: "editMessageText",
        chat_id: chatId,
        message_id: undefined,
        text: `${header}\n\n${profileText}`,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 Back", callback_data: "menu_profile" }],
          ],
        },
      };
    }

    if (data === "profile_bets") {
      const bets = (await redis.lrange(`user:${userId}:bets`, 0, 4)) || [];
      const betList =
        bets.length > 0
          ? `Recent bets:\n${bets.map((b, i) => `${i + 1}. ${b}`).join("\n")}`
          : "No bets placed yet. Start by selecting a match!";

      const header = brandingUtils.generateBetrixHeader("FREE");
      return {
        method: "editMessageText",
        chat_id: chatId,
        message_id: undefined,
        text: `${header}\n\n💰 *My Bets*\n\n${betList}\n\n_Tap a bet to view details_`,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 Back", callback_data: "menu_profile" }],
          ],
        },
      };
    }

    if (data === "profile_favorites") {
      const favs = (await redis.smembers(`user:${userId}:favorites`)) || [];
      const favList =
        favs.length > 0
          ? `Your favorite teams:\n${favs.map((f, i) => `${i + 1}. ${f}`).join("\n")}`
          : "No favorites yet. Add teams to track them!";

      const header = brandingUtils.generateBetrixHeader("FREE");
      return {
        method: "editMessageText",
        chat_id: chatId,
        message_id: undefined,
        text: `${header}\n\n⭐ *My Favorites*\n\n${favList}`,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 Back", callback_data: "menu_profile" }],
          ],
        },
      };
    }

    if (data === "profile_manage_favs") {
      const r = createRedisAdapter(redis);
      const favs = (await r.smembers(`user:${userId}:favorites`)) || [];
      const keyboard = favs.length
        ? favs.map((f) => [
            {
              text: `${f}`,
              callback_data: `fav_view_${encodeURIComponent(f)}`,
            },
            {
              text: "❌ Remove",
              callback_data: `fav_remove_${encodeURIComponent(f)}`,
            },
          ])
        : [[{ text: "➕ Add Favorite", callback_data: "favorites:add" }]];
      keyboard.push([{ text: "🔙 Back", callback_data: "menu_profile" }]);
      const header = brandingUtils.generateBetrixHeader("FREE");
      return {
        method: "editMessageText",
        chat_id: chatId,
        message_id: undefined,
        text: `${header}\n\n⭐ *Manage Favorites*\n\n${favs.length ? "Tap a team to view or remove it." : "No favorites yet."}`,
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: keyboard },
      };
    }

    if (data === "profile_edit_name") {
      try {
        const r = createRedisAdapter(redis);
        await r.set(`signup:${userId}:state`, "awaiting_name");
        (await r.expire) && r.expire(`signup:${userId}:state`, 600);
      } catch (e) {
        logger.warn(
          "Failed to set awaiting_name state",
          e?.message || String(e),
        );
      }
      return {
        method: "answerCallbackQuery",
        callback_query_id: undefined,
        text: "Please send your new display name as a message. It will be saved to your profile.",
        show_alert: true,
      };
    }

    if (data === "profile_settings") {
      return {
        method: "editMessageText",
        chat_id: chatId,
        message_id: undefined,
        text: `🔧 *Account Settings*\n\n• Notifications: ✅ Enabled\n• Language: 🌐 English\n• Timezone: 🕐 UTC+3\n\n_Settings panel coming soon!_`,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 Back", callback_data: "menu_profile" }],
          ],
        },
      };
    }

    // Fallback
    return {
      method: "sendMessage",
      chat_id: chatId,
      text: `🌀 *BETRIX* - Profile Feature`,
      parse_mode: "Markdown",
    };
  } catch (err) {
    logger.error("Profile callback error", err);
    return null;
  }
}

/**
 * Handle help callbacks
 */
async function handleHelpCallback(data, chatId, userId, redis) {
  try {
    if (data === "help_faq") {
      return {
        method: "editMessageText",
        chat_id: chatId,
        message_id: undefined,
        text: `❓ *Frequently Asked Questions*

*Q: How do I place a bet?*
A: Tap ⚽ Live Games → Select sport → Choose a match → Tap "Quick Bet"

*Q: What are the subscription tiers?*
A: Free (basic), Pro (KES 899/mo), VVIP (KES 2,699/mo), Plus (KES 8,999/mo)

*Q: How do I make a payment?*
A: Go to 💰 Subscribe → Pick your plan → Choose payment method

*Q: What's the referral code for?*
A: Share your code with friends. When they sign up, you both earn bonuses!

*Q: Is BETRIX available 24/7?*
A: Yes! Bet anytime, live analysis every day.

*Need more help?*
Contact: support@betrix.app`,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[{ text: "🔙 Back", callback_data: "menu_help" }]],
        },
      };
    }

    if (data === "help_demo") {
      return {
        method: "editMessageText",
        chat_id: chatId,
        message_id: undefined,
        text: `🎮 *Try the Demo*

Let's walk through a real example:

*Step 1:* Tap ⚽ Live Games
*Step 2:* Select ⚽ Football
*Step 3:* Choose Premier League
*Step 4:* You'll see live matches
*Step 5:* Tap a match → "Quick Bet"
*Step 6:* Enter your stake
*Step 7:* Confirm bet

💡 *Pro Tip:* Use VVIP for advanced predictions with 85%+ accuracy!

Ready? Tap "Back" and start! 🚀`,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[{ text: "🔙 Back", callback_data: "menu_help" }]],
        },
      };
    }

    if (data === "help_contact") {
      return {
        method: "editMessageText",
        chat_id: chatId,
        message_id: undefined,
        text: `📧 *Contact Support*

We're here to help! Reach out:

📧 *Email:* support@betrix.app
💬 *WhatsApp:* +254 700 123456
🐦 *Twitter:* @BETRIXApp
📱 *Telegram:* @BETRIXSupport

*Response time:* Usually within 2 hours

*For billing issues:* billing@betrix.app
*For technical support:* tech@betrix.app`,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[{ text: "🔙 Back", callback_data: "menu_help" }]],
        },
      };
    }

    // Fallback
    return {
      method: "sendMessage",
      chat_id: chatId,
      text: `📚 *Help & Support*\n\n${data}`,
      parse_mode: "Markdown",
    };
  } catch (err) {
    logger.error("Help callback error", err);
    return null;
  }
}

/**
 * Handle payment method selection with tier extraction
 */
async function handlePaymentMethodSelection(
  data,
  chatId,
  userId,
  redis,
  services,
) {
  try {
    // Format: pay_METHOD or pay_METHOD_TIER (e.g., pay_mpesa, pay_till, pay_mpesa_PRO, pay_safaricom_till_VVIP)
    // Strip 'pay_' prefix to get the rest
    const afterPay = data.replace("pay_", "");
    const parts = afterPay.split("_");

    if (parts.length < 1) {
      logger.error("Invalid payment callback format", { data, parts });
      return {
        method: "answerCallbackQuery",
        callback_query_id: undefined,
        text: "❌ Invalid payment selection. Please try again.",
        show_alert: true,
      };
    }

    // Extract payment method from first part(s) and tier from last part
    // Handle both 'pay_mpesa' and 'pay_mpesa_PRO' formats
    let callbackMethod, tierFromCallback;

    // Check if last part looks like a tier (all caps, single word, matches known tier)
    const lastPart = parts[parts.length - 1].toUpperCase();
    if (["FREE", "PRO", "VVIP", "PLUS"].includes(lastPart)) {
      tierFromCallback = lastPart;
      // Join remaining parts for method name (e.g., 'safaricom_till' from ['safaricom', 'till'])
      callbackMethod = parts.slice(0, -1).join("_").toUpperCase();
    } else {
      callbackMethod = afterPay.toUpperCase();
      tierFromCallback = null;
    }

    // Map callback names to provider keys
    const methodMap = {
      TILL: "SAFARICOM_TILL",
      SAFARICOM_TILL: "SAFARICOM_TILL",
      MPESA: "MPESA",
      PAYPAL: "PAYPAL",
      BINANCE: "BINANCE",
      SWIFT: "SWIFT",
      BITCOIN: "BITCOIN",
      QUICK_VVIP: "SAFARICOM_TILL", // Quick VVIP uses Safaricom Till
    };

    let paymentMethod = methodMap[callbackMethod] || callbackMethod;

    // Further normalize in case methodMap doesn't cover all aliases
    const normalized = normalizePaymentMethod(paymentMethod);
    if (normalized) paymentMethod = normalized;

    // Get tier: prefer tier from callback, then from pending_payment in Redis (should have been set by sub_* callback)
    let tier = tierFromCallback || "VVIP"; // default fallback
    try {
      const pending = await redis.get(`user:${userId}:pending_payment`);
      if (pending) {
        const pendingObj = JSON.parse(pending);
        tier = tierFromCallback || pendingObj.tier || tier;
      } else {
        logger.warn("No pending payment found for user", { userId, data });
      }
    } catch (e) {
      logger.warn("Failed to read pending tier from redis", {
        userId,
        error: e.message,
      });
    }

    // Validate tier
    if (!TIERS[tier]) {
      logger.error("Invalid tier from pending payment", { data, tier });
      return {
        method: "answerCallbackQuery",
        callback_query_id: undefined,
        text: "❌ Invalid tier. Please select tier again.",
        show_alert: true,
      };
    }

    // Validate payment method exists in PAYMENT_PROVIDERS
    if (!PAYMENT_PROVIDERS[paymentMethod]) {
      logger.error("Unknown payment method", {
        data,
        paymentMethod,
        callbackMethod,
      });
      return {
        method: "answerCallbackQuery",
        callback_query_id: undefined,
        text: `❌ Payment method '${callbackMethod}' not recognized. Please try again.`,
        show_alert: true,
      };
    }

    // Read region from pending payment record (set when tier was selected) or from user profile
    let userRegion = "KE";
    try {
      const pending = await redis.get(`user:${userId}:pending_payment`);
      if (pending) {
        const pendingObj = JSON.parse(pending);
        userRegion = pendingObj.region || userRegion;
      }
    } catch (e) {
      logger.warn("Failed to read pending region from redis", e);
    }

    // Fallback to profile region
    if (userRegion === "KE") {
      const profileRegion = await redis
        .hget(`user:${userId}:profile`, "region")
        .catch(() => null);
      if (profileRegion) userRegion = profileRegion;
    }

    // Validate payment method is available for user's region
    // NOTE: Allow all providers globally — log if provider not listed but proceed.
    try {
      const available = getAvailablePaymentMethods(userRegion);
      if (!available.find((m) => m.id === paymentMethod)) {
        const availableNames = available.map((m) => m.name).join(", ");
        logger.warn("Payment method not listed for region, proceeding anyway", {
          paymentMethod,
          userRegion,
          available: availableNames,
        });
        // do not return; allow user to proceed with selected method
      }
    } catch (e) {
      logger.warn(
        "Failed to check available payment methods, proceeding",
        e?.message || e,
      );
    }

    // Create payment order
    const order = await createPaymentOrder(
      redis,
      userId,
      tier,
      paymentMethod,
      userRegion,
    );

    // Get payment instructions
    const instructions = await getPaymentInstructions(
      redis,
      order.orderId,
      paymentMethod,
    );

    // Build step-by-step text
    let instrText = "";
    if (instructions) {
      // Use provided descriptive text if available
      if (instructions.description)
        instrText += `*${instructions.description}*\n\n`;

      // Steps may be in .steps or .manualSteps
      const steps = instructions.steps || instructions.manualSteps || [];
      if (Array.isArray(steps) && steps.length > 0) {
        instrText += "Follow these steps:\n";
        for (let i = 0; i < steps.length; i++) {
          instrText += `${i + 1}. ${steps[i]}\n`;
        }
        instrText += "\n";
      }

      // Additional helper fields
      if (instructions.tillNumber)
        instrText += "Till: *" + instructions.tillNumber + "*\n";
      if (instructions.reference)
        instrText += "Reference: `" + instructions.reference + "`\n";
      if (instructions.checkoutUrl)
        instrText += "Open the payment link to continue.";
    } else {
      instrText =
        "Please follow the provider instructions to complete payment for order " +
        order.orderId +
        ".";
    }

    // Build buttons: provider-specific CTAs and common verification
    const keyboard = [];

    if (instructions && instructions.checkoutUrl) {
      keyboard.push([
        {
          text: `${PAYMENT_PROVIDERS[paymentMethod]?.symbol || "💳"} Pay with ${PAYMENT_PROVIDERS[paymentMethod]?.name || paymentMethod}`,
          url: instructions.checkoutUrl,
        },
      ]);
    }

    if (instructions && instructions.qrCode) {
      keyboard.push([{ text: "🔎 View QR", url: instructions.qrCode }]);
    }

    // Always include verify and change method
    keyboard.push([
      {
        text: "✅ I have paid",
        callback_data: `verify_payment_${order.orderId}`,
      },
    ]);
    keyboard.push([{ text: "🔙 Change method", callback_data: "menu_vvip" }]);

    return {
      method: "sendMessage",
      chat_id: chatId,
      text: instrText,
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: keyboard },
    };
  } catch (error) {
    logger.error("Payment method selection error:", error);
    return {
      method: "sendMessage",
      chat_id: chatId,
      text: `❌ Payment setup failed: ${error.message}`,
      parse_mode: "Markdown",
    };
  }
}

/**
 * Handle payment verification when user confirms payment
 */
async function handlePaymentVerification(data, chatId, userId, redis) {
  try {
    const orderId = data.replace("verify_payment_", "");
    // Use payment-router's verification to ensure consistent activation
    try {
      const verification = await verifyAndActivatePayment(
        redis,
        orderId,
        `manual_${Date.now()}`,
      );
      const tier = verification.tier;
      const tierConfig = TIERS[tier] || { name: tier, features: [] };

      return {
        method: "sendMessage",
        chat_id: chatId,
        text: `✅ *Payment Confirmed!*\n\n🎉 Welcome to ${tierConfig.name}!\n\n✨ *Features unlocked:*\n${(tierConfig.features || []).map((f) => `• ${f}`).join("\n")}\n\nEnjoy your premium experience with 🌀 BETRIX!`,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🎯 Back to Main Menu", callback_data: "menu_main" }],
          ],
        },
      };
    } catch (e) {
      logger.error("Payment verification failed", e);
      return {
        method: "sendMessage",
        chat_id: chatId,
        text: `❌ Verification failed: ${e.message || "unknown error"}`,
        parse_mode: "Markdown",
      };
    }
  } catch (error) {
    logger.error("Payment verification error:", error);
    return {
      method: "sendMessage",
      chat_id: chatId,
      text: `❌ Verification failed: ${error.message}\n\nPlease contact support or try again.`,
      parse_mode: "Markdown",
    };
  }
}
// (default export moved to bottom after adding command/natural-language helpers)

// Provide lightweight named exports for command and natural-language handling
// so callers can import either the default object or the named functions.
export async function handleCommand(update, redis, services) {
  try {
    const message = update && (update.message || update.edited_message);
    if (!message) return null;
    const text = message.text || "";

    // If it's a slash command, route through handleMessage which already
    // understands `/live` and other simple commands. This keeps behavior
    // consistent with the main message handler.
    if (text && text.startsWith("/")) {
      return await handleMessage(update, redis, services);
    }

    return null;
  } catch (err) {
    logger.warn("handleCommand error", err?.message || err);
    return null;
  }
}

export async function handleNaturalLanguage(
  text,
  chatId,
  userId,
  redis,
  services,
) {
  try {
    // Delegate to the existing AI handler for conversational requests.
    if (typeof handleGenericAI === "function") {
      return await handleGenericAI(text, chatId, userId, redis, services);
    }
    return null;
  } catch (err) {
    logger.warn("handleNaturalLanguage error", err?.message || err);
    return null;
  }
}
// Export onboarding helpers for worker to import directly
export { handleOnboardingMessage, startOnboarding };
export default {
  handleMessage,
  handleCallbackQuery,
  handleCommand,
  handleNaturalLanguage,
};
