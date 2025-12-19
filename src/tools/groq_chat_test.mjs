#!/usr/bin/env node
import fetch from "../lib/fetch.js";

const key = process.env.GROQ_API_KEY;
if (!key) {
  console.error("GROQ_API_KEY not set");
  process.exit(1);
}

const url = "https://api.groq.com/openai/v1/chat/completions";
const body = {
  model: process.env.GROQ_MODEL || "llama-3.1-70b-instruct",
  messages: [{ role: "user", content: "Say: BETRIX Groq test successful." }],
};

async function run() {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      timeout: 20000,
    });
    console.log("Status:", res.status);
    const txt = await res.text();
    try {
      console.log("Body:", JSON.stringify(JSON.parse(txt), null, 2));
    } catch {
      console.log("Body:", txt);
    }
  } catch (e) {
    console.error("Request failed:", e.message || e);
    process.exit(2);
  }
}

run();
