import { Logger } from "../../utils/logger.js";
const logger = new Logger("media:getty");

// Getty adapter (scaffold)
// NOTE: Real Getty Images integrations require their REST API and credentials.
// This scaffold returns a safe placeholder when enabled and logs intent.

const API_KEY = process.env.GETTY_API_KEY || null;

function placeholderFor(subject) {
  const txt = encodeURIComponent(`GETTY ${subject || "image"}`);
  return `https://via.placeholder.com/1024x512.png?text=${txt}`;
}

export async function getImageForEvent({ event = {}, match = {} } = {}) {
  if (!API_KEY) return null;
  try {
    const subject =
      event.team || event.player || match.home || match.away || "event";
    logger.info("GETTY adapter enabled — returning placeholder for scaffold");
    return {
      imageUrl: placeholderFor(subject),
      meta: { provider: "getty", scaffold: true },
    };
  } catch (err) {
    logger.warn(`getty.getImageForEvent error: ${err?.message || String(err)}`);
    return null;
  }
}

export async function getImageForMatch({ match = {} } = {}) {
  if (!API_KEY) return null;
  try {
    const subject = match.home || match.away || match.id || "match";
    logger.info("GETTY adapter enabled — returning placeholder for scaffold");
    return {
      imageUrl: placeholderFor(subject),
      meta: { provider: "getty", scaffold: true },
    };
  } catch (err) {
    logger.warn(`getty.getImageForMatch error: ${err?.message || String(err)}`);
    return null;
  }
}

export default { getImageForEvent, getImageForMatch };
