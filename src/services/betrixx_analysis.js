import { groqChat } from './llm_groq.js';
import persona from '../ai/persona.js';

// Allow larger analyses by default
const DEFAULT_MAX_TOKENS = 1800;

export async function analyseFixtureWithBetrixx(fixture, opts = {}) {
  // Use a focused analysis system prompt but augment it with an instruction
  // to expand each section in detail for a full match dossier. Keep the
  // persona voice but include more depth and structured subpoints.
  const systemPrompt = persona.getSystemPrompt({ includeContext: { mode: 'analysis', verbosity: 'full' } });

  const schemaExample = JSON.stringify({
    summary: 'short human-friendly summary',
    predictions: [
      {
        market: 'Match Winner|Both Teams To Score|Over/Under|Correct Score|Other',
        selection: 'Home|Away|Draw|Yes|No|Over X|Under X',
        probability: 0.0,
        confidence: 'low|medium|high',
        suggested_stake_pct: 0,
        rationale: 'one or two sentence rationale'
      }
    ],
    preferredBets: [
      { option: 'Home Win - Moneyline', odds: "1.95 or '-' if not available", confidence: 0.0, suggested_stake_pct: 0, rationale: 'short rationale' }
    ],
    notes: 'optional short notes'
  }, null, 2);

  const userPrompt = [
    'You are BETRIXX — a concise, professional sports analyst. Given the fixture JSON below, produce two outputs in order:',
    '1) Emit a compact JSON object ONLY (no extra commentary) that follows this schema:',
    schemaExample,
    '2) After the JSON, you may append a 2-3 line plain-text human summary separated by a single blank line. Keep that short and Telegram-friendly (one light emoji allowed).',
    'Requirements:',
    '- Use the MATCH_DATA to inform probabilities and rationales. If specific data (lineups, injuries, recent form) is missing, state "data not available" for that point and do NOT invent details.',
    '- Keep the JSON compact and machine-parseable. Limit arrays to sensible sizes (3-6 items).',
    "- For numeric fields use real numbers (probability 0-1, confidence as number 0-1 inside preferredBets; predictions.confidence remains a descriptive string).",
    "- Include at least one preferredBets entry when a clear edge exists; include odds only if present in MATCH_DATA — otherwise use '-'.",
    "- Do NOT provide gambling instructions; present suggestions as informational only.",
    'Now analyze the match and return the JSON followed by the short text.',
    'MATCH_DATA:',
    JSON.stringify(fixture, null, 2)
  ].join('\n\n');

  const model = opts.model || process.env.GROQ_MODEL;
  // Lower temperature for focused, factual analysis
  const temperature = typeof opts.temperature === 'number' ? opts.temperature : 0.3;

  const resp = await groqChat({ system: systemPrompt, user: userPrompt, temperature, max_tokens: opts.max_tokens || DEFAULT_MAX_TOKENS, model });
  return resp;
}

export default { analyseFixtureWithBetrixx };
