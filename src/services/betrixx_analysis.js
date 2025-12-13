import { groqChat } from './llm_groq.js';
import persona from '../ai/persona.js';

// Allow larger analyses by default
const DEFAULT_MAX_TOKENS = 1800;

export async function analyseFixtureWithBetrixx(fixture, opts = {}) {
  // Use a focused analysis system prompt but augment it with an instruction
  // to expand each section in detail for a full match dossier. Keep the
  // persona voice but include more depth and structured subpoints.
  const systemPrompt = persona.getSystemPrompt({ includeContext: { mode: 'analysis', verbosity: 'full' } });

  const userPrompt = `Please produce a detailed BETRIXX match analysis for the fixture below.\n\nFixture data:\n${JSON.stringify(fixture, null, 2)}\n\nRequirements:\n- Follow the BETRIXX persona and voice.\n- Produce the following sections with depth and subpoints (use bullets):\n  1) Match Context — include form (last 5 matches), stakes, motivation, and expected tempo.\n  2) Tactical Breakdown — describe likely formations, how each team will try to create chances, pressing triggers, transition patterns.\n  3) Key Battles — identify 3 specific player/area matchups to watch and why they matter.\n  4) Probability Edges — give clear probability estimates (as percentages) for win/draw/loss and one short rationale per estimate.\n  5) Narrative Summary — a punchy closing paragraph (1-3 sentences) with a light emoji where fitting.\n\n- If any necessary data (lineups, injuries, recent form) is missing from the fixture payload, explicitly say "data not available" for that point — do NOT invent specifics.\n- Be thorough: aim for a detailed short report that may span multiple Telegram messages (do not artificially shorten to a single sentence).\n- Use clear sub-bullets and short paragraphs. Avoid giving betting stakes or gambling instructions.\n`;

  const model = opts.model || process.env.GROQ_MODEL;
  // Lower temperature for focused, factual analysis
  const temperature = typeof opts.temperature === 'number' ? opts.temperature : 0.3;

  const resp = await groqChat({ system: systemPrompt, user: userPrompt, temperature, max_tokens: opts.max_tokens || DEFAULT_MAX_TOKENS, model });
  return resp;
}

export default { analyseFixtureWithBetrixx };
