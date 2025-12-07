import { AzureAIService } from '../services/azure-ai.js';

// Health probe handler for exercising AzureAIService in production safely.
// Usage: wire this handler to a route like GET /health/azure-ai in your web server.
// The probe will only run if AZURE_AI_ENDPOINT, AZURE_AI_KEY and AZURE_AI_DEPLOYMENT are set.

export default async function healthAzureAIHandler(req, res) {
  const endpoint = process.env.AZURE_AI_ENDPOINT;
  const apiKey = process.env.AZURE_AI_KEY;
  const deployment = process.env.AZURE_AI_DEPLOYMENT;
  const apiVersion = process.env.AZURE_API_VERSION || undefined;

  if (!endpoint || !apiKey || !deployment) {
    return res.status(501).json({ ok: false, reason: 'Azure AI not configured' });
  }

  // Small timeout and no side-effects; returns the assistant's short reply.
  const service = new AzureAIService(endpoint, apiKey, deployment, apiVersion, { timeoutMs: 5000, logger: console });

  try {
    const result = await service.chat('Health check ping', { system: 'You are a lightweight health probe.' });
    return res.json({ ok: true, result });
  } catch (err) {
    // Log and return safe error info
    try { console.error('Azure AI health probe error', { message: err && err.message, stack: err && err.stack }); } catch (e) { void e; }
    return res.status(500).json({ ok: false, error: err && err.message ? err.message : String(err) });
  }
}

export const meta = {
  path: '/health/azure-ai',
  method: 'GET',
  description: 'Probe Azure AI integration. Returns 501 if not configured.',
};
