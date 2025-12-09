#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import crypto from 'node:crypto';

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const idx = trimmed.indexOf('=');
    let key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

const repoRoot = path.resolve(new URL(import.meta.url).pathname.replace(/^\/?([A-Za-z]:)?/,'').replace(/scripts\/validate-payments.mjs$/,''));
// look for env.render or .env.render
const envRender = path.resolve(process.cwd(), 'env.render');
if (fs.existsSync(envRender)) {
  console.log('Loading env from', envRender);
  loadEnvFile(envRender);
}

async function validatePayPal() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const mode = (process.env.PAYPAL_MODE || 'sandbox').toLowerCase();
  if (!clientId || !clientSecret) {
    console.log('PayPal: credentials not configured (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET)');
    return { ok: false, reason: 'missing_credentials' };
  }

  console.log(`PayPal: attempting SDK create order (mode=${mode})`);
  try {
    const paypalModule = await import('@paypal/checkout-server-sdk');
    const paypal = paypalModule.default || paypalModule;
    const environment = (mode === 'live' || mode === 'production')
      ? new paypal.core.LiveEnvironment(clientId, clientSecret)
      : new paypal.core.SandboxEnvironment(clientId, clientSecret);
    const client = new paypal.core.PayPalHttpClient(environment);

    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer('return=representation');
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [{ amount: { currency_code: 'USD', value: '1.00' } }],
      application_context: { return_url: process.env.PAYPAL_RETURN_URL || 'https://betrix.app/pay/complete', cancel_url: process.env.PAYPAL_CANCEL_URL || 'https://betrix.app/pay/cancel' }
    });

    const resp = await client.execute(request);
    const result = resp.result || resp;
    const id = result.id || (result && result.result && result.result.id);
    const links = result.links || result.result?.links || [];
    const approval = (Array.isArray(links) && links.find(l => l.rel === 'approve')) || links.find(l => l.rel === 'approve') || links.find(l => /approve/i.test(l.rel));
    console.log('PayPal: created order id:', id);
    if (approval && approval.href) console.log('PayPal: approval url:', approval.href);
    return { ok: true, id, approval: approval?.href };
  } catch (err) {
    console.error('PayPal: SDK test failed:', err?.message || err);
    return { ok: false, reason: 'sdk_error', error: String(err) };
  }
}

async function validateBinance() {
  const key = process.env.BINANCE_API_KEY;
  const secret = process.env.BINANCE_API_SECRET;
  console.log('Binance: testing public connectivity to api.binance.com');
  try {
    const ping = await fetch('https://api.binance.com/api/v3/ping');
    if (!ping.ok) {
      console.log('Binance: public ping failed', ping.status);
      return { ok: false, reason: 'ping_failed', status: ping.status };
    }
  } catch (err) {
    console.log('Binance: network error during ping:', err?.message || err);
    return { ok: false, reason: 'network_error', error: String(err) };
  }

  if (!key || !secret) {
    console.log('Binance: API keys not configured (BINANCE_API_KEY / BINANCE_API_SECRET)');
    return { ok: false, reason: 'missing_credentials' };
  }

  // Attempt to call /api/v3/account which requires signed request
  try {
    const ts = Date.now();
    const qs = `timestamp=${ts}`;
    const sig = crypto.createHmac('sha256', secret).update(qs).digest('hex');
    const url = `https://api.binance.com/api/v3/account?${qs}&signature=${sig}`;
    const resp = await fetch(url, { headers: { 'X-MBX-APIKEY': key } });
    const text = await resp.text();
    if (!resp.ok) {
      console.log('Binance: /account returned', resp.status, text.substring(0, 400));
      return { ok: false, reason: 'account_failed', status: resp.status, body: text };
    }
    let body = null;
    try { body = JSON.parse(text); } catch (e) { body = text; }
    // Mask sensitive fields
    if (body && body.balances) body.balances = "<masked>";
    console.log('Binance: account read succeeded (masked):', typeof body === 'string' ? body.substring(0,200) : JSON.stringify(body).slice(0,400));
    return { ok: true };
  } catch (err) {
    console.log('Binance: signed request failed:', err?.message || err);
    return { ok: false, reason: 'signed_error', error: String(err) };
  }
}

async function main() {
  console.log('\n=== Payment provider validation script ===\n');
  const paypalResult = await validatePayPal();
  console.log('\n---\n');
  const binanceResult = await validateBinance();
  console.log('\nSummary:');
  console.log('PayPal:', paypalResult);
  console.log('Binance:', binanceResult);
  console.log('\nIf credentials are missing, add them to your Render environment or local env.render file.');
}

main().catch(e => { console.error('Fatal error', e); process.exit(1); });
