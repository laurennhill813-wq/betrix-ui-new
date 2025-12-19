import crypto from "crypto";
import logger from "../utils/logger.js";
import { ensureFetch } from "../lib/fetch-polyfill.js";

const L = logger;

function getApiBase() {
  return process.env.NOWPAYMENTS_API_BASE || "https://api.nowpayments.io/v1";
}

function getApiKey() {
  return process.env.NOWPAYMENTS_API_KEY || null;
}

function getIpnCallback() {
  return process.env.NOWPAYMENTS_IPN_CALLBACK || `${process.env.PUBLIC_HOST_ORIGIN || ""}/webhook/nowpayments`;
}

function assertConfigured() {
  const key = getApiKey();
  if (!key) throw new Error("NOWPAYMENTS_API_KEY not configured");
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
  crypto: payCrypto = "BTC",
  expiresMinutes = 30,
} = {}) {
  assertConfigured();
  const API_BASE = getApiBase();
  const API_KEY = getApiKey();
  const IPN_CALLBACK = getIpnCallback();
  const url = `${API_BASE}/invoice`;

  const body = {
    price_amount: Number(amount),
    price_currency: currency,
    pay_currency: String(payCrypto).toUpperCase(),
    order_id: orderId || `NP-${Date.now()}`,
    order_description: `BETRIX deposit ${orderId || ""}`,
    ipn_callback_url: process.env.NOWPAYMENTS_IPN_CALLBACK || IPN_CALLBACK,
    expires_in: Math.max(60, Math.floor((expiresMinutes || 30) * 60)),
    metadata: { orderId, userId },
  };

  const res = await retry(async () => {
    const fetch = await ensureFetch();
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      const err = new Error(`NowPayments create invoice failed: ${r.status} ${r.statusText} ${txt}`);
      err.status = r.status;
      throw err;
    }
    return await r.json();
  });

  return normalizeInvoiceResponse(res);
}

function normalizeInvoiceResponse(res) {
  const invoice = {
    provider: "NOWPAYMENTS",
    providerRef: res && (res.id || res.invoice_id || res.payment_id || null),
    amount: res && (res.price_amount || res.pay_amount || res.payment_amount || null),
    currency: res && (res.price_currency || res.payment_currency || null),
    cryptoCurrency: res && (res.pay_currency || res.payment_currency || res.payment_currency || null),
    address: res && (res.pay_address || res.payment_address || null),
    status: res && (res.status || res.payment_status || "pending"),
    expiresAt: res && (res.expires_at || res.expiresAt || null),
    checkoutUrl: res && (res.invoice_url || res.url || null),
    raw: res,
  };
  return invoice;
}

async function getInvoice(invoiceId) {
  assertConfigured();
  if (!invoiceId) throw new Error("invoiceId required");
  const API_BASE = getApiBase();
  const API_KEY = getApiKey();
  const url = `${API_BASE}/invoice/${encodeURIComponent(invoiceId)}`;
  const res = await retry(async () => {
    const fetch = await ensureFetch();
    const r = await fetch(url, {
      headers: { "x-api-key": API_KEY },
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      const err = new Error(`NowPayments getInvoice failed: ${r.status} ${r.statusText} ${txt}`);
      err.status = r.status;
      throw err;
    }
    return await r.json();
  });
  return normalizeInvoiceResponse(res);
}

function verifySignature(raw, headerSig) {
  try {
    const API_KEY = getApiKey();
    if (!API_KEY) return false;
    if (!raw) return false;
    const secret = String(API_KEY);
    const h = crypto.createHmac("sha256", secret).update(raw).digest("hex");
    let incoming = String(headerSig || "").trim();
    if (incoming.includes("=")) incoming = incoming.split("=").pop();
    const a = Buffer.from(h, "utf8");
    const b = Buffer.from(incoming, "utf8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (e) {
    L.warn("verifySignature error", e?.message || e);
    return false;
  }
}

export default { createInvoice, getInvoice, normalizeInvoiceResponse, verifySignature };
