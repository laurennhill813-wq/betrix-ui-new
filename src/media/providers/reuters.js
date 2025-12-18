import { Logger } from "../../utils/logger.js";
const logger = new Logger("media:reuters");

const API_KEY = process.env.REUTERS_API_KEY || null;

function placeholderFor(subject) {
  const txt = encodeURIComponent(`REUTERS ${subject || "image"}`);
  return `https://via.placeholder.com/1024x512.png?text=${txt}`;
}

export async function getImageForEvent({ event = {}, match = {} } = {}) {
  if (!API_KEY) return null;
  try {
    const subject =
      event.team || event.player || match.home || match.away || "event";
    logger.info("REUTERS adapter enabled — returning placeholder for scaffold");
    return {
      imageUrl: placeholderFor(subject),
      meta: { provider: "reuters", scaffold: true },
    };
  } catch (err) {
    logger.warn(
      `reuters.getImageForEvent error: ${err?.message || String(err)}`,
    );
    return null;
  }
}

export async function getImageForMatch({ match = {} } = {}) {
  if (!API_KEY) return null;
  try {
    const subject = match.home || match.away || match.id || "match";
    logger.info("REUTERS adapter enabled — returning placeholder for scaffold");
    return {
      imageUrl: placeholderFor(subject),
      meta: { provider: "reuters", scaffold: true },
    };
  } catch (err) {
    logger.warn(
      `reuters.getImageForMatch error: ${err?.message || String(err)}`,
    );
    return null;
  }
}

export default { getImageForEvent, getImageForMatch };
