import 'dotenv/config';
import aggregator from '../src/aggregator.js';

async function main() {
  try {
    const provider = process.env.TEST_PROVIDER || 'sportradar';
    const eventId = process.env.TEST_EVENT_ID;
    if (!eventId) {
      console.error('Please set TEST_EVENT_ID env var to a known Sportradar event id');
      process.exit(2);
    }

    console.log('Running pipeline for', provider, eventId);
    const res = await aggregator.runPipeline(provider, eventId, 'BETRIX pipeline test');
    console.log('Pipeline result:', JSON.stringify(res, null, 2));
  } catch (e) {
    console.error('End-to-end pipeline failed:', e && e.message ? e.message : e);
    process.exit(1);
  }
}

main();
