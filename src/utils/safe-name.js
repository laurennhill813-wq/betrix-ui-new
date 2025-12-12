/**
 * Safe name coercion helper
 * Ensures that team/league values (which may be objects from providers)
 * are converted to a readable string using common fields.
 */
export function safeName(val, fallback = '') {
  if (val === undefined || val === null) return fallback || '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (Array.isArray(val)) {
    if (val.length === 0) return fallback || '';
    return safeName(val[0], fallback);
  }
  if (typeof val === 'object') {
    // Common provider field names
    const candidates = [val.name, val.shortName, val.teamName, val.home, val.away, val.title, val.fullName, val.tla, val.displayName, val.competition_name];
    for (const c of candidates) {
      if (c === undefined || c === null) continue;
      const s = String(c).trim();
      if (!s) continue;
      if (s.toLowerCase() === 'undefined' || s.toLowerCase() === 'null') continue;
      return s;
    }
    return fallback || '';
  }

  return String(val);
}

export default safeName;
