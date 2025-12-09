#!/usr/bin/env node
import crypto from 'crypto';
import fetch from 'node-fetch';

function usage() {
  console.error('Usage: node scripts/send-signed-webhook.mjs --url <url> --txn <providerRef> [--phone <phone>] [--amount <n>]');
  process.exit(2);
}

const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--url') args.url = argv[++i];
  else if (a === '--txn') args.txn = argv[++i];
  else if (a === '--phone') args.phone = argv[++i];
  else if (a === '--amount') args.amount = Number(argv[++i]);
}

if (!args.url || !args.txn) usage();

const secret = process.env.LIPANA_WEBHOOK_SECRET || process.env.MPESA_WEBHOOK_SECRET || '';
if (!secret) console.warn('Warning: LIPANA_WEBHOOK_SECRET not set in env; sending unsigned webhook (app may reject)');

const payload = {
  transaction_id: args.txn,
  providerRef: args.txn,
  reference: args.txn,
  amount: args.amount || 150,
  phone: args.phone || '+254700000000',
  status: 'success',
  timestamp: new Date().toISOString()
};

const raw = Buffer.from(JSON.stringify(payload), 'utf8');
let sigHeader = '';
if (secret) {
  const h = crypto.createHmac('sha256', String(secret)).update(raw).digest();
  sigHeader = h.toString('hex');
}

console.log('Posting signed webhook to', args.url, 'txn=', args.txn);

try {
  const res = await fetch(args.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(sigHeader ? { 'x-lipana-signature': sigHeader } : {})
    },
    body: raw
  });
  const text = await res.text();
  console.log('Response status:', res.status);
  console.log(text);
} catch (e) {
  console.error('Error posting webhook:', e?.message || e);
  process.exit(3);
}
