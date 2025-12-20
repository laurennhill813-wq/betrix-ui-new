import fs from 'fs';
import path from 'path';

describe('subscriptions.json loading', () => {
  test('subscriptions.json exists and contains heisenbug provider', () => {
    const p = path.join(process.cwd(), 'src', 'rapidapi', 'subscriptions.json');
    const raw = fs.readFileSync(p, 'utf8');
    const subs = JSON.parse(raw);
    expect(Array.isArray(subs)).toBe(true);
    const found = subs.find(s => s && String(s.host || '').toLowerCase().includes('heisenbug-premier-league'));
    expect(found).toBeDefined();
  });
});
