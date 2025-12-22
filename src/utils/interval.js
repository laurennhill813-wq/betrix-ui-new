// Small helpers for interval parsing and normalization used by Lipana reconciliation
export function coerceThresholdMinutes(v, fallback = 5) {
  if (v === null || v === undefined) return fallback;
  const n = Number(v);
  if (!Number.isFinite(n) || Number.isNaN(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

// Returns a string suitable for binding to the SQL interval parameter
// or `null` to allow SQL COALESCE fallback when scheduling is disabled.
export function normalizeIntervalParam(thresholdMinutes) {
  const minutes = coerceThresholdMinutes(thresholdMinutes);
  // if explicitly set to 0 -> disable (return null so COALESCE uses default)
  if (minutes === 0) return null;
  return `${minutes} minutes`;
}
