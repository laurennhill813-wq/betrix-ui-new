import { groqChat } from './llm_groq.js';
import persona from '../ai/persona.js';

const DEFAULT_MAX_TOKENS = 900;

export async function analyseFixtureWithBetrixx(fixture, opts = {}) {
  const systemPrompt = persona.getSystemPrompt();

  const userPrompt = `Analyse this football fixture in the BETRIXX style.\n\nFixture data:\n${JSON.stringify(fixture, null, 2)}\n\nRequirements:\n- Follow the BETRIXX persona.\n- Use sections:\n  1. Match Context\n  2. Tactical Breakdown\n  3. Key Battles\n  4. Probability Edges\n  5. Narrative Summary\n- If any key data (form, lineups, injuries) is missing from the fixture data, explicitly say "data not available" instead of guessing.\n- Keep the answer short enough to fit nicely in a single Telegram message (max ~600 words).`;

  const model = opts.model || process.env.GROQ_MODEL;
  const temperature = typeof opts.temperature === 'number' ? opts.temperature : 0.6;

  const resp = await groqChat({ system: systemPrompt, user: userPrompt, temperature, max_tokens: opts.max_tokens || DEFAULT_MAX_TOKENS, model });
  return resp;
}

export default { analyseFixtureWithBetrixx };
