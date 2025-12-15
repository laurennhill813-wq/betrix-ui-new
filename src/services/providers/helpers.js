import { PROVIDERS } from './index.js';

export function getProvidersBySportAndType(sport, type) {
  return Object.values(PROVIDERS)
    .filter((p) => {
      const matchSport = (p.sports || []).includes(sport) || (p.sports || []).includes('all');
      const matchType = !type || p.type === type;
      return matchSport && matchType;
    })
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));
}

export function getProviderById(id) {
  return PROVIDERS[id] || null;
}

export default { getProvidersBySportAndType, getProviderById };
