NowPayments integration

This module integrates NowPayments for crypto deposits.

Environment

- NOWPAYMENTS_API_KEY: Your NowPayments API key (do not commit)
- NOWPAYMENTS_API_BASE: Optional; override API base URL
- NOWPAYMENTS_IPN_CALLBACK: Optional; override IPN callback URL (defaults to /webhook/nowpayments)

How it works

- `createInvoice` creates a NowPayments invoice for BTC/ETH/USDT and returns a normalized object with `address`, `amount`, `cryptoCurrency`, `providerRef`, and `expiresAt`.
- The server exposes `/webhook/nowpayments` to receive IPN events from NowPayments. The webhook verifies the signature using HMAC-SHA256 with `NOWPAYMENTS_API_KEY` and then attempts to credit the corresponding local order by calling `verifyAndActivatePayment`.

Notes

- Do NOT hardcode your API key. Store it in environment variables or your secrets manager.
- The module uses a best-effort verification using HMAC-SHA256 of the raw request body.
- Invoice expiry is set to 30 minutes by default.
