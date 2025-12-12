import { getRedis } from '../../lib/redis-factory.js';

const ADMIN_IDS = (process.env.TELEGRAM_ADMINS || '').split(',').filter(Boolean);

export async function handlePrefetchStatus(ctx) {
  const userId = String(ctx.from.id);
  if (!ADMIN_IDS.includes(userId)) return ctx.reply('Not authorized.');

  const redis = getRedis();
  try {
    const failures = await redis.keys('prefetch:failures:*');
    const oddsKeys = await redis.keys('*:odds:*');
    const fixtureKeys = await redis.keys('*:fixtures:*');
    const liveKeys = await redis.keys('*:livescores:*');
    // provider health keys
    const healthKeys = await redis.keys('betrix:provider:health:*');
    const strategies = await redis.keys('betrix:provider:strategy:*');

    const sample = [];
    for (let i = 0; i < Math.min(5, fixtureKeys.length); i++) {
      try {
        const ttl = await redis.ttl(fixtureKeys[i]);
        sample.push(`${fixtureKeys[i]} (ttl:${ttl}s)`);
      } catch (e) {
        sample.push(`${fixtureKeys[i]} (ttl:?)`);
      }
    }

    // gather health details
    const healthDetails = [];
    for (const hk of healthKeys.slice(0, 20)) {
      try {
        const raw = await redis.get(hk);
        const parsed = raw ? JSON.parse(raw) : null;
        healthDetails.push(`${hk.replace('betrix:provider:health:','')}: ${parsed && parsed.ok ? 'OK' : 'FAIL'} ${parsed && parsed.message ? `(${parsed.message})` : ''}`);
      } catch (e) {
        healthDetails.push(`${hk}: ?`);
      }
    }

    const stratDetails = [];
    for (const sk of strategies.slice(0,20)) {
      try {
        const val = await redis.get(sk);
        stratDetails.push(`${sk.replace('betrix:provider:strategy:','')}: ${val}`);
      } catch (e) {
        stratDetails.push(`${sk}: ?`);
      }
    }

    const msg = [
      '🛠 *Prefetch Status*',
      '',
      `✅ Fixtures: ${fixtureKeys.length}`,
      `✅ Livescores: ${liveKeys.length}`,
      `✅ Odds: ${oddsKeys.length}`,
      '',
      failures.length
        ? `❌ Failures (${failures.length}):\n${failures.slice(0,20).join('\n')}`
        : '✅ No failures recorded',
      '',
      `🔎 Sample fixture keys:\n${sample.join('\n')}`,
      '',
      `🔬 Provider health:\n${healthDetails.join('\n') || 'none'}`,
      '',
      `⚙️ Strategies:\n${stratDetails.join('\n') || 'none'}`
    ].join('\n');

    return ctx.reply(msg, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('Failed to build prefetch status', err);
    return ctx.reply('Failed to fetch prefetch status: ' + String(err.message || err));
  }
}
