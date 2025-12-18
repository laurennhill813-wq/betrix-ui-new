#!/usr/bin/env node
import fetch from "node-fetch";

const key = process.env.DEEPSEEK_API_KEY;
const base = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";
const timeoutMs = 20000;

if (!key) {
  console.error("DEEPSEEK_API_KEY not set");
  process.exit(1);
}

const personaSystem = `You are BETRIX — a concise, professional sports analyst for football (soccer).
Use the BETRIX voice: friendly, confident, slightly witty, and always concise.
When giving predictions, include a short rationale (1-2 sentences) and a confidence score from 0-100%.
Keep responses short (max 120 words).`;

const userMessage =
  "Liverpool vs Manchester City on Sunday — give a short preview, prediction and confidence.";

async function run() {
  const url = `${base.replace(/\/$/, "")}/chat/completions`;
  const body = {
    model,
    messages: [
      { role: "system", content: personaSystem },
      { role: "user", content: userMessage },
    ],
    stream: false,
  };

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    console.log("POST", url);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(id);
    console.log("Status:", res.status);
    const txt = await res.text();
    try {
      console.log("Response JSON:", JSON.stringify(JSON.parse(txt), null, 2));
    } catch (e) {
      console.log("Response text:", txt.slice(0, 2000));
    }
  } catch (e) {
    clearTimeout(id);
    console.error("Request failed:", e.message || e);
    process.exit(2);
  }
}

run();
