// Minimal Getty adapter skeleton.
// Use Getty Images API / SDK when `GETTY_API_KEY` is provided.
const GETTY_KEY = process.env.GETTY_API_KEY || null;

export async function getGettyImages(ev = {}, limit = 5) {
  if (!GETTY_KEY) return [];
  // TODO: call Getty API (search endpoints) and map to { url, source }
  return [];
}

export default { getGettyImages };
