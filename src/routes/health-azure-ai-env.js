// Lightweight diagnostic endpoint: returns presence of Azure/OpenAI env vars (non-sensitive)
export default function healthAzureAIEnvHandler(_req, res) {
  const keys = {
    AZURE_AI_ENDPOINT: !!process.env.AZURE_AI_ENDPOINT,
    AZURE_AI_KEY: !!process.env.AZURE_AI_KEY,
    AZURE_AI_DEPLOYMENT: !!process.env.AZURE_AI_DEPLOYMENT,
    AZURE_OPENAI_ENDPOINT: !!process.env.AZURE_OPENAI_ENDPOINT,
    AZURE_OPENAI_KEY: !!process.env.AZURE_OPENAI_KEY,
    AZURE_OPENAI_DEPLOYMENT: !!process.env.AZURE_OPENAI_DEPLOYMENT,
    AZURE_API_VERSION: !!process.env.AZURE_API_VERSION,
    AZURE_OPENAI_API_VERSION: !!process.env.AZURE_OPENAI_API_VERSION,
  };

  // Mask endpoint host if present (non-sensitive; do not return full keys)
  const endpointHost = (() => {
    const val = process.env.AZURE_AI_ENDPOINT || process.env.AZURE_OPENAI_ENDPOINT || process.env.AZURE_OPENAI_API_ENDPOINT;
    if (!val) return null;
    try { return new URL(String(val)).host; } catch { return null; }
  })();

  return res.json({ ok: true, presence: keys, endpointHost });
}

export const meta = { path: '/health/azure-ai/env', method: 'GET', description: 'Diagnostic: presence of Azure/OpenAI env vars (non-sensitive)' };
