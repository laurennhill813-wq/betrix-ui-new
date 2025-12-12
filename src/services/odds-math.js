export function americanToImpliedProb(odds) {
  if (odds == null || Number.isNaN(Number(odds))) return null;
  const o = Number(odds);
  if (o === 0) return null;
  if (o > 0) return 100 / (o + 100);
  return -o / (-o + 100);
}

export function impliedProbToAmerican(p) {
  if (p == null || typeof p !== 'number' || p <= 0 || p >= 1) return null;
  if (p > 0.5) {
    return Math.round((-p / (1 - p)) * 100);
  }
  return Math.round(((1 - p) / p) * 100);
}

export function removeVig(pHome, pAway) {
  if (pHome == null || pAway == null) return { fairHome: null, fairAway: null };
  const total = Number(pHome) + Number(pAway);
  if (!total || total <= 0) return { fairHome: null, fairAway: null };
  return {
    fairHome: Number(pHome) / total,
    fairAway: Number(pAway) / total,
  };
}
