import { PROVIDERS } from './providers/index.js';

export async function getSportData(sport, type, params = {}) {
  const candidates = Object.values(PROVIDERS).filter(p => (p.sports || []).includes(sport) || (p.sports || []).includes('all'));
  const results = [];
  for (const p of candidates) {
    if (!p.handler) continue;
    try {
      const r = await p.handler(sport, type, params);
      results.push({ provider: p.id, result: r });
    } catch (e) {
      results.push({ provider: p.id, error: e && e.message });
    }
  }
  return results;
}
