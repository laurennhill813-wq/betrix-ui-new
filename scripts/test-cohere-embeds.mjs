import 'dotenv/config';
import fetch from 'node-fetch';

const key = process.env.COHERE_API_KEY;
if (!key) {
  console.error('EMBED_ERR No COHERE_API_KEY in environment');
  process.exit(2);
}

const endpoints = [
  'https://api.cohere.ai/v1/embed',
  'https://api.cohere.ai/v1/embeddings',
  'https://api.cohere.ai/v1/embed/english',
  'https://api.cohere.ai/v1/embed-fast',
];
const models = [
  process.env.COHERE_EMBEDDINGS_MODEL,
  'embed-english-v2.0',
  'embed-english-light-v2.0',
  'embed-english-small-v2.0',
  'embed-english-large-v2.0',
].filter(Boolean);

async function tryEndpoint(endpoint, model) {
  try {
    const body = JSON.stringify({ model, input: ['hello world'] });
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body,
    });
    const txt = await resp.text();
    let j = null;
    try { j = txt ? JSON.parse(txt) : null; } catch(e) { /* ignore */ }
    if (!resp.ok) {
      const msg = (j && (j.message || j.error)) || txt || `${resp.status} ${resp.statusText}`;
      return { ok: false, msg: `HTTP ${resp.status} ${msg}` };
    }
    // shapes: { embeddings: [ ... ] } or { data: [{ embedding: [...] }] } or { embeddings: { embedding: [...] } }
    if (j) {
      if (Array.isArray(j.embeddings)) {
        const emb = j.embeddings[0];
        if (Array.isArray(emb)) return { ok: true, dim: emb.length };
        if (emb && Array.isArray(emb.embedding)) return { ok: true, dim: emb.embedding.length };
      }
      if (Array.isArray(j.data)) {
        const d0 = j.data[0];
        if (d0 && Array.isArray(d0.embedding)) return { ok: true, dim: d0.embedding.length };
        if (d0 && Array.isArray(d0.embeddings)) return { ok: true, dim: d0.embeddings[0].length };
      }
      if (j.embedding && Array.isArray(j.embedding)) return { ok: true, dim: j.embedding.length };
    }
    return { ok: false, msg: 'unexpected response shape' };
  } catch (e) {
    return { ok: false, msg: e.message || String(e) };
  }
}

(async () => {
  for (const model of models) {
    for (const endpoint of endpoints) {
      process.stdout.write(`Trying Cohere endpoint ${endpoint} model ${model}... `);
      const res = await tryEndpoint(endpoint, model);
      if (res.ok) {
        console.log(`EMBED_OK inputs:1 dim:${res.dim}`);
        process.exit(0);
      } else {
        console.log(`failed: ${res.msg}`);
      }
    }
  }
  console.error('EMBED_ERR Cohere fallback failed for all endpoints/models');
  process.exit(3);
})();
