import fetch from 'node-fetch';

const LIPANA_BASE = process.env.LIPANA_API_BASE || 'https://api.lipana.dev';
// For server-side transaction creation Lipana expects the publishable key in 'x-api-key'
const LIPANA_PUBLISHABLE = process.env.LIPANA_API_KEY || '';

async function _safeJson(resp) {
  try { return await resp.json(); } catch (e) { return null; }
}

async function stkPush({ amount, phone, reference, tx_ref, callback_url }) {
  if (!LIPANA_PUBLISHABLE) throw new Error('LIPANA_API_KEY (publishable) not set');

  const url = `${LIPANA_BASE}/v1/transactions`;
  const body = {
    amount,
    phone,
    reference: reference || tx_ref || `betrix_${Date.now()}`,
    callback_url: callback_url || undefined
  };

  // Masking helpers for safe logs
  function maskPhone(p) {
    try {
      const s = String(p || '');
      return s.replace(/(\d{3})\d+(\d{2})/, '$1****$2');
    } catch { return '(masked)'; }
  }
  function maskKey(k) {
    if (!k) return '(missing)';
    const s = String(k);
    if (s.length <= 8) return '****';
    return `${s.slice(0,4)}…${s.slice(-4)}`;
  }

  // Log a masked request snapshot for diagnostics
  try {
    console.log('[LIPANA_STK_REQ]', JSON.stringify({
      url,
      body: { phone: maskPhone(body.phone), amount: body.amount, reference: body.reference, callback_url: body.callback_url },
      headers: { 'x-api-key': maskKey(LIPANA_PUBLISHABLE) }
    }));
  } catch (e) { /* ignore logging errors */ }

  let resp; let parsed;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': LIPANA_PUBLISHABLE
      },
      body: JSON.stringify(body)
    });
    parsed = await _safeJson(resp);
  } catch (e) {
    // Network / timeout / fetch error
    try { console.error('[LIPANA_STK_ERR]', String(e)); } catch {};
    return { status: 0, error: String(e), raw: null };
  }

  // Log response snapshot
  try {
    console.log('[LIPANA_STK_RES]', JSON.stringify({ status: resp.status, ok: resp.ok, body: parsed }));
  } catch (e) { /* ignore logging errors */ }

  // Normalize response shape for callers
  if (!resp.ok) {
    return { status: resp.status, error: (parsed && parsed.error) ? parsed.error : parsed || `HTTP ${resp.status}`, raw: parsed };
  }

  return { status: resp.status, raw: parsed || null };
}

async function getTransaction(transactionId) {
  if (!LIPANA_PUBLISHABLE) throw new Error('LIPANA_API_KEY (publishable) not set');
  const url = `${LIPANA_BASE}/v1/transactions/${encodeURIComponent(String(transactionId))}`;
  let resp; let parsed;
  try {
    resp = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': LIPANA_PUBLISHABLE
      }
    });
    parsed = await _safeJson(resp);
  } catch (e) {
    return { status: 0, error: String(e), raw: null };
  }
  if (!resp.ok) return { status: resp.status, error: parsed || `HTTP ${resp.status}`, raw: parsed };
  return { status: resp.status, raw: parsed || null };
}

// Lightweight connectivity check: call base URL or probe endpoint
async function ping() {
  const url = LIPANA_BASE;
  try {
    const resp = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    return { ok: true, status: resp.status };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export default { stkPush, getTransaction, ping };
