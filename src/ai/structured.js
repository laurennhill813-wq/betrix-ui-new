// Simple structured output validator for betting recommendations

export const RECOMMENDATION_SCHEMA_KEYS = [
  'type', 'match_id', 'market', 'selection', 'odds', 'confidence', 'stake_recommendation', 'rationale'
];

import Ajv from 'ajv';

const ajv = new Ajv();

export const RECOMMENDATION_SCHEMA = {
  type: 'object',
  properties: {
    type: { type: 'string' },
    match_id: { type: 'string' },
    market: { type: 'string' },
    selection: { type: 'string' },
    odds: { type: 'number', minimum: 1.01 },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    stake_recommendation: { type: 'string', enum: ['small','medium','large'] },
    rationale: { type: 'string' }
  },
  required: ['type','match_id','market','selection','odds','confidence','stake_recommendation'],
  additionalProperties: false
};

const validate = ajv.compile(RECOMMENDATION_SCHEMA);

export function validateRecommendation(obj) {
  const ok = validate(obj);
  if (ok) return { valid: true };
  return { valid: false, reason: ajv.errorsText(validate.errors), errors: validate.errors };
}

export default { validateRecommendation, RECOMMENDATION_SCHEMA };
