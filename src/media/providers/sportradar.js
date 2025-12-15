import { Logger } from '../../utils/logger.js';
const logger = new Logger('media:sportradar');

const API_KEY = process.env.SPORTRADAR_API_KEY || null;
const REGION = process.env.SPORTRADAR_REGION || 'eu';
const LOCALE = process.env.SPORTRADAR_LOCALE || 'en';

// Helper: HEAD-check a URL to ensure Sportradar serves it (best-effort)
async function urlExists(url) {
  try {
    // global fetch is available in Node 18+. Use HEAD to avoid downloading image body.
    const res = await fetch(url, { method: 'HEAD' });
    return res && res.ok;
  } catch (err) {
    // network error — treat as missing
    return false;
  }
}

async function getTeamLogo(teamId) {
  if (!API_KEY || !teamId) return null;
  try {
    // Common Sportradar pattern for images (adjustable if your package differs).
    // Example: https://api.sportradar.com/soccer-images-{region}/{locale}/teams/{team_id}/logo.png?api_key={API_KEY}
    const url = `https://api.sportradar.com/soccer-images-${REGION}/${LOCALE}/teams/${teamId}/logo.png?api_key=${API_KEY}`;
    const ok = await urlExists(url);
    if (ok) return url;
    logger.info('Team logo HEAD returned non-OK', { teamId, url });
    return null;
  } catch (err) {
    logger.warn('getTeamLogo error', err?.message || String(err));
    return null;
  }
}

async function getCountryFlag(countryCode) {
  if (!API_KEY || !countryCode) return null;
  try {
    const code = String(countryCode).toUpperCase();
    const url = `https://api.sportradar.com/soccer-images-${REGION}/${LOCALE}/flags/${code}.png?api_key=${API_KEY}`;
    const ok = await urlExists(url);
    if (ok) return url;
    logger.info('Country flag HEAD returned non-OK', { countryCode: code, url });
    return null;
  } catch (err) {
    logger.warn('getCountryFlag error', err?.message || String(err));
    return null;
  }
}

/**
 * getImageForEvent: prefer team logos if team ids present, else flags
 * Accepts context that may include sport, competitionId, matchId, homeTeamId, awayTeamId, countryCode
 */
export async function getImageForEvent(ctx = {}) {
  if (!API_KEY) return null;
  try {
    const { homeTeamId, awayTeamId, countryCode } = ctx || {};

    if (homeTeamId) {
      const logo = await getTeamLogo(homeTeamId);
      if (logo) return { imageUrl: logo, provider: 'sportradar', type: 'logo', teamId: homeTeamId };
    }
    if (awayTeamId) {
      const logo = await getTeamLogo(awayTeamId);
      if (logo) return { imageUrl: logo, provider: 'sportradar', type: 'logo', teamId: awayTeamId };
    }

    if (countryCode) {
      const flag = await getCountryFlag(countryCode);
      if (flag) return { imageUrl: flag, provider: 'sportradar', type: 'flag', countryCode };
    }

    return null;
  } catch (err) {
    logger.warn(`sportradar.getImageForEvent error: ${err?.message || String(err)}`);
    return null;
  }
}

export async function getImageForMatch({ match = {} } = {}) {
  if (!API_KEY) return null;
  try {
    const home = match.homeTeamId || match.homeId || match.homeTeam || match.home;
    const away = match.awayTeamId || match.awayId || match.awayTeam || match.away;
    const country = match.countryCode || match.country;

    if (home) {
      const logo = await getTeamLogo(home);
      if (logo) return { imageUrl: logo, provider: 'sportradar', type: 'logo', teamId: home };
    }
    if (away) {
      const logo = await getTeamLogo(away);
      if (logo) return { imageUrl: logo, provider: 'sportradar', type: 'logo', teamId: away };
    }
    if (country) {
      const flag = await getCountryFlag(country);
      if (flag) return { imageUrl: flag, provider: 'sportradar', type: 'flag', countryCode: country };
    }

    return null;
  } catch (err) {
    logger.warn(`sportradar.getImageForMatch error: ${err?.message || String(err)}`);
    return null;
  }
}

export default { getImageForEvent, getImageForMatch };
