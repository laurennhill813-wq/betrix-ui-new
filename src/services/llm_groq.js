// Small Groq LLM wrapper that always accepts a `system` and `user` message
// Uses global fetch (Node 18+/20+), expects `GROQ_API_KEY` and `GROQ_MODEL` env vars.
const GROQ_API_KEY = process.env.GROQ_API_KEY || null;
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const GROQ_BASE = process.env.GROQ_BASE_URL || 'https://api.groq.com';

if (!GROQ_API_KEY) {
  console.warn('[llm_groq] GROQ_API_KEY is not set. Groq calls will fail.');
}

// Increase default token allowance to permit detailed analyses when callers
// don't explicitly pass a larger `max_tokens` value.
export async function groqChat({ system, user, temperature = 0.7, max_tokens = 2000, model } = {}) {
  const runningCI = !!(process.env.GITHUB_ACTIONS || process.env.CI);
  if (!GROQ_API_KEY) {
    if (runningCI) {
      const u = String(user || '').toLowerCase();
      if (u.includes('analyse') || u.includes('analysis') || u.includes('match')) {
        return `Match Context:\n- data not available\n\nTactical Breakdown:\n- data not available\n\nKey Battles:\n- data not available\n\nProbability Edges:\n- Home: 40% | Draw: 30% | Away: 30%\n\nNarrative Summary:\n- Data not available — this is a mocked analysis for CI tests.`;
      }
      return `BETRIX (mock): Thanks for your message — this is a test response from CI.`;
    }
    throw new Error('GROQ_API_KEY missing');
  }
  const payload = {
    model: model || GROQ_MODEL,
    messages: [
      { role: 'system', content: system || '' },
      { role: 'user', content: user || '' }
    ],
    temperature: temperature,
    max_tokens: max_tokens
  };

  const url = `${GROQ_BASE.replace(/\/+$/, '')}/openai/v1/chat/completions`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify(payload),
    // rely on default fetch timeout; callers can wrap in AbortController if needed
  });

  const text = await res.text();
  if (!res.ok) {
    let errText = text;
    try { errText = JSON.parse(text); } catch (e) { /* keep raw */ }
    console.error('[llm_groq] Groq error', res.status, errText);
    const err = new Error(`Groq error: ${res.status}`);
    err.status = res.status;
    err.body = errText;
    throw err;
  }

  let json;
  try { json = JSON.parse(text); } catch (e) {
    console.warn('[llm_groq] Failed to JSON-parse Groq response, returning raw text');
    return String(text || '').trim();
  }

  // OpenAI-compatible shape: choices[0].message.content
  const choice = (json.choices && json.choices[0]) || null;
  const content = choice && choice.message && choice.message.content ? choice.message.content : (json.choices && json.choices[0] && json.choices[0].text) || '';
  return String(content || '').trim();
}

export default { groqChat };
