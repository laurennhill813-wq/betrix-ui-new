import crypto from 'crypto';

function genRef(prefix = 'BNPAY') {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`.toUpperCase();
}

/**
 * Create a Binance order. If BINANCE_PAY_API_URL and BINANCE_PAY_SECRET are configured,
 * attempt a real merchant order creation. Otherwise return a safe placeholder
 * providerRef and checkout URL that the bot can present to users.
 */
export async function createBinanceOrder({ orderId, amount, currency = 'USDT' } = {}) {
  const providerRef = genRef('BNPAY');
  const checkoutUrl = `${process.env.PUBLIC_URL || 'https://betrix.app'}/pay/binance/${providerRef}`;
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(checkoutUrl)}`;

  const apiUrl = process.env.BINANCE_PAY_API_URL || process.env.BINANCE_PAY_API_URL;
  const merchantId = process.env.BINANCE_PAY_MERCHANT_ID || process.env.BINANCE_MERCHANT_ID;
  const apiSecret = process.env.BINANCE_PAY_API_SECRET || process.env.BINANCE_API_SECRET;

  if (apiUrl && merchantId && apiSecret) {
    try {
      const payload = {
        merchantTradeNo: providerRef,
        merchantOrderId: orderId || providerRef,
        currency: currency || 'USDT',
        amount: String(amount),
        goods: { goodsType: '01', goodsName: `BETRIX ${orderId || ''}` }
      };

      const body = JSON.stringify(payload);
      const ts = String(Date.now());
      const nonce = crypto.randomBytes(8).toString('hex');

      // Best-effort signature: HMAC-SHA256 over timestamp + '.' + body
      const signature = crypto.createHmac('sha256', String(apiSecret)).update(ts + '.' + body).digest('hex');

      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'BinancePay-Timestamp': ts,
          'BinancePay-Nonce': nonce,
          'BinancePay-Signature': signature,
          'BinancePay-MerchantId': merchantId
        },
        body
      });

      const data = await resp.json().catch(() => null);
      if (resp.ok && data) {
        const returnRef = data.merchantTradeNo || data.merchantOrderId || providerRef;
        const checkout = data.checkoutUrl || data.qrUrl || checkoutUrl;
        return { providerRef: returnRef, checkoutUrl: checkout, amount, currency, qr: data.qrUrl || qr };
      }
      console.warn('[binance-client] Binance Pay API returned non-OK response', resp.status, data);
    } catch (e) {
      console.warn('[binance-client] Binance Pay API call failed', String(e));
    }
  }

  return { providerRef, checkoutUrl, amount, currency, qr };
}

export default { createBinanceOrder };
