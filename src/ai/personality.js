// src/ai/personality.js
export const BETRIX_TONES = {
  HYPE: "hype",
  PRO: "pro",
  HYBRID: "hybrid",
};

export function getToneInstructions(tone) {
  switch (tone) {
    case BETRIX_TONES.HYPE:
      return [
        "- Voice: Bold, energetic, meme-aware, fan-driven.",
        "- Style: Punchy one-liners, drama, momentum, emotional spikes.",
        "- Keep it sharp and clean. No cringe, no forced slang.",
      ].join("\n");
    case BETRIX_TONES.PRO:
      return [
        "- Voice: Professional analyst, calm and composed.",
        "- Style: Clear structure, context, and key facts.",
        "- Focus on tactics, stats, and implications, not jokes.",
      ].join("\n");
    case BETRIX_TONES.HYBRID:
    default:
      return [
        "- Voice: Hybrid — analyst + fan.",
        "- Style: Clear facts plus subtle hype.",
        "- Narrative-driven: focus on momentum and stakes.",
      ].join("\n");
  }
}

export function inferToneFromEvent(event = {}) {
  try {
    if (!event || typeof event !== "object") return BETRIX_TONES.HYBRID;
    // sport-specific overrides
    const sport = (event.sport || "").toString().toLowerCase();
    if (sport === "nba") return BETRIX_TONES.HYPE;
    if (sport === "nfl") return BETRIX_TONES.HYBRID;
    if (sport === "mlb" || sport === "nhl") return BETRIX_TONES.HYBRID;
    if (sport === "tennis" || sport === "golf") return BETRIX_TONES.PRO;

    if (event.context && (event.context.isFinal || event.context.isElimination))
      return BETRIX_TONES.HYBRID;
    if (
      event.context &&
      event.context.category === "news" &&
      event.context.sensitivity === "high"
    )
      return BETRIX_TONES.PRO;
    if (
      event.importance === "high" &&
      String(event.status).toUpperCase() === "LIVE"
    )
      return BETRIX_TONES.HYBRID;
    // Default: hype for lighter content
    return BETRIX_TONES.HYPE;
  } catch (e) {
    return BETRIX_TONES.HYBRID;
  }
}

export default { BETRIX_TONES, getToneInstructions, inferToneFromEvent };
