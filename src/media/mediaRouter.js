/**
 * Media Router
 *
 * Purpose: choose the best available image URL for a match or live event.
 * - Prefer explicit image URLs embedded in incoming events (ev.imageUrl, ev.thumbnail, etc.)
 * - Fall back to match-level logos or thumbnails (match.homeLogo, match.awayLogo, match.thumbnail)
 * - If none are present, attempt to query optional provider adapters in priority order
 *   (getty, reuters, ap, imagn, sportradar). Provider adapters are optional modules located
 *   under `src/media/providers/<provider>.js` and should export `getImageForEvent({match,event})`
 *   and/or `getImageForMatch({match})`.
 * - Final fallback is `process.env.DEFAULT_MEDIA_URL` or a built-in placeholder.
 *
 * This module is intentionally defensive: it will never throw if a provider adapter
 * is missing or fails — it will log and continue to the next option.
 */

import { Logger } from "../utils/logger.js";
import resolveDirectImage from "./resolveDirectImage.js";

const logger = new Logger("MediaRouter");

const DEFAULT_PLACEHOLDER =
  process.env.DEFAULT_MEDIA_URL ||
  "https://via.placeholder.com/1024x512.png?text=BETRIX+Media";

// Default provider priority (comma-separated ENV override allowed)
const DEFAULT_PRIORITY = "pexels,getty,reuters,ap,imagn,sportradar";
const providerPriority = (
  process.env.MEDIA_PROVIDER_PRIORITY || DEFAULT_PRIORITY
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

async function tryProvider(providerName, fnName, ctx) {
  try {
    // dynamic import of optional provider module
    const modPath = `../media/providers/${providerName}.js`;
    // eslint-disable-next-line no-underscore-dangle
    const mod = await import(modPath).catch(() => null);
    if (!mod || typeof mod[fnName] !== "function") return null;
    const result = await mod[fnName](ctx);
    if (result && typeof result === "string")
      return { imageUrl: result, provider: providerName };
    if (result && result.imageUrl)
      return {
        imageUrl: result.imageUrl,
        provider: providerName,
        meta: result,
      };
    return null;
  } catch (err) {
    logger.warn(
      `Provider ${providerName}.${fnName} failed: ${err?.message || String(err)}`,
    );
    return null;
  }
}

function pickFromCandidates(cands) {
  for (const u of cands) {
    if (!u) continue;
    if (typeof u === "string" && u.trim()) return u.trim();
    if (u && u.url) return String(u.url).trim();
    if (u && u.imageUrl) return String(u.imageUrl).trim();
  }
  return null;
}

/**
 * Get the best image for an event (goal, red card, highlight, etc.)
 * @param {Object} opts
 * @param {Object} opts.event - the live event object (may contain imageUrl/thumbnail)
 * @param {Object} opts.match - optional match object (home/away logos, thumbnail)
 * @returns {Promise<{imageUrl:string,provider:string,reason?:string}|null>}
 */
export async function getBestImageForEvent({ event = {}, match = {} } = {}) {
  // 1) check event explicit fields
  const eventCandidates = [
    event.imageUrl,
    event.photoUrl,
    event.thumbnail,
    event.image_url,
    event.mediaUrl,
  ];
  const evImg = pickFromCandidates(eventCandidates);
  if (evImg) {
    const direct = await resolveDirectImage(evImg).catch(() => null);
    if (direct)
      return { imageUrl: direct, provider: "event", reason: "event.explicit" };
    logger.info(
      "[MediaRouter] event explicit image not direct — continuing to match/providers",
      evImg,
    );
  }

  // 2) check match-level candidates
  const matchCandidates = [
    match.thumbnail,
    match.imageUrl,
    match.homeLogo,
    match.home_logo,
    match.awayLogo,
    match.away_logo,
  ];
  const mImg = pickFromCandidates(matchCandidates);
  if (mImg) {
    const direct = await resolveDirectImage(mImg).catch(() => null);
    if (direct)
      return { imageUrl: direct, provider: "match", reason: "match.level" };
    logger.info(
      "[MediaRouter] match-level image not direct — continuing to providers",
      mImg,
    );
  }

  // 3) query configured providers in priority order
  for (const provider of providerPriority) {
    // prefer event-level provider function first
    const evRes = await tryProvider(provider, "getImageForEvent", {
      event,
      match,
    });
    if (evRes && evRes.imageUrl) {
      const direct = await resolveDirectImage(evRes.imageUrl).catch(() => null);
      if (direct)
        return {
          ...evRes,
          imageUrl: direct,
          reason: `provider:${provider}:event`,
        };
      logger.info(
        "[MediaRouter] provider event image not direct — trying next",
        provider,
        evRes.imageUrl,
      );
    }

    const matchRes = await tryProvider(provider, "getImageForMatch", { match });
    if (matchRes && matchRes.imageUrl) {
      const direct = await resolveDirectImage(matchRes.imageUrl).catch(
        () => null,
      );
      if (direct)
        return {
          ...matchRes,
          imageUrl: direct,
          reason: `provider:${provider}:match`,
        };
      logger.info(
        "[MediaRouter] provider match image not direct — trying next",
        provider,
        matchRes.imageUrl,
      );
    }
  }

  // 4) fallback to default placeholder
  logger.info("No provider returned an image — using placeholder");
  return {
    imageUrl: DEFAULT_PLACEHOLDER,
    provider: "placeholder",
    reason: "fallback",
  };
}

/**
 * Convenience: get best image for a match only
 */
export async function getBestImageForMatch({ match = {} } = {}) {
  return getBestImageForEvent({ event: {}, match });
}

export default { getBestImageForEvent, getBestImageForMatch };
