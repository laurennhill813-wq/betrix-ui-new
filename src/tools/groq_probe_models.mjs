#!/usr/bin/env node
import fetch from 'node-fetch';

const key = process.env.GROQ_API_KEY;
if (!key) {
  console.error('GROQ_API_KEY not set');
  process.exit(1);
}

const candidates = [
  'llama-3.1-7b-instruct',
  'llama-3.1-8b-instruct',
  'llama-3.1-13b-instruct',
  'llama-3.1-70b-instruct',
  'llama-3.1-130b-instruct',
  'llama-3.1-405b-instruct'
];

const url = 'https://api.groq.com/openai/v1/chat/completions';
const timeoutMs = 15000;

const ac = (ms) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(id) };
};

async function tryModel(model) {
  const body = {
    model,
    messages: [{ role: 'user', content: 'Say: BETRIX Groq probe.' }]
  };
  const { signal, clear } = ac(timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify(body),
      signal
    });
    clear();
    const txt = await res.text();
    return { model, status: res.status, body: txt };
  } catch (e) {
    return { model, error: e.message || String(e) };
  }
}

(async function main(){
  console.log('Probing Groq model candidates...');
  for (const m of candidates) {
    console.log('\n== Trying', m, '==');
    const out = await tryModel(m);
    if (out.error) {
      console.log('Error:', out.error);
    } else {
      console.log('Status:', out.status);
      try { console.log('Body:', JSON.stringify(JSON.parse(out.body), null, 2).slice(0,2000)); }
      catch { console.log('Body:', out.body.slice(0,2000)); }
    }
  }
  console.log('\nProbe complete.');
})();
