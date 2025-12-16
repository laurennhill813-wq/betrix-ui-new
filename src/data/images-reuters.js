// Minimal Reuters adapter skeleton.
// Implement fetching using your Reuters credentials and their Images API.
// For now this is a placeholder that returns an empty array unless configured.
const REUTERS_KEY = process.env.REUTERS_API_KEY || null;

export async function getReutersImages(ev = {}, limit = 5) {
  // TODO: implement Reuters Images API integration using REUTERS_API_KEY
  if (!REUTERS_KEY) return [];
  // Placeholder: return nothing until credentials are wired.
  return [];
}

export default { getReutersImages };
