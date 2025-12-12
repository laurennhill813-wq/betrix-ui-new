import persona from './persona.js';
import createRag from './rag.js';
import structured from './structured.js';
import metrics from '../utils/metrics.js';

export function createAIWrapper({ azure, gemini, huggingface, localAI, claude, redis, logger }) {
  const rag = createRag({ redis, azure, logger });

  // Temporary in-memory provider blocklist to avoid repeatedly calling rate-limited providers
  const blockedProviders = new Map(); // name -> unblockTimestamp(ms)

  function isBlocked(name) {
    if (!name) return false;
    const ts = blockedProviders.get(name);
    if (!ts) return false;
    return Date.now() < ts;
  }

  function blockProvider(name, ttlSeconds = 30) {
    try {
      const unblockAt = Date.now() + (ttlSeconds * 1000);
      blockedProviders.set(name, unblockAt);
      if (redis && redis.set) {
        // set a short-lived key so other workers can notice (best-effort)
        try { redis.set(`ai:block:${name}`, '1', 'EX', Math.max(5, Math.floor(ttlSeconds))); } catch(e) {}
      }
    } catch (e) {}
  }

  function isRateLimitError(err) {
    if (!err) return false;
    if (err.status === 429) return true;
    const msg = String(err.message || '').toLowerCase();
    if (msg.includes('quota') || msg.includes('rate limit') || msg.includes('too many requests')) return true;
    return false;
  }

  return {
    async chat(message, context = {}) {
      context = context || {};
      // ensure persona
      if (!context.system) {
        context.system = persona.getSystemPrompt({ includeContext: { id: context.id, name: context.name, role: context.role } });
      }

      // RAG: retrieve relevant passages if enabled
      let augmented = String(message);
      try {
        const top = await rag.retrieveRelevant(context.id || 'global', message, { topK: 3 });
        if (top && top.length) {
          const prefix = top.map((t,i) => `Passage ${i+1}: ${t}`).join('\n\n');
          augmented = prefix + '\n\n' + augmented;
        }
      } catch (e) {
        logger && logger.warn && logger.warn('RAG retrieval failed', e && e.message);
      }

      // Prefer Azure as brain
      const FORCE_AZURE = (String(process.env.FORCE_AZURE || process.env.FORCE_AZURE_PROVIDER || process.env.PREFER_AZURE || '').toLowerCase() === '1' || String(process.env.FORCE_AZURE || process.env.FORCE_AZURE_PROVIDER || process.env.PREFER_AZURE || '').toLowerCase() === 'true');

      if (FORCE_AZURE && azure && azure.isHealthy() && !isBlocked('azure')) {
        try {
          if (!context.few_shot) context.few_shot = true;
          const out = await azure.chat(augmented, context);
          metrics && metrics.incRequest && metrics.incRequest('azure');
          return out;
        } catch (err) {
          logger && logger.warn && logger.warn('Azure.chat forced failed — falling through', err && err.message);
          if (isRateLimitError(err)) blockProvider('azure', 60);
          metrics && metrics.incError && metrics.incError('azure');
        }
      }

      if (azure && azure.isHealthy() && !isBlocked('azure')) {
        try {
          if (!context.few_shot) context.few_shot = true;
          // If caller expects structured JSON, request a JSON-only output and validate
          if (context.expect === 'json:recommendation') {
            // first attempt
            let out = await azure.chat(augmented + '\n\nPlease respond with ONLY a single valid JSON object matching the recommendation schema.', context);
            try {
              const parsed = JSON.parse(out.trim());
              const v = structured.validateRecommendation(parsed);
              if (v.valid) {
                metrics && metrics.incRequest && metrics.incRequest('azure');
                return parsed;
              } else {
                logger && logger.warn && logger.warn('AI returned invalid recommendation JSON (attempt1):', v.reason || v.errors);
              }
            } catch (e) {
              logger && logger.warn && logger.warn('AI returned non-JSON on first attempt', e && e.message);
            }
            // retry once with stronger instruction
            let out2 = await azure.chat(augmented + '\n\nReturn ONLY a JSON object (no explanation). The object must match the schema: {type,match_id,market,selection,odds,confidence,stake_recommendation,rationale}.', context);
            try {
              const parsed2 = JSON.parse(out2.trim());
              const v2 = structured.validateRecommendation(parsed2);
              if (v2.valid) {
                metrics && metrics.incRequest && metrics.incRequest('azure');
                return parsed2;
              } else {
                logger && logger.warn && logger.warn('AI returned invalid recommendation JSON (attempt2):', v2.reason || v2.errors);
              }
            } catch (e) {
              logger && logger.warn && logger.warn('AI returned non-JSON on second attempt', e && e.message);
            }
            // fallback to plain text if JSON not produced
            metrics && metrics.incError && metrics.incError('azure');
            return "";
          }
          const out = await azure.chat(augmented, context);
          metrics && metrics.incRequest && metrics.incRequest('azure');
          return out;
        } catch (err) {
          logger && logger.warn && logger.warn('Azure.chat failed in wrapper — falling back', err && err.message);
          if (isRateLimitError(err)) blockProvider('azure', 60);
          metrics && metrics.incError && metrics.incError('azure');
        }
      }
      // Fallback chain — skip providers currently blocked by recent rate-limits
      if (claude && claude.enabled && !isBlocked('claude')) {
        try { return await claude.chat(message, context); } catch(e) { logger && logger.warn && logger.warn('Claude failed', e && e.message); if (isRateLimitError(e)) blockProvider('claude', 60); }
      }
      if (gemini && gemini.enabled && !isBlocked('gemini')) {
        try { return await gemini.chat(message, context); } catch(e) { logger && logger.warn && logger.warn('Gemini failed', e && e.message); if (isRateLimitError(e)) blockProvider('gemini', 90); }
      }
      if (huggingface && huggingface.isHealthy() && !isBlocked('huggingface')) {
        try { return await huggingface.chat(message, context); } catch(e) { logger && logger.warn && logger.warn('HuggingFace failed', e && e.message); if (isRateLimitError(e)) blockProvider('huggingface', 60); }
      }
      try { return await localAI.chat(message, context); } catch(e) { logger && logger.warn && logger.warn('LocalAI failed', e && e.message); }

      return "I'm having trouble right now. Try again later.";
    }
  };
}

export default createAIWrapper;
