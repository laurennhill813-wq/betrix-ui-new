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
    return (val.name && String(val.name)) ||
           (val.shortName && String(val.shortName)) ||
           (val.teamName && String(val.teamName)) ||
           (val.home && String(val.home)) ||
           (val.away && String(val.away)) ||
           (val.title && String(val.title)) ||
           (val.fullName && String(val.fullName)) ||
           (val.tla && String(val.tla)) ||
           fallback || '';
  }

  return String(val);
}

export default safeName;
