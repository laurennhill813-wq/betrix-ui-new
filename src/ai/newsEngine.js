import { Logger } from "../utils/logger.js";
// GeminiService removed
import { LocalAIService } from "../services/local-ai.js";

const logger = new Logger("ai:newsEngine");

// GeminiService removed
const localAI = new LocalAIService();

// Gemini removed
async function tryGemini(prompt, context = {}) {
  return null;
}

async function tryLocal(prompt, context = {}) {
  try {
    const out = await localAI.chat(prompt, context);
    if (out && String(out).trim()) return String(out).trim();
    return null;
  } catch (e) {
    logger.warn("LocalAI call failed", e?.message || String(e));
    return null;
  }
}

export async function generateHeadline(event = {}, match = {}) {
  // Compose a compact prompt to minimize tokens
  const team = event.team || match.home || match.away || "";
  const minute = event.minute ? `${event.minute}’` : "";
  const type = event.type || event.event || "update";
  const short = `${team} ${type} ${minute}`.trim();

  const prompt = `Write a short, punchy news headline (max 6 words) for this sports update: ${short}`;
  // Gemini removed
  // const g = await tryGemini(prompt, { expect: "headline" });
  // if (g) return g;
  const l = await tryLocal(prompt);
  if (l) return l;

  // Fallback deterministic
  const fallback =
    `${team || "Team"} ${type}${minute ? ` (${minute})` : ""}`.trim();
  return fallback || "Match update";
}

export async function summarizeEvent(event = {}, match = {}) {
  const context = { event, match };
  const details = event.detail || event.description || "";
  const prompt = `Write a concise (1-2 sentences) summary of this sports event for a social post. Event: ${JSON.stringify(event)} Match: ${JSON.stringify(match)} Details: ${details}`;
  const g = await tryGemini(prompt, { expect: "short" });
  if (g) return g;
  const l = await tryLocal(prompt, { expect: "short" });
  if (l) return l;

  // last-resort deterministic text
  const head =
    `${event.team || match.home || match.away || "Team"} ${event.type || event.event || ""}`.trim();
  return `${head}: ${details}`.trim();
}

export default { generateHeadline, summarizeEvent };
