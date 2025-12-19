import fetch from "../lib/fetch.js";

class ClaudeService {
  constructor(apiKey, model = "claude-haiku-4.5", timeoutMs = 15000) {
    this.apiKey = apiKey;
    this.model = model;
    this.timeout = Number(timeoutMs) || 15000;
    this.enabled = Boolean(apiKey);
    this.apiVersion =
      process.env.ANTHROPIC_API_VERSION ||
      process.env.ANTHROPIC_VERSION ||
      "2023-06-01";
  }

  async chat(message, context = {}) {
    if (!this.enabled) throw new Error("Claude API key not configured");

    const url = "https://api.anthropic.com/v1/complete";
    // include system prompt / persona if provided in context
    let promptBody = "";
    if (context.system) {
      // ensure persona/system prompt is separated clearly
      promptBody += `${context.system}\n\n`;
    }
    promptBody += `\n\nHuman: ${message}\n\nAssistant:`;

    const body = {
      model: this.model,
      prompt: promptBody,
      max_tokens_to_sample: 1024,
      temperature:
        typeof context.temperature === "number" ? context.temperature : 0.2,
      stop_sequences: ["\n\nHuman:"],
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "Anthropic-Version": this.apiVersion,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        const err = new Error(`Claude API error ${res.status}: ${txt}`);
        // mark billing/credit errors for higher-level logic
        const lowCreditMsg = String(txt || "").toLowerCase();
        if (
          res.status === 400 &&
          (lowCreditMsg.includes("credit") ||
            lowCreditMsg.includes("balance") ||
            lowCreditMsg.includes("billing") ||
            lowCreditMsg.includes("low"))
        ) {
          err.code = "billing";
        }
        throw err;
      }

      const json = await res.json();
      // Anthropic responses may include `completion` or choices; be tolerant
      const out =
        json.completion ||
        (json?.choices &&
          json.choices[0] &&
          (json.choices[0].text || json.choices[0].content)) ||
        json.output ||
        "";
      return String(out || "");
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  isHealthy() {
    return this.enabled;
  }
}

export default ClaudeService;
