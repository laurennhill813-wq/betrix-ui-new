import fetch from "../lib/fetch.js";
import persona from "../ai/persona.js";
import metrics from "../utils/metrics.js";

/**
 * Lightweight Azure OpenAI wrapper.
 * Reads configuration from the constructor and only enables itself when endpoint, key and deployment are provided.
 */
export class AzureAIService {
  // endpoint: base URL, apiKey: Azure OpenAI key, deployment: model deployment name
  // apiVersion: Azure OpenAI API version string
  // options: { logger?, timeoutMs? }
  constructor(
    endpoint,
    apiKey,
    deployment,
    apiVersion = "2024-08-01-preview",
    options = {},
  ) {
    this.endpoint = endpoint ? String(endpoint).replace(/\/$/, "") : null;
    this.apiKey = apiKey || null;
    this.deployment = deployment || null;
    this.apiVersion = apiVersion || "2023-05-15";
    // embeddingsDeployment can be provided via options or env var; default to an embeddings-capable model
    this.embeddingsDeployment =
      options.embeddingsDeployment ||
      process.env.AZURE_EMBEDDINGS_DEPLOYMENT ||
      "text-embedding-3-large";
    this.enabled = Boolean(this.endpoint && this.apiKey && this.deployment);
    this.lastUsed = null;
    this.logger = options.logger || console;
    this.timeoutMs =
      typeof options.timeoutMs === "number" ? options.timeoutMs : 60_000;
    // warn early if embeddings deployment matches chat deployment (commonly misconfigured)
    try {
      if (
        this.embeddingsDeployment &&
        this.deployment &&
        this.embeddingsDeployment === this.deployment
      ) {
        this.logger &&
          this.logger.warn &&
          this.logger.warn(
            "[AzureAIService] embeddingsDeployment equals chat deployment — ensure you created a separate embeddings deployment or set AZURE_EMBEDDINGS_DEPLOYMENT",
          );
      }
    } catch (e) {
      /* ignore logger errors */
    }
  }

  isHealthy() {
    // We consider it healthy if it is configured. A deeper probe could be added.
    return this.enabled;
  }

  async chat(message, context = {}) {
    if (!this.enabled) throw new Error("AzureAIService not configured");
    const url = `${this.endpoint}/openai/deployments/${encodeURIComponent(this.deployment)}/chat/completions?api-version=${encodeURIComponent(this.apiVersion)}`;

    const body = {
      // minimal chat payload expected by Azure OpenAI chat-completions
      // ensure a BETRIX persona is supplied when none is provided by caller
      messages: (function () {
        const have = context && context.system;
        const includeCtx =
          context && (context.id || context.name || context.role)
            ? { id: context.id, name: context.name, role: context.role }
            : undefined;
        const defaultSystem = have
          ? context.system
          : persona.getSystemPrompt({ includeContext: includeCtx });
        // include few-shot examples if requested by context.few_shot === true
        const msgs = [{ role: "system", content: defaultSystem }];
        if (
          context &&
          context.few_shot &&
          Array.isArray(persona.FEW_SHOT_EXAMPLES)
        ) {
          for (const ex of persona.FEW_SHOT_EXAMPLES) msgs.push(ex);
        }
        msgs.push({ role: "user", content: String(message) });
        return msgs;
      })(),
      // increase allowance for longer replies
      max_tokens:
        typeof context.max_tokens === "number" ? context.max_tokens : 2048,
      temperature:
        typeof context.temperature === "number" ? context.temperature : 0.6,
    };

    const controller =
      typeof AbortController !== "undefined" ? new AbortController() : null;
    let timeoutId = null;
    if (controller) {
      timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    }

    // Log request metadata (do NOT log api key)
    try {
      this.logger.info &&
        this.logger.info("AzureAIService.request", {
          endpoint: this.endpoint,
          deployment: this.deployment,
          apiVersion: this.apiVersion,
          timeoutMs: this.timeoutMs,
          messagePreview: String(message).slice(0, 300),
        });
    } catch (e) {
      /* ignore logging errors */
    }

    let resp;
    let text = "";
    const start = Date.now();
    try {
      resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "api-key": this.apiKey,
        },
        body: JSON.stringify(body),
        signal: controller ? controller.signal : undefined,
      });

      text = await resp.text();
      const elapsed = Date.now() - start;
      try {
        const preview = String(text || "").slice(0, 2000);
        this.logger.info &&
          this.logger.info("AzureAIService.response", {
            status: resp.status,
            preview,
          });
        metrics && metrics.incRequest && metrics.incRequest("azure");
        metrics &&
          metrics.observeLatency &&
          metrics.observeLatency("azure", elapsed);
      } catch (e) {
        /* ignore logging errors */
      }
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      const isAbort =
        err && (err.name === "AbortError" || err.type === "aborted");
      const msg = isAbort
        ? `AzureAI request aborted after ${this.timeoutMs}ms`
        : `AzureAI fetch error: ${err && err.message ? err.message : String(err)}`;
      try {
        this.logger.error(msg, {
          url,
          deployment: this.deployment,
          error: err,
        });
      } catch (e) {
        void e;
      }
      metrics && metrics.incError && metrics.incError("azure");
      const e = new Error(msg);
      e.cause = err;
      throw e;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (e) {
      void e;
    }

    if (!resp.ok) {
      const errMsg =
        json?.error?.message ||
        json?.error ||
        text ||
        `${resp.status} ${resp.statusText}`;
      try {
        this.logger.error &&
          this.logger.error("AzureAI non-OK response", {
            status: resp.status,
            bodyPreview: String(errMsg).slice(0, 1000),
          });
      } catch (e) {
        void e;
      }
      const e = new Error(`AzureAI error: ${errMsg}`);
      e.status = resp.status;
      throw e;
    }

    // Try to extract assistant content from known shapes
    let out = null;
    try {
      if (json?.choices && Array.isArray(json.choices) && json.choices[0]) {
        const choice = json.choices[0];
        // Preferred shape: choices[0].message.content (string)
        if (choice.message && typeof choice.message.content === "string") {
          out = choice.message.content;
        } else if (
          choice.message &&
          choice.message.content &&
          typeof choice.message.content === "object"
        ) {
          // Some variants may return an object with 'parts' (array) or 'text'
          if (Array.isArray(choice.message.content.parts))
            out = choice.message.content.parts.join("");
          else if (typeof choice.message.content.text === "string")
            out = choice.message.content.text;
        } else if (typeof choice.text === "string") {
          out = choice.text;
        }
      }
      // also handle older/completion-like response shapes
      if (
        out == null &&
        json?.data &&
        Array.isArray(json.data) &&
        json.data[0]
      ) {
        // guard for alternative API shapes
        const d = json.data[0];
        if (d && (d.content || d.text)) out = d.content || d.text;
      }
    } catch (e) {
      void e;
    }

    this.lastUsed = this.deployment;

    if (out == null) {
      // fallback: return a stringified JSON result to aid debugging
      // if usage token counts are present, record them
      try {
        if (json?.usage) {
          if (typeof json.usage.completion_tokens === "number")
            metrics &&
              metrics.addTokens &&
              metrics.addTokens(
                "azure",
                "completion",
                json.usage.completion_tokens,
              );
          if (typeof json.usage.prompt_tokens === "number")
            metrics &&
              metrics.addTokens &&
              metrics.addTokens("azure", "prompt", json.usage.prompt_tokens);
        }
      } catch (e) {
        /* ignore */
      }
      return json ? JSON.stringify(json) : text || "";
    }
    // record usage tokens when available
    try {
      if (json?.usage) {
        if (typeof json.usage.completion_tokens === "number")
          metrics &&
            metrics.addTokens &&
            metrics.addTokens(
              "azure",
              "completion",
              json.usage.completion_tokens,
            );
        if (typeof json.usage.prompt_tokens === "number")
          metrics &&
            metrics.addTokens &&
            metrics.addTokens("azure", "prompt", json.usage.prompt_tokens);
      }
    } catch (e) {
      /* ignore */
    }
    return String(out).trim();
  }

  // embeddings: take an array of input strings and return embeddings array
  async embeddings(inputs = []) {
    if (!this.enabled)
      throw new Error("AzureAIService not configured for embeddings");
    // Use configured embeddings deployment (separate from chat deployment)
    const embDeploy = this.embeddingsDeployment || this.deployment;
    // support fallback to Cohere embeddings when Azure deployment is not available
    const cohereKey = process.env.COHERE_API_KEY || null;
    // Log which embeddings deployment we're attempting to use (helps diagnose "deployment does not exist")
    try {
      this.logger &&
        this.logger.info &&
        this.logger.info("AzureAIService.embeddings.request", {
          endpoint: this.endpoint,
          embeddingsDeployment: embDeploy,
          apiVersion: this.apiVersion,
          inputsPreview: Array.isArray(inputs)
            ? inputs.slice(0, 3)
            : [String(inputs).slice(0, 200)],
          timeoutMs: this.timeoutMs,
        });
    } catch (e) {
      /* ignore logging errors */
    }
    const url = `${this.endpoint}/openai/deployments/${encodeURIComponent(embDeploy)}/embeddings?api-version=${encodeURIComponent(this.apiVersion)}`;
    const body = { input: Array.isArray(inputs) ? inputs : [String(inputs)] };
    const controller =
      typeof AbortController !== "undefined" ? new AbortController() : null;
    let timeoutId = null;
    if (controller)
      timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    let respText = "";
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "api-key": this.apiKey },
        body: JSON.stringify(body),
        signal: controller ? controller.signal : undefined,
      });
      respText = await resp.text();
      if (!resp.ok) {
        let json = null;
        try {
          json = JSON.parse(respText);
        } catch (e) {}
        const errMsg =
          json?.error?.message ||
          respText ||
          `${resp.status} ${resp.statusText}`;
        // If the error mentions a missing deployment, add actionable guidance
        let guidance = "";
        if (
          typeof errMsg === "string" &&
          /deployment for this resource does not exist/i.test(errMsg)
        ) {
          guidance =
            " — check AZURE_EMBEDDINGS_DEPLOYMENT env var or create an embeddings deployment in your Azure OpenAI resource (names are case-sensitive).";
        }
        const e = new Error(`Azure embeddings error: ${errMsg}${guidance}`);
        e.status = resp.status;
        // If Azure embeddings deployment missing and Cohere key is available, attempt Cohere fallback
        if (
          cohereKey &&
          /deployment for this resource does not exist/i.test(String(errMsg))
        ) {
          try {
            this.logger &&
              this.logger.info &&
              this.logger.info(
                "AzureAIService.embeddings: attempting Cohere fallback",
              );
            const ch = await (async function callCohere(inputs, key, logger) {
              const tryEndpoints = [
                "https://api.cohere.ai/v1/embed",
                "https://api.cohere.ai/v1/embeddings",
                "https://api.cohere.ai/v1/embed/english",
              ];
              const model =
                process.env.COHERE_EMBEDDINGS_MODEL ||
                "embed-english-light-v2.0";
              let lastErr = null;
              for (const cohereUrl of tryEndpoints) {
                try {
                  const resp = await fetch(cohereUrl, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${key}`,
                    },
                    body: JSON.stringify({ model, input: inputs }),
                  });
                  const txt = await resp.text();
                  let j = null;
                  try {
                    j = txt ? JSON.parse(txt) : null;
                  } catch (e) {
                    j = null;
                  }
                  if (!resp.ok) {
                    const msg =
                      j?.message || txt || `${resp.status} ${resp.statusText}`;
                    lastErr = new Error(
                      `Cohere embeddings error (${cohereUrl}): ${msg}`,
                    );
                    lastErr.status = resp.status;
                    continue; // try next URL
                  }
                  // Common response shapes: { embeddings: [...] } or { data: [{embedding: [...]}, ...] }
                  if (j && Array.isArray(j.embeddings))
                    return j.embeddings.map((item) =>
                      Array.isArray(item) ? item : item.embedding || item,
                    );
                  if (j && Array.isArray(j.data))
                    return j.data.map(
                      (d) =>
                        d.embedding || (d.embeddings ? d.embeddings[0] : null),
                    );
                  // fallback: if API returned a single embedding object
                  if (j && j.embedding && Array.isArray(j.embedding))
                    return [j.embedding];
                  // if nothing matched, continue to next endpoint
                  lastErr = new Error(
                    `Cohere embeddings: unexpected response shape from ${cohereUrl}`,
                  );
                } catch (e) {
                  lastErr = e;
                }
              }
              if (lastErr) throw lastErr;
              return null;
            })(
              Array.isArray(inputs) ? inputs : [String(inputs)],
              cohereKey,
              this.logger,
            );
            if (Array.isArray(ch)) return ch;
          } catch (coErr) {
            // if Cohere also fails, surface original Azure error below
            try {
              this.logger &&
                this.logger.warn &&
                this.logger.warn(
                  "Cohere fallback failed",
                  coErr && coErr.message ? coErr.message : coErr,
                );
            } catch (e) {}
          }
        }
        throw e;
      }
      const json = JSON.parse(respText || "{}");
      if (json?.data && Array.isArray(json.data)) {
        return json.data.map((d) => d.embedding || null);
      }
      return null;
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      throw err;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }
}
