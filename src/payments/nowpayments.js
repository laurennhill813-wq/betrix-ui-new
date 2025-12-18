import fetch from "node-fetch";
import crypto from "crypto";
import logger from "../utils/logger.js";

const L = new logger("NowPayments");

const API_BASE =
  process.env.NOWPAYMENTS_API_BASE || "https://api.nowpayments.io/v1";
const API_KEY = process.env.NOWPAYMENTS_API_KEY || null;

function assertConfigured() {
  if (!API_KEY) throw new Error("NOWPAYMENTS_API_KEY not configured");
}

async function retry(fn, attempts = 3, backoff = 300) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, backoff * (i + 1)));
    }
  }
  throw lastErr;
}

async function createInvoice({
  amount,
  currency = "USD",
  orderId,
  userId,
  crypto = "BTC",
  expiresMinutes = 30,
}) {
  assertConfigured();
  const url = `${API_BASE}/invoice`;

  const body = {
    price_amount: Number(amount),
    price_currency: currency,
    pay_currency: crypto,
    order_id: orderId || `NP-${Date.now()}`,
    order_description: `BETRIX deposit ${orderId || ""}`,
    ipn_callback_url:
      process.env.NOWPAYMENTS_IPN_CALLBACK ||
      `${process.env.PUBLIC_URL || ""}/webhook/nowpayments`,
    expires_in: Math.max(60, Math.floor((expiresMinutes || 30) * 60)),
    metadata: { orderId, userId },
  };

  const res = await retry(async () => {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify(body),
      timeout: 15000,
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      const err = new Error(
        `NowPayments create invoice failed: ${r.status} ${r.statusText} ${txt}`,
      );
      err.status = r.status;
      throw err;
    }
    return await r.json();
  });

  // Normalized shape
  return normalizeInvoiceResponse(res);
}

function normalizeInvoiceResponse(res) {
  // NowPayments responses include id, price_amount, pay_amount, pay_address, pay_currency, expires_at
  const invoice = {
    provider: "NOWPAYMENTS",
    providerRef: res && (res.id || res.invoice_id || null),
    amount: res && (res.price_amount || res.pay_amount || null),
    currency: res && (res.price_currency || null),
    cryptoCurrency: res && (res.pay_currency || null),
    address: res && (res.pay_address || null),
    status: res && (res.status || "pending"),
    expiresAt: res && (res.expires_at || null),
    checkoutUrl: res && (res.invoice_url || res.url || null),
    raw: res,
  };
  return invoice;
}

async function getInvoice(invoiceId) {
  assertConfigured();
  if (!invoiceId) throw new Error("invoiceId required");
  const url = `${API_BASE}/invoice/${encodeURIComponent(invoiceId)}`;
  const res = await retry(async () => {
    const r = await fetch(url, {
      headers: { "x-api-key": API_KEY },
      timeout: 10000,
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      const err = new Error(
        `NowPayments get invoice failed: ${r.status} ${r.statusText} ${txt}`,
      );
      err.status = r.status;
      throw err;
    }
    return await r.json();
  });
  return normalizeInvoiceResponse(res);
}

function verifySignature(rawBodyBuf, headerSignature) {
  try {
    if (!API_KEY) return false;
    if (!headerSignature) return false;
    const computed = crypto
      .createHmac("sha256", API_KEY)
      .update(rawBodyBuf)
      .digest("hex");
    try {
      return crypto.timingSafeEqual(
        Buffer.from(computed),
        Buffer.from(headerSignature),
      );
    } catch (e) {
      return false;
    }
  } catch (e) {
    L.warn("signature verification failed", e?.message || e);
    return false;
  }
}

export default { createInvoice, getInvoice, verifySignature };
