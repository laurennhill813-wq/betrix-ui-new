import { Logger } from '../utils/logger.js';
import { GeminiService } from '../services/gemini.js';
import { LocalAIService } from '../services/local-ai.js';

const logger = new Logger('ai:insightsEngine');
const gemini = new GeminiService(process.env.GEMINI_API_KEY || null);
const localAI = new LocalAIService();

async function tryGemini(prompt, context = {}) {
  try {
    if (!gemini || !gemini.enabled) return null;
    const out = await gemini.chat(prompt, context);
    if (out && String(out).trim()) return String(out).trim();
    return null;
  } catch (e) {
    logger.warn('Gemini call failed', e?.message || String(e));
    return null;
  }
}

async function tryLocal(prompt, context = {}) {
  try {
    const out = await localAI.chat(prompt, context);
    if (out && String(out).trim()) return String(out).trim();
    return null;
  } catch (e) {
    logger.warn('LocalAI call failed', e?.message || String(e));
    return null;
  }
}

export async function generateInsight(event = {}, match = {}) {
  try {
    // Compose compact context
    const compact = {
      home: match.home || match.homeName || match.homeTeam || '',
      away: match.away || match.awayName || match.awayTeam || '',
      score: match.score || match.result || '',
      minute: event.minute || '',
      type: event.type || event.event || '',
      player: event.player || ''
    };
    const prompt = `Provide a single short tactical insight (1 sentence) about this event and match. Context: ${JSON.stringify(compact)}`;
    const g = await tryGemini(prompt, { expect: 'insight' });
    if (g) return g;
    const l = await tryLocal(prompt, { expect: 'insight' });
    if (l) return l;

    // Fallback: simple deterministic insight
    if (event.type === 'goal') {
      const scorer = event.player || 'Player';
      const minute = event.minute ? `${event.minute}’` : 'now';
      return `${scorer} scored at ${minute} — momentum to ${compact.home || compact.away || 'team'}.`;
    }
    if (event.type === 'red_card' || event.card === 'red') {
      return `Red card issued — numerical disadvantage will shape tactics.`;
    }
    return 'No special insights for this event.';
  } catch (err) {
    logger.warn(`generateInsight failed: ${err?.message || String(err)}`);
    return 'Insight unavailable.';
  }
}

export default { generateInsight };
