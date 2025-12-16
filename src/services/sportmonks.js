// SportMonks integration disabled — provide noop implementations so imports
// remain valid but no external network calls are made.
export const BASE = process.env.SPORTSMONKS_API_BASE || 'https://api.sportmonks.com/v3';

export async function sportmonks(path, params = '') {
  // SportMonks disabled — return empty result to indicate unavailable
  return [];
}

export default { sportmonks };
