import assert from 'assert';
import { markPosted, getMetrics } from '../src/lib/liveliness.js';

async function run() {
  console.log('\n🧪 liveliness module tests...');
  try {
    await markPosted();
    const metrics = await getMetrics();
    assert(metrics, 'metrics returned');
    assert(typeof metrics.postsThisHour === 'number', 'postsThisHour is a number');
    assert(metrics.postsThisHour >= 0, 'postsThisHour non-negative');
    assert(metrics.lastPostAt === null || typeof metrics.lastPostAt === 'number', 'lastPostAt is number or null');
    console.log('✅ liveliness tests passed');
    process.exit(0);
  } catch (err) {
    console.error('❌ liveliness tests failed', err && err.message);
    process.exit(1);
  }
}

if (typeof require !== 'undefined' ? require.main === module : import.meta.url === `file://${process.argv[1]}`) run();
