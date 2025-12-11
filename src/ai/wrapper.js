import persona from './persona.js';
import createRag from './rag.js';

export function createAIWrapper({ azure, gemini, huggingface, localAI, claude, redis, logger }) {
  const rag = createRag({ redis, azure, logger });

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
      if (azure && azure.isHealthy()) {
        try {
          if (!context.few_shot) context.few_shot = true;
          const out = await azure.chat(augmented, context);
          return out;
        } catch (err) {
          logger && logger.warn && logger.warn('Azure.chat failed in wrapper — falling back', err && err.message);
        }
      }

      // Fallback chain
      if (claude && claude.enabled) {
        try { return await claude.chat(message, context); } catch(e) { logger && logger.warn && logger.warn('Claude failed', e && e.message); }
      }
      if (gemini && gemini.enabled) {
        try { return await gemini.chat(message, context); } catch(e) { logger && logger.warn && logger.warn('Gemini failed', e && e.message); }
      }
      if (huggingface && huggingface.isHealthy()) {
        try { return await huggingface.chat(message, context); } catch(e) { logger && logger.warn && logger.warn('HuggingFace failed', e && e.message); }
      }
      try { return await localAI.chat(message, context); } catch(e) { logger && logger.warn && logger.warn('LocalAI failed', e && e.message); }

      return "I'm having trouble right now. Try again later.";
    }
  };
}

export default createAIWrapper;
