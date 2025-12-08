import fetch from 'node-fetch';

/**
 * Lightweight Azure OpenAI wrapper.
 * Reads configuration from the constructor and only enables itself when endpoint, key and deployment are provided.
 */
export class AzureAIService {
  // endpoint: base URL, apiKey: Azure OpenAI key, deployment: model deployment name
  // apiVersion: Azure OpenAI API version string
  // options: { logger?, timeoutMs? }
  constructor(endpoint, apiKey, deployment, apiVersion = '2023-05-15', options = {}) {
    this.endpoint = endpoint ? String(endpoint).replace(/\/$/, '') : null;
    this.apiKey = apiKey || null;
    this.deployment = deployment || null;
    this.apiVersion = apiVersion || '2023-05-15';
    this.enabled = Boolean(this.endpoint && this.apiKey && this.deployment);
    this.lastUsed = null;
    this.logger = options.logger || console;
    this.timeoutMs = typeof options.timeoutMs === 'number' ? options.timeoutMs : 60_000;
  }

  isHealthy() {
    // We consider it healthy if it is configured. A deeper probe could be added.
    return this.enabled;
  }

  async chat(message, context = {}) {
    if (!this.enabled) throw new Error('AzureAIService not configured');
    const url = `${this.endpoint}/openai/deployments/${encodeURIComponent(this.deployment)}/chat/completions?api-version=${encodeURIComponent(this.apiVersion)}`;

    const body = {
      // minimal chat payload expected by Azure OpenAI chat-completions
      messages: [
        { role: 'system', content: context.system || 'You are a helpful assistant.' },
        { role: 'user', content: String(message) }
      ],
      max_tokens: 512,
      temperature: 0.6,
    };

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let timeoutId = null;
    if (controller) {
      timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    }

    let resp;
    let text = '';
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'api-key': this.apiKey,
        },
        body: JSON.stringify(body),
        signal: controller ? controller.signal : undefined,
      });

      text = await resp.text();
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      const isAbort = err && (err.name === 'AbortError' || err.type === 'aborted');
      const msg = isAbort ? `AzureAI request aborted after ${this.timeoutMs}ms` : `AzureAI fetch error: ${err && err.message ? err.message : String(err)}`;
      try { this.logger.error(msg, { url, deployment: this.deployment, error: err }); } catch (e) { void e; }
      const e = new Error(msg);
      e.cause = err;
      throw e;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (e) { void e; }

    if (!resp.ok) {
      const errMsg = json?.error?.message || json?.error || text || `${resp.status} ${resp.statusText}`;
      try { this.logger.error('AzureAI non-OK response', { status: resp.status, body: errMsg }); } catch (e) { void e; }
      const e = new Error(`AzureAI error: ${errMsg}`);
      e.status = resp.status;
      throw e;
    }

    // Try to extract assistant content from known shapes
    let out = null;
    try {
      if (json?.choices && Array.isArray(json.choices) && json.choices[0]) {
        // chat completions: choices[0].message.content
        out = json.choices[0].message?.content || json.choices[0].text || null;
      }
    } catch (e) { void e; }

    this.lastUsed = this.deployment;

    if (out == null) {
      // fallback: return a stringified JSON result to aid debugging
      return json ? JSON.stringify(json) : text || '';
    }
    return String(out);
  }
}

