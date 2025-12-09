import { createBinanceOrder } from '../src/lib/binance-client.js';

async function run() {
  const res = await createBinanceOrder({ orderId: 'TEST-ORDER-123', amount: 1.5, currency: 'USDT' });
  console.log('Binance order result:', JSON.stringify(res, null, 2));
}

run().catch(e => { console.error(e); process.exit(1); });
