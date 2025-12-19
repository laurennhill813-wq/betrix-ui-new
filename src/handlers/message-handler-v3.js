/**
 * BETRIX Natural Language Message Handler v3
 * Routes user messages to commands/states based on intent
 * Handles signup profile collection, fallbacks, and context awareness
 */

import { Logger } from "../utils/logger.js";
const logger = new Logger("MessageHandler");
import {
  getUserState,
  setUserState,
  getStateData,
  setStateData,
  STATES,
  isOnboardingState,
  isPaymentPendingState,
} from "../lib/state-machine.js";

import {
  createUserProfile,
  getUserProfile,
  updateUserProfile,
} from "./data-models.js";

// ============================================================================
// INTENT CLASSIFICATION
// ============================================================================

const IntentPatterns = {
  // Feature access - MOST SPECIFIC PATTERNS FIRST (multi-word phrases)
  odds: /\b(show\s+odds|today.*match|fixture|live\s+odds|what.*play|game.*list|match.*list|upcoming.*match|next.*game)\b/i,
  analyze:
    /\b(analyz|explain|breakdown|what.*happen|predict|what.*occur|why.*win|strategy)\w*/i,
  news: /\b(news|update|latest|what.*new|injury|lineup|transfer|alert|announce)\b/i,
  help: /\b(help|faq|how.*work|support|contact|troubleshoot|how.*do|guide|manual)\b/i,
  payment:
    /\b(pay|payment|subscribe|vvip|upgrade|premium|checkout|buy|cost|price|fee)\b/i,
  sites:
    /\b(betting\s+site|bookmaker|bet.*site|where.*bet|open.*site|betting.*app|place.*bet.*site)\b/i,
  menu: /\b(menu|main|home|dashboard|back|start|main.*menu)\b/i,

  // Betting actions
  bet: /\b(bet|place.*bet|add.*slip|stake|wager|gambling)\b/i,
  quick_bet: /\b(quick|rapid|fast|instant|one.*click)\b/i,

  // Signup flow (specific phrases only)
  signup:
    /^(sign\s*up|signup|join|register|create.*account|i.*want.*join|lets.*start|make.*account|create.*profile)/i,

  // Catch-all for simple names LAST (strict pattern: ONLY letters and spaces, 2-50 chars, no keywords)
  name_input: /^[a-z\s]{2,50}$/i,
};

/**
 * Classify user message intent
 */
export function classifyIntent(text) {
  const msg = text.trim().toLowerCase();

  for (const [intent, pattern] of Object.entries(IntentPatterns)) {
    if (pattern.test(msg)) {
      return intent;
    }
  }

  return "unknown";
}

/**
 * Extract parameters from message
 * E.g., "/odds football" → { command: 'odds', params: ['football'] }
 */
function parseMessage(text) {
  const trimmed = text.trim();

  // Handle commands: /command param1 param2
  if (trimmed.startsWith("/")) {
    const parts = trimmed.slice(1).split(/\s+/);
    return {
      command: parts[0].toLowerCase(),
      params: parts.slice(1),
    };
  }

  // Natural language: classify intent and extract entities
  return {
    intent: classifyIntent(trimmed),
    text: trimmed,
  };
}

// ============================================================================
// MESSAGE HANDLER
// ============================================================================

export async function handleMessage(message, userId, chatId, redis, services) {
  logger.info("handleMessage", {
    userId,
    chatId,
    text: message.substring(0, 50),
  });

  try {
    // Parse message
    const parsed = parseMessage(message);

    // Determine user lifecycle state
    const currentState = (await getUserState(redis, userId)) || STATES.NEW;
    const stateData = (await getStateData(redis, userId)) || {};

      // If user is in onboarding or awaiting payment, delegate to state-specific handlers.
      if (isOnboardingState(currentState) || isPaymentPendingState(currentState)) {
      return await handleStateSpecificInput(
        currentState,
        message,
        userId,
        chatId,
        redis,
        services,
        stateData,
      );
    }

    // Handle explicit commands
    if (parsed.command) {
      // Protect payment flows: restrict disruptive commands while payment pending
      if (isPaymentPendingState(currentState)) {
        const allowedDuringPayment = new Set(["help", "pay", "status", "start", "menu"]);
        if (!allowedDuringPayment.has(parsed.command.toLowerCase())) {
          return {
            chat_id: chatId,
            text: "🔒 You have a pending payment. Please complete it first or type /pay for status.",
            parse_mode: "Markdown",
          };
        }
      }

      const { handleCommand } = await import("./commands-v3.js");
      return await handleCommand(
        parsed.command,
        parsed.params,
        userId,
        chatId,
        redis,
        services,
      );
    }

    // Handle intent-based routing or natural language input
    if (parsed.intent && parsed.intent !== "unknown") {
      // If user is ACTIVE or VVIP route to AI for natural language
      if (currentState === STATES.ACTIVE || currentState === STATES.VVIP) {
        const mod = await import("./telegram-handler-v2.js");
        if (typeof mod.handleGenericAI === "function") {
          return await mod.handleGenericAI(parsed.text || message, chatId, userId, redis, services);
        }
      }

      return await handleIntent(
        parsed.intent,
        parsed.text,
        userId,
        chatId,
        redis,
        services,
      );
    }

    // Non-command free text: route based on lifecycle state
    if (currentState === STATES.ACTIVE || currentState === STATES.VVIP) {
      const mod = await import("./telegram-handler-v2.js");
      if (typeof mod.handleGenericAI === "function") {
        return await mod.handleGenericAI(message, chatId, userId, redis, services);
      }
    }

    // If not active, route to onboarding/payment prompts
    const onboardModule = await import("./telegram-handler-v2.js");
    if (typeof onboardModule.handleOnboardingMessage === "function") {
      // We call the onboarding handler to process free-form onboarding replies
      return await onboardModule.handleOnboardingMessage(message, chatId, userId, redis, services);
    }

    // Fallback: show help
    return {
      chat_id: chatId,
      text: `❓ I didn't quite understand that.\n\nTry:\n• /menu for main options\n• /odds to see today's matches\n• /help for FAQs`,
      parse_mode: "Markdown",
    };
  } catch (err) {
    logger.error("handleMessage error", err);
    return {
      chat_id: chatId,
      text: "❌ Error processing message. Try again.",
      parse_mode: "Markdown",
    };
  }
}

// ============================================================================
// STATE-SPECIFIC INPUT HANDLERS
// ============================================================================

async function handleStateSpecificInput(
  state,
  message,
  userId,
  chatId,
  redis,
  services,
  stateData,
) {
  logger.info("handleStateSpecificInput", { state, userId });
  // Onboarding flow: use stateData.step to route to signup steps
  if (isOnboardingState(state)) {
    const step = (stateData && stateData.step) || "name";
    if (step === "name") return await handleSignupName(message, userId, chatId, redis);
    if (step === "country") return await handleSignupCountry(message, userId, chatId, redis);
    if (step === "age") return await handleSignupAge(message, userId, chatId, redis);
    // Unknown step: reset to name
    await setStateData(redis, userId, { step: "name" }, 3600);
    await setUserState(redis, userId, STATES.ONBOARDING, 3600);
    return {
      chat_id: chatId,
      text: "📝 Let's continue onboarding. What's your full name?",
      parse_mode: "Markdown",
    };
  }

  if (isPaymentPendingState(state)) {
    return {
      chat_id: chatId,
      text: "⏳ Your payment is still processing. Please wait or check /pay for status.",
      parse_mode: "Markdown",
    };
  }

  // Fallback: mark idle and re-run handler
  await setUserState(redis, userId, STATES.IDLE);
  return await handleMessage(message, userId, chatId, redis, services);
}

/**
 * Handle signup name collection
 */
async function handleSignupName(message, userId, chatId, redis) {
  const name = message.trim();

  if (!name || name.length < 2) {
    return {
      chat_id: chatId,
      text: "📝 Please provide a valid name (at least 2 characters).",
      parse_mode: "Markdown",
    };
  }

  // Save name and move to country step inside ONBOARDING
  await setStateData(redis, userId, { name, step: "country" }, 3600);
  await setUserState(redis, userId, STATES.ONBOARDING, 3600);

  return {
    chat_id: chatId,
    text: `✅ Nice to meet you, *${name}*!\n\n🌍 Which country are you in?\n\nExamples: Kenya, Uganda, Tanzania, or use country code (KE, UG, TZ)`,
    parse_mode: "Markdown",
  };
}

/**
 * Handle signup country collection
 */
async function handleSignupCountry(message, userId, chatId, redis) {
  const country = message.trim().toUpperCase();
  const validCountries = ["KE", "UG", "TZ", "KENYA", "UGANDA", "TANZANIA"];

  if (!validCountries.includes(country)) {
    return {
      chat_id: chatId,
      text: "🌍 Please enter a valid country (KE, UG, TZ) or full name (Kenya, Uganda, Tanzania).",
      parse_mode: "Markdown",
    };
  }

  // Normalize country code
  const countryCode =
    country === "KENYA"
      ? "KE"
      : country === "UGANDA"
        ? "UG"
        : country === "TANZANIA"
          ? "TZ"
          : country;

  // Save country and move to age step inside ONBOARDING
  const current = await getStateData(redis, userId);
  await setStateData(
    redis,
    userId,
    { ...current, country: countryCode, step: "age" },
    3600,
  );
  await setUserState(redis, userId, STATES.ONBOARDING, 3600);

  return {
    chat_id: chatId,
    text: `✅ Got it, *${countryCode}*!\n\n🎂 How old are you? (Enter a number, e.g., 25)`,
    parse_mode: "Markdown",
  };
}

/**
 * Handle signup age collection
 */
async function handleSignupAge(message, userId, chatId, redis) {
  const age = parseInt(message.trim(), 10);

  if (isNaN(age) || age < 18 || age > 120) {
    return {
      chat_id: chatId,
      text: "🎂 Please enter a valid age (18-120).",
      parse_mode: "Markdown",
    };
  }

  // Complete signup profile creation
  const current = await getStateData(redis, userId);
  const profileData = {
    name: current.name,
    country: current.country,
    age,
    signup_paid: false,
  };

  await createUserProfile(redis, userId, profileData);
  // Move user into PAYMENT_PENDING so they see payment menu next
  await setUserState(redis, userId, STATES.PAYMENT_PENDING);
  await redis.del(`user:${userId}:state_data`);

  // Show payment prompt
  const text = `✨ *Profile Complete!*\n\nHello, *${profileData.name}*! Welcome to BETRIX.\n\n💰 To unlock all features, pay a one-time signup fee of *150 KES* or *$1 USD*.\n\nReady to pay?`;

  return {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "✅ Pay Now", callback_data: "pay_signup_select" }],
        [{ text: "⏭️ Later", callback_data: "menu_main" }],
      ],
    },
  };
}

// ============================================================================
// INTENT HANDLERS
// ============================================================================

async function handleIntent(intent, text, userId, chatId, redis, services) {
  logger.info("handleIntent", { intent, userId });

  switch (intent) {
    case "signup":
      const { handleSignup } = await import("./commands-v3.js");
      return await handleSignup(userId, chatId, redis);

    case "odds":
      const { handleOdds } = await import("./commands-v3.js");
      return await handleOdds(userId, chatId, redis, services);

    case "analyze":
      const { handleAnalyze } = await import("./commands-v3.js");
      return await handleAnalyze(userId, chatId, redis, services);

    case "news":
      const { handleNews } = await import("./commands-v3.js");
      return await handleNews(userId, chatId, redis, services);

    case "help":
      const { handleHelp } = await import("./commands-v3.js");
      return await handleHelp(chatId);

    case "payment":
      const { handlePay } = await import("./commands-v3.js");
      return await handlePay(userId, chatId, redis);

    case "sites":
      const { handleBettingSitesCallback } = await import("./betting-sites.js");
      return await handleBettingSitesCallback(
        "sites_main",
        chatId,
        userId,
        redis,
      );

    case "menu":
      const { handleMenu } = await import("./commands-v3.js");
      return await handleMenu(userId, chatId, redis);

    default:
      return {
        chat_id: chatId,
        text: `❓ Not sure what you mean by "*${text}*".\n\nTry:\n• Show odds\n• Analyze match\n• Latest news\n• Help`,
        parse_mode: "Markdown",
      };
  }
}

export {
  handleStateSpecificInput,
  handleSignupName,
  handleSignupCountry,
  handleSignupAge,
  handleIntent,
  parseMessage,
};
