import { Logger } from "../../utils/logger.js";
const logger = new Logger("media:sportradar");

const API_KEY = process.env.SPORTRADAR_API_KEY || null;
const REGION = process.env.SPORTRADAR_REGION || "eu";
const LOCALE = process.env.SPORTRADAR_LOCALE || "en";

// A set of URL patterns to try for logos/flags. These cover common Sportradar image hosts
// and subpaths. We will attempt HEAD on each URL and return the first OK one.
const HOST_PATTERNS = [
  "api.sportradar.com",
  "images.sportradar.com",
  "cdn.sportradar.com",
  "media.sportradar.com",
];

const PATH_TEMPLATES = [
  // team logos
  "/soccer-images-{REGION}/{LOCALE}/teams/{id}/logo.{EXT}",
  "/soccer-images-{REGION}/{LOCALE}/teams/{id}/primary/logo.{EXT}",
  "/soccer-images-v3-{REGION}/{LOCALE}/teams/{id}/logo.{EXT}",
  "/soccer-images-{REGION}/{LOCALE}/teams/{id}/logo_{size}.{EXT}",
  "/soccer/{REGION}/{LOCALE}/teams/{id}/logo.{EXT}",
  // flags
  "/soccer-images-{REGION}/{LOCALE}/flags/{code}.{EXT}",
  "/soccer-images-v3-{REGION}/{LOCALE}/flags/{code}.{EXT}",
  "/soccer/{REGION}/{LOCALE}/flags/{code}.{EXT}",
];

const EXTENSIONS = ["png", "jpg", "svg"];

async function tryUrl(url) {
  try {
    const res = await fetch(url, { method: "HEAD" });
    if (res && res.ok) return true;
    // Some CDNs disallow HEAD — try a range GET to avoid full download
    if (res && (res.status === 403 || res.status === 405)) return false;
    return false;
  } catch (err) {
    return false;
  }
}

async function findImageFromTemplates({ teamId, countryCode }) {
  if (!API_KEY) return null;

  const code = countryCode ? String(countryCode).toUpperCase() : null;
  for (const host of HOST_PATTERNS) {
    for (const tpl of PATH_TEMPLATES) {
      for (const ext of EXTENSIONS) {
        let path = tpl
          .replace("{REGION}", REGION)
          .replace("{LOCALE}", LOCALE)
          .replace("{EXT}", ext);
        if (path.includes("{id}") && teamId)
          path = path.replace("{id}", encodeURIComponent(teamId));
        if (path.includes("{code}") && code)
          path = path.replace("{code}", encodeURIComponent(code));
        if (path.includes("{size}")) path = path.replace("{size}", "1024x512");

        // skip templates that still have placeholders
        if (path.indexOf("{") !== -1) continue;

        const url = `https://${host}${path}?api_key=${API_KEY}`;
        try {
          const ok = await tryUrl(url);
          if (ok) return url;
        } catch (e) {
          // ignore and continue
        }
      }
    }
  }

  // As a last resort, attempt a small metadata lookup pattern some accounts expose
  try {
    if (teamId) {
      // Example metadata endpoint (best-effort) — may not exist for your package
      const metaUrls = [
        `https://api.sportradar.com/images/${REGION}/teams/${teamId}/assets?api_key=${API_KEY}`,
        `https://api.sportradar.com/soccer-images-${REGION}/${LOCALE}/teams/${teamId}/assets?api_key=${API_KEY}`,
      ];
      for (const mu of metaUrls) {
        try {
          const r = await fetch(mu, { method: "GET" });
          if (r && r.ok) {
            const j = await r.json().catch(() => null);
            // Try common fields
            const candidates = [];
            if (j) {
              if (j.logo) candidates.push(j.logo);
              if (j.logo_url) candidates.push(j.logo_url);
              if (j.files && Array.isArray(j.files)) {
                for (const f of j.files) {
                  if (f && (f.url || f.src)) candidates.push(f.url || f.src);
                }
              }
            }
            for (const c of candidates) {
              if (!c) continue;
              const ok = await tryUrl(c);
              if (ok) return c;
            }
          }
        } catch (e) {
          /* ignore */
        }
      }
    }
  } catch (e) {
    /* ignore */
  }

  return null;
}

export async function getImageForEvent(ctx = {}) {
  if (!API_KEY) return null;
  try {
    const teamId =
      ctx.homeTeamId ||
      ctx.awayTeamId ||
      ctx.home ||
      ctx.away ||
      ctx.event?.teamId ||
      ctx.event?.team;
    const countryCode =
      ctx.countryCode || ctx.event?.countryCode || ctx.match?.countryCode;

    // Try team first
    if (teamId) {
      const img = await findImageFromTemplates({ teamId, countryCode: null });
      if (img)
        return { imageUrl: img, provider: "sportradar", type: "logo", teamId };
    }

    // Try flag
    if (countryCode) {
      const img = await findImageFromTemplates({ teamId: null, countryCode });
      if (img)
        return {
          imageUrl: img,
          provider: "sportradar",
          type: "flag",
          countryCode,
        };
    }

    return null;
  } catch (err) {
    logger.warn(
      `sportradar.getImageForEvent error: ${err?.message || String(err)}`,
    );
    return null;
  }
}

export async function getImageForMatch({ match = {} } = {}) {
  if (!API_KEY) return null;
  try {
    const home =
      match.homeTeamId || match.homeId || match.homeTeam || match.home;
    const away =
      match.awayTeamId || match.awayId || match.awayTeam || match.away;
    const country = match.countryCode || match.country;

    if (home) {
      const img = await findImageFromTemplates({
        teamId: home,
        countryCode: null,
      });
      if (img)
        return {
          imageUrl: img,
          provider: "sportradar",
          type: "logo",
          teamId: home,
        };
    }
    if (away) {
      const img = await findImageFromTemplates({
        teamId: away,
        countryCode: null,
      });
      if (img)
        return {
          imageUrl: img,
          provider: "sportradar",
          type: "logo",
          teamId: away,
        };
    }
    if (country) {
      const img = await findImageFromTemplates({
        teamId: null,
        countryCode: country,
      });
      if (img)
        return {
          imageUrl: img,
          provider: "sportradar",
          type: "flag",
          countryCode: country,
        };
    }

    return null;
  } catch (err) {
    logger.warn(
      `sportradar.getImageForMatch error: ${err?.message || String(err)}`,
    );
    return null;
  }
}

export default { getImageForEvent, getImageForMatch };
