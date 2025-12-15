import assert from 'assert';

async function run() {
  console.log('\n🧪 auto-media-ticker smoke test...');
  try {
    // Import and call the job; when BOT_BROADCAST_CHAT_ID is not set it will skip safely
    const mod = await import('../src/jobs/auto-media-ticker.js');
    await mod.runAutoMediaTick();
    console.log('✅ auto-media-ticker ran (no-op path)');
    process.exit(0);
  } catch (err) {
    console.error('❌ auto-media-ticker test failed', err && err.message);
    process.exit(1);
  }
}

if (typeof require !== 'undefined' ? require.main === module : import.meta.url === `file://${process.argv[1]}`) run();
