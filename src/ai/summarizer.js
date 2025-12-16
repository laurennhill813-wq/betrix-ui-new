import { GeminiService } from '../services/gemini.js';
import { LocalAIService } from '../services/local-ai.js';
import { AzureAIService } from '../services/azure-ai.js';

const gemini = new GeminiService(process.env.GEMINI_API_KEY || null);
const localAI = new LocalAIService();
const azure = new AzureAIService(
  process.env.AZURE_AI_ENDPOINT || process.env.AZURE_ENDPOINT || null,
  process.env.AZURE_AI_KEY || process.env.AZURE_KEY || null,
  process.env.AZURE_AI_DEPLOYMENT || process.env.AZURE_DEPLOYMENT || null,
  process.env.AZURE_API_VERSION || '2023-05-15'
);

async function tryAzure(prompt) {
  try {
    if (!azure || !azure.enabled) return null;
    const out = await azure.chat(prompt, { max_tokens: 200, temperature: 0.6 });
    if (out && String(out).trim()) return String(out).trim();
    return null;
  } catch (e) {
    try { console.warn('Azure summarizer failed', e?.message || e); } catch(_){}
    return null;
  }
}

async function tryGemini(prompt) {
  try {
    if (!gemini || !gemini.enabled) return null;
    const out = await gemini.chat(prompt, { expect: 'short' });
    if (out && String(out).trim()) return String(out).trim();
    return null;
  } catch (e) {
    try { console.warn('Gemini summarizer failed', e?.message || e); } catch(_){}
    return null;
  }
}

async function tryLocal(prompt) {
  try {
    const out = await localAI.chat(prompt, { expect: 'short' });
    if (out && String(out).trim()) return String(out).trim();
    return null;
  } catch (e) {
    try { console.warn('LocalAI summarizer failed', e?.message || e); } catch(_){}
    return null;
  }
}

export async function summarizeEventForTelegram(sportEvent = {}) {
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

  const prompt = [
    'You are BETRIX — an AI sports analyst with a unified voice:',
    '- Clear and factual like a journalist.',
    '- Energetic and hype-driven like a fan.',
    '- Minimalist and punchy in delivery.',
    '- Narrative-driven with context and momentum.',
    '- Betting-aware, but NEVER giving betting advice, only context.',
    '',
    'Write a short Telegram post about the following event.',
    'Constraints:',
    '- Max 3 short lines.',
    "- First line: bold match or topic (use **).",
    '- Second line: narrative summary (momentum, stakes, story).',
    "- Third line: 2–4 tags like #PremierLeague #NBA #BETRIXLive.",
    '- No emojis.',
    '',
    'Event data (JSON):',
    JSON.stringify({ sport, league, home, away, status, score, time, odds, importance, context }, null, 2),
    '',
    'Return ONLY the caption text, no explanation.',
  ].join('\n');

  // Try provider chain: Azure -> Gemini -> Local
  const azureOut = await tryAzure(prompt);
  if (azureOut) return { caption: azureOut };

  const gemOut = await tryGemini(prompt);
  if (gemOut) return { caption: gemOut };

  const locOut = await tryLocal(prompt);
  if (locOut) return { caption: locOut };

  // Fallback deterministic caption
  const fallback = `**${home || 'Home'} vs ${away || 'Away'}**\n${status || ''} ${time || ''}\n#${(league || 'Sports').replace(/\s+/g,'')} #BETRIXLive`;
  return { caption: fallback };
}

export default { summarizeEventForTelegram };
