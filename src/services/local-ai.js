import fetch from "../lib/fetch.js";
import { Logger } from "../utils/logger.js";

const logger = new Logger("LocalAI");

class LocalAIService {
  constructor() {
    this.name = "LocalAI";
    this.ollama_base = process.env.OLLAMA_BASE || "http://localhost:11434";
    this.ollama_model = process.env.OLLAMA_MODEL || "llama2";
  }

  // Try Ollama first, fall back to smart summarization
  async chat(userMessage, context = {}) {
    try {
      // Try Ollama if configured
      if (process.env.OLLAMA_ENABLED === "true" || process.env.OLLAMA_BASE) {
        try {
          const response = await fetch(`${this.ollama_base}/api/generate`, {
            method: "POST",
            timeout: 30000,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: this.ollama_model,
              prompt: userMessage,
              stream: false,
              temperature: 0.6,
            }),
          });
          if (response.ok) {
            const data = await response.json();
            if (data.response && String(data.response).trim()) {
              logger.info("Ollama response succeeded");
              return String(data.response).trim();
            }
          }
        } catch (e) {
          logger.warn("Ollama request failed", e?.message || String(e));
        }
      }

      // Fallback: intelligent local summarization without external API
      return this.localSummarize(userMessage, context);
    } catch (err) {
      logger.warn(
        "LocalAI processing failed, using template",
        err?.message || String(err),
      );
      return this.fallbackResponse(userMessage, context);
    }
  }

  // Smart summarization without external API (for sports captions)
  localSummarize(userMessage, context = {}) {
    // If message contains JSON (likely sports data), extract and summarize
    try {
      const jsonMatch = userMessage.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        if (data.home && data.away && data.league) {
          // Build a compelling sports caption from the data
          const status = (data.status || "").toUpperCase();
          const score = data.score || {};
          const scoreStr =
            score.home !== undefined && score.away !== undefined
              ? `${score.home}-${score.away}`
              : "";
          const time = data.time ? `${data.minute || data.time}'` : "";
          const story =
            status === "LIVE"
              ? `${data.home} and ${data.away} battle it out live.`
              : `${data.home} face ${data.away} — a key ${data.league} encounter.`;

          return [
            `**${data.home} vs ${data.away}**`,
            `${story} ${scoreStr} ${time}`.trim(),
            `#${(data.league || "Sports").replace(/\s+/g, "")} #BETRIXLive`,
          ]
            .join("\n")
            .trim();
        }
      }
    } catch (e) {
      // Ignore JSON parsing errors
    }

    // Generic fallback if no structure detected
    return this.fallbackResponse(userMessage, context);
  }
}

export { LocalAIService };
