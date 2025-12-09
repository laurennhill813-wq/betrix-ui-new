import fs from 'fs';
import path from 'path';

const LOG_PATH = path.join(process.cwd(), 'logs', 'lipana-stk.log');
const OUT_PATH = path.join(process.cwd(), 'tmp', 'lipana-escalation.json');

function readLines(p) {
  try {
    if (!fs.existsSync(p)) return [];
    return fs.readFileSync(p, 'utf8').split(/\r?\n/).filter(Boolean).map(l => {
      try { return JSON.parse(l); } catch { return { raw: l }; }
    });
  } catch (e) { return []; }
}

function gatherTransactionIds(entries) {
  const ids = [];
  for (const e of entries) {
    try {
      const body = e.request && e.request.body;
      const resp = e.response && e.response.body;
      if (resp && resp.data && resp.data.transactionId) ids.push({ txn: resp.data.transactionId, _id: resp.data._id });
    } catch (e) { /* skip */ }
  }
  return ids;
}

async function main() {
  try {
    const lines = readLines(LOG_PATH).slice(-200);
    const txns = gatherTransactionIds(lines);
    const artifact = {
      createdAt: (new Date()).toISOString(),
      env: {
        callback: process.env.LIPANA_CALLBACK_URL || process.env.MPESA_CALLBACK_URL || null
      },
      transactions: txns,
      logs: lines
    };

    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    fs.writeFileSync(OUT_PATH, JSON.stringify(artifact, null, 2), 'utf8');
    console.log('Prepared escalation artifact at', OUT_PATH);
    console.log('Transactions included:', txns.length);
    txns.slice(0, 10).forEach(t => console.log(' -', t.txn, t._id));
  } catch (e) {
    console.error('Failed to prepare escalation artifact:', e?.message || e);
    process.exit(2);
  }
}

main();
