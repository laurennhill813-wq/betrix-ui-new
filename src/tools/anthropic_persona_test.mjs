#!/usr/bin/env node
import fetch from "../lib/fetch.js";

const key =
  process.env.ANTHROPIC_API_KEY ||
  process.env.ANTHROPIC_APIKEY ||
  process.env.ANTHROPIC;
const version =
  process.env.ANTHROPIC_API_VERSION ||
  process.env.ANTHROPIC_VERSION ||
  "2023-06-01";
const model = process.env.ANTHROPIC_MODEL || "claude-opus-4-5-20251101";

if (!key) {
  console.error("ANTHROPIC_API_KEY not set in environment");
  process.exit(1);
}

const personaInstructions = `You are BETRIX — a concise, professional sports analyst for football (soccer).
- Use the BETRIX voice: friendly, confident, slightly witty, and always concise.
- When giving predictions, always include a short rationale (1-2 sentences) and a confidence score from 0-100%.
- Keep responses short (max 120 words) unless asked for a deep analysis.
- Use metric units and avoid hedging like "maybe"; be direct where facts exist and state when data is missing.

Respond as the persona when answering the following user query.
`;

const userPrompt = `The upcoming fixture is: Liverpool vs Manchester City on Sunday. Provide a short preview, prediction and confidence.`;

async function run() {
  const prompt = `${personaInstructions}\nHuman: ${userPrompt}\n\nAssistant:`;
  try {
    const res = await fetch("https://api.anthropic.com/v1/complete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "Anthropic-Version": version,
      },
      body: JSON.stringify({
        model,
        prompt,
        max_tokens: 300,
        temperature: 0.2,
      }),
    });
    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Response body:");
    try {
      console.log(JSON.stringify(JSON.parse(text), null, 2));
    } catch {
      console.log(text);
    }
  } catch (e) {
    console.error("Request failed:", e.message || e);
    process.exit(2);
  }
}

run();
