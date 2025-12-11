// Simple structured output validator for betting recommendations

export const RECOMMENDATION_SCHEMA_KEYS = [
  'type', 'match_id', 'market', 'selection', 'odds', 'confidence', 'stake_recommendation', 'rationale'
];

export function validateRecommendation(obj) {
  if (!obj || typeof obj !== 'object') return { valid: false, reason: 'not an object' };
  for (const k of ['type','match_id','market','selection']) {
    if (!obj[k] || typeof obj[k] !== 'string') return { valid: false, reason: `missing or invalid ${k}` };
  }
  if (typeof obj.odds !== 'number' || obj.odds <= 1) return { valid: false, reason: 'invalid odds' };
  if (typeof obj.confidence !== 'number' || obj.confidence < 0 || obj.confidence > 1) return { valid: false, reason: 'invalid confidence' };
  if (!['small','medium','large'].includes(String(obj.stake_recommendation))) return { valid: false, reason: 'invalid stake_recommendation' };
  return { valid: true };
}

export default { validateRecommendation };
