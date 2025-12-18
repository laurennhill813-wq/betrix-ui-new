import * as sr from "../../services/providers/sportradar.js";

export async function handler(sport, type, params = {}, opts = {}) {
  // Forward to the centralized Sportradar fetcher in services/providers
  return sr.fetchSportradar(sport, type, params, opts);
}

export default { handler };
