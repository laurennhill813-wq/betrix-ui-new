import axios from 'axios';

// Simple alerting helper that posts JSON to a configured webhook URL.
// Non-blocking and forgiving: failure to alert will not throw.
export async function sendAlert(payload = {}) {
  const url = process.env.ALERT_WEBHOOK_URL || null;
  if (!url) {
    // No webhook configured; no-op
    return false;
  }

  try {
    // Post with a short timeout so alerting doesn't block app logic
    await axios.post(url, payload, { timeout: 5000 });
    return true;
  } catch (e) {
    try { console.warn('[alerts] failed to send alert', e?.message || String(e)); } catch(_){}
    return false;
  }
}

export default { sendAlert };
