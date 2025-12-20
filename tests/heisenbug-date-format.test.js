import { formatMMDDYYYY, getNextDaysMMDDYYYY } from '../src/lib/rapidapi-utils.js';

describe('Heisenbug date formatting helpers', () => {
  test('formatMMDDYYYY produces MMddyyyy for today', () => {
    const d = new Date('2025-12-20T00:00:00Z');
    expect(formatMMDDYYYY(d)).toBe('12202025');
  });

  test('getNextDaysMMDDYYYY returns requested count and correct format', () => {
    const arr = getNextDaysMMDDYYYY(3);
    expect(Array.isArray(arr)).toBe(true);
    expect(arr.length).toBe(3);
    for (const s of arr) {
      expect(typeof s).toBe('string');
      expect(s).toMatch(/^[0-9]{8}$/);
    }
  });
});
