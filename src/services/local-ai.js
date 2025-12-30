class LocalAIService {
  constructor() {
    this.name = "LocalAI";
    this.ollama_base = process.env.OLLAMA_BASE || "http://localhost:11434";
    this.ollama_model = process.env.OLLAMA_MODEL || "llama2";
  }

  // Provide a fallback response for failed AI operations
  fallbackResponse(userMessage, context = {}) {
    return (
      "[AI unavailable] Sorry, I couldn't generate a response right now. Please try again later or rephrase your request."
    );
  }

const { logger } = require("../utils/logger.js");

class LocalAIService {
  constructor() {
    this.name = "LocalAI";
    this.ollama_base = process.env.OLLAMA_BASE || "http://localhost:11434";
    this.ollama_model = process.env.OLLAMA_MODEL || "llama2";
  }

  // Provide a fallback response for failed AI operations
  fallbackResponse(userMessage, context = {}) {
    return (
      "[AI unavailable] Sorry, I couldn't generate a response right now. Please try again later or rephrase your request."
    );
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
    try {
      const jsonMatch = userMessage.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        if (data.home && data.away && data.league) {
          // Build a compelling sports caption with EMOJIS and PERSONALITY
          const status = (data.status || "").toUpperCase();
          const score = data.score || {};
          const scoreStr =
            score.home !== undefined && score.away !== undefined
              ? `${score.home}-${score.away}`
              : "";
          const time = data.time ? `'${data.minute || data.time}` : "";
          
          // Personality-driven narratives with emojis
          let story = "";
          if (status === "LIVE") {
            story = `⚽ **${data.home} vs ${data.away}** — Live action! ${scoreStr} ${time}`;
          } else if (data.league && data.league.toLowerCase().includes("champions")) {
            story = `🏆 **${data.home} vs ${data.away}** — Elite clash in the ${data.league}!`;
          } else if (data.league && data.league.toLowerCase().includes("premier")) {
            story = `👑 **${data.home} vs ${data.away}** — Premier drama incoming!`;
          } else {
            story = `⚡ **${data.home} vs ${data.away}** — Big match alert in ${data.league}!`;
          }
          
          // Build tags with energy
          const leagueTag = (data.league || "Sports")
            .replace(/\s+/g, "")
            .slice(0, 20);
          const homeTag = (data.home || "").split(" ")[0].slice(0, 10);
          
          return [
            story,
            `🔥 Will ${homeTag} deliver? Watch this unfold...`,
            `#${leagueTag} #BETRIXLive #Sports`,
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

module.exports = { LocalAIService };
