import fetch from "../lib/fetch.js";

export default class GroqService {
  constructor(
    apiKey,
    model = null,
    timeoutMs = 20000,
    baseUrl = "https://api.groq.com",
  ) {
    this.apiKey = apiKey;
    this.model = model || process.env.GROQ_MODEL || null;
    this.timeout = Number(timeoutMs) || 20000;
    this.baseUrl = (process.env.GROQ_BASE_URL || baseUrl).replace(/\/$/, "");
    this.enabled = Boolean(apiKey);
  }

  async chat(message, context = {}) {
    if (!this.enabled) throw new Error("Groq API key not configured");
    const url = `${this.baseUrl}/openai/v1/chat/completions`;
    const messages = [];
    if (context && context.system)
      messages.push({ role: "system", content: context.system });
    // if context includes few-shot examples, optionally append them
    if (
      context &&
      context.few_shot_examples &&
      Array.isArray(context.few_shot_examples)
    ) {
      for (const ex of context.few_shot_examples) messages.push(ex);
    }
    messages.push({ role: "user", content: String(message) });

    const body = {
      model: context.model || this.model || "llama-3.3-70b-versatile",
      messages,
      stream: false,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const txt = await res.text().catch(() => "");
      if (!res.ok) {
        const err = new Error(`Groq API error ${res.status}: ${txt}`);
        err.status = res.status;
        throw err;
      }
      try {
        const json = JSON.parse(txt);
        // OpenAI-compatible chat completion response
        const choice = json.choices && json.choices[0];
        const out =
          (choice && choice.message && choice.message.content) ||
          json.output ||
          json.text ||
          "";
        return String(out || "").trim();
      } catch (e) {
        return String(txt || "").trim();
      }
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  isHealthy() {
    return this.enabled;
  }
}
