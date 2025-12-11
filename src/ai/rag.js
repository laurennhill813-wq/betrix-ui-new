import persona from './persona.js';

/**
 * Simple RAG helpers using Azure embeddings + Redis storage.
 * This is a lightweight prototype: vectors are stored as JSON in Redis hashes under `vec:<id>`.
 */
export function createRag({ redis, azure, logger }) {
  if (!redis) throw new Error('redis required for RAG');
  if (!azure) throw new Error('azure required for RAG');

  async function indexDocument(id, text, metadata = {}) {
    const vecs = await azure.embeddings([text]);
    const v = Array.isArray(vecs) && vecs[0] ? vecs[0] : null;
    if (!v) throw new Error('embedding failed');
    const key = `vec:${id}`;
    await redis.hset(key, 'vector', JSON.stringify(v), 'text', text, 'meta', JSON.stringify(metadata || {}), 'ts', Date.now());
    return true;
  }

  async function retrieveRelevant(namespaceOrUserId, query, { topK = 3 } = {}) {
    // compute query embedding
    const vecs = await azure.embeddings([query]);
    const q = Array.isArray(vecs) && vecs[0] ? vecs[0] : null;
    if (!q) return [];
    const matched = [];
    // naive scan (prototype): scan keys vec:*
    let cursor = '0';
    do {
      const res = await redis.scan(cursor, 'MATCH', 'vec:*', 'COUNT', 500);
      cursor = res[0];
      const keys = res[1] || [];
      for (const k of keys) {
        try {
          const data = await redis.hgetall(k);
          if (!data || !data.vector) continue;
          const v = JSON.parse(data.vector);
          // cosine similarity
          let dot = 0, nq = 0, nv = 0;
          for (let i = 0; i < q.length; i++) { dot += (q[i] || 0) * (v[i] || 0); nq += (q[i] || 0) ** 2; nv += (v[i] || 0) ** 2; }
          const sim = dot / (Math.sqrt(nq) * Math.sqrt(nv) || 1e-8);
          matched.push({ key: k, text: data.text || '', meta: data.meta ? JSON.parse(data.meta) : {}, score: sim });
        } catch (e) {
          logger && logger.warn && logger.warn('RAG: failed to parse vector for', k, e && e.message);
        }
      }
    } while (cursor !== '0');
    matched.sort((a,b) => b.score - a.score);
    return matched.slice(0, topK).map(m => m.text);
  }

  return { indexDocument, retrieveRelevant };
}

export default createRag;
