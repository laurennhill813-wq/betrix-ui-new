// GeminiService removed
import { LocalAIService } from "../services/local-ai.js";
import { AzureAIService } from "../services/azure-ai.js";
import {
  getToneInstructions,
  inferToneFromEvent,
  BETRIX_TONES,
} from "./personality.js";

// GeminiService removed
const localAI = new LocalAIService();
const azure = new AzureAIService(
  process.env.AZURE_AI_ENDPOINT || process.env.AZURE_ENDPOINT || null,
  process.env.AZURE_AI_KEY || process.env.AZURE_KEY || null,
  process.env.AZURE_AI_DEPLOYMENT || process.env.AZURE_DEPLOYMENT || null,
  process.env.AZURE_API_VERSION || "2023-05-15",
);

async function tryAzure(prompt) {
  try {
    if (!azure || !azure.enabled) return null;
    const out = await azure.chat(prompt, { max_tokens: 200, temperature: 0.6 });
    if (out && String(out).trim()) return String(out).trim();
    return null;
  } catch (e) {
    try {
      console.warn("Azure summarizer failed", e?.message || e);
    } catch (_) {}
    return null;
  }
}

// Gemini removed
async function tryGemini(prompt) {
  return null;
}

async function tryLocal(prompt) {
  try {
    const out = await localAI.chat(prompt, { expect: "short" });
    if (out && String(out).trim()) return String(out).trim();
    return null;
  } catch (e) {
    try {
      console.warn("LocalAI summarizer failed", e?.message || e);
    } catch (_) {}
    return null;
  }
}

/**
 * summarizeEventForTelegram(sportEvent, tone = 'auto' | 'conversational')
 * tone modes: 'auto' | 'conversational' | 'hype' | 'pro' | 'hybrid'
 * 'conversational' generates longer, more casual, natural multi-line captions like a real person posting
 */
export async function summarizeEventForTelegram(
  sportEvent = {},
  tone = "auto",
) {
  const {
    sport,
    league,
    home,
    away,
    status,
    score,
    time,
    odds,
    importance,
    context = {},
  } = sportEvent || {};

  // Determine effective tone and whether conversational mode
  let effectiveTone = tone === "auto" ? inferToneFromEvent(sportEvent) : tone;
  const isConversational = effectiveTone === "conversational";
  if (isConversational) effectiveTone = inferToneFromEvent(sportEvent);

  const toneBlock = getToneInstructions(effectiveTone);

  // Use different prompt for conversational vs normal captions
  let prompt;
  if (isConversational) {
    prompt = [
      "You are BETRIX — a casual sports enthusiast and social media poster.",
      "",
      "Your posting style:",
      "- Sound like a real person, not a robot",
      "- Use conversational language and natural flow",
      "- Share genuine takes and reactions",
      "- Mix facts with opinion/emotion",
      "- Feel free to be witty, sarcastic, or hype — just authentic",
      "- Use line breaks for readability",
      "",
      "Task:",
      "- Write a Telegram post (4-8 lines max) that feels like something a real sports fan would post",
      "- Lead with hot take or interesting angle",
      "- Include relevant facts",
      "- End with call to action or open question",
      "- Use hashtags naturally (2-5 relevant ones)",
      "- Can use 1-2 relevant emojis if it fits the vibe ⚽🔥🎯",
      "- No betting advice or promotions",
      "",
      "Event context:",
      JSON.stringify(
        {
          sport,
          league,
          home,
          away,
          status,
          score,
          time,
          importance,
          context,
        },
        null,
        2,
      ),
      "",
      "Return ONLY the post text — no preamble.",
    ].join("\n");
  } else {
    prompt = [
      "You are BETRIX — an AI sports narrator and caption writer.",
      "",
      "Core identity:",
      "- One unified personality across all sports.",
      "- Clear like a journalist.",
      "- Energetic like a fan.",
      "- Minimalist in wording (no clutter).",
      "- Narrative-driven: always hint at the story behind the numbers.",
      "",
      "Tone mode for this caption:",
      toneBlock,
      "",
      "Task:",
      "- Write a short Telegram caption about the following event.",
      "- Max 3 short lines.",
      "- Line 1: bold match/topic (use ** around text).",
      "- Line 2: narrative summary (momentum, stakes, story).",
      "- Line 3: 2–4 concise tags (e.g. #PremierLeague #NBA #BETRIXLive).",
      "- No emojis.",
      "- No betting tips (describe context only, never say what to bet).",
      "",
      "Event data (JSON):",
      JSON.stringify(
        {
          sport,
          league,
          home,
          away,
          status,
          score,
          time,
          odds,
          importance,
          context,
        },
        null,
        2,
      ),
      "",
      "Return ONLY the caption text, no explanation.",
    ].join("\n");
  }

  // Try provider chain: LocalAI (no rate limits) -> Azure -> Gemini
  const locOut = await tryLocal(prompt);
  if (locOut) return { caption: locOut, tone: effectiveTone };

  const azureOut = await tryAzure(prompt);
  if (azureOut) return { caption: azureOut, tone: effectiveTone };

  // Gemini removed
  // const gemOut = await tryGemini(prompt);
  // if (gemOut) return { caption: gemOut, tone: effectiveTone };

  // Fallback deterministic caption
  let fallback;
  if (isConversational) {
    fallback = `Upcoming match incoming 🔥\n\n**${home || "Home"} vs ${away || "Away"}**\n\n${status || "Scheduled"} • ${time || ""}\n\nWho's taking the W? 👀\n\n#${(league || "Sports").replace(/\s+/g, "")} #BETRIXLive`;
  } else {
    fallback = `**${home || "Home"} vs ${away || "Away"}**\n${status || ""} ${time || ""}\n#${(league || "Sports").replace(/\s+/g, "")} #BETRIXLive`;
  }
  return { caption: fallback, tone: effectiveTone };
}

export default { summarizeEventForTelegram };
