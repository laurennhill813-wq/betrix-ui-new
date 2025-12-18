import { GeminiService } from "../services/gemini.js";
import { LocalAIService } from "../services/local-ai.js";
import { AzureAIService } from "../services/azure-ai.js";
import {
  getToneInstructions,
  inferToneFromEvent,
  BETRIX_TONES,
} from "./personality.js";

const gemini = new GeminiService(process.env.GEMINI_API_KEY || null);
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

async function tryGemini(prompt) {
  try {
    if (!gemini || !gemini.enabled) return null;
    const out = await gemini.chat(prompt, { expect: "short" });
    if (out && String(out).trim()) return String(out).trim();
    return null;
  } catch (e) {
    try {
      console.warn("Gemini summarizer failed", e?.message || e);
    } catch (_) {}
    return null;
  }
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
 * summarizeEventForTelegram(sportEvent, tone = 'auto')
 * tone: 'auto' | 'hype' | 'pro' | 'hybrid'
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

  const effectiveTone = tone === "auto" ? inferToneFromEvent(sportEvent) : tone;
  const toneBlock = getToneInstructions(effectiveTone);

  const prompt = [
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

  // Try provider chain: Azure -> Gemini -> Local
  const azureOut = await tryAzure(prompt);
  if (azureOut) return { caption: azureOut, tone: effectiveTone };

  const gemOut = await tryGemini(prompt);
  if (gemOut) return { caption: gemOut, tone: effectiveTone };

  const locOut = await tryLocal(prompt);
  if (locOut) return { caption: locOut, tone: effectiveTone };

  // Fallback deterministic caption
  const fallback = `**${home || "Home"} vs ${away || "Away"}**\n${status || ""} ${time || ""}\n#${(league || "Sports").replace(/\s+/g, "")} #BETRIXLive`;
  return { caption: fallback, tone: effectiveTone };
}

export default { summarizeEventForTelegram };
