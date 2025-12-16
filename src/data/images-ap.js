// Minimal Associated Press adapter skeleton.
const AP_KEY = process.env.AP_API_KEY || null;

export async function getApImages(ev = {}, limit = 5) {
  if (!AP_KEY) return [];
  // TODO: call AP Media API and return candidates
  return [];
}

export default { getApImages };
