#!/usr/bin/env node
import GroqService from "../services/groq.js";
import persona from "../ai/persona.js";

const key = process.env.GROQ_API_KEY;
if (!key) {
  console.error("DEEP: GROQ_API_KEY not set");
  process.exit(1);
}
const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

const groq = new GroqService(key, model);

const fixture = {
  home: "Liverpool",
  away: "Manchester City",
  competition: "Premier League",
  date: "2025-12-14T16:30:00Z",
  venue: "Anfield",
  odds: { home: 2.4, draw: 3.6, away: 2.2 },
};

async function run() {
  const prompt = `Provide a BETRIXX-style analysis for this fixture:\n\n${JSON.stringify(fixture, null, 2)}\n\nFollow the BETRIXX persona rules.`;
  const context = { system: persona.BETRIX_SYSTEM_PROMPT_FULL };
  try {
    const out = await groq.chat(prompt, context);
    console.log("Groq response:\n", out);
  } catch (e) {
    console.error("Groq fixture test failed:", e.message || e);
    process.exit(2);
  }
}

run();
