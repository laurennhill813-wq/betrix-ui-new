// Sportradar image exchange stub.
// If your deployment needs to call a signing endpoint to obtain a time-limited
// download URL for a Sportradar asset, set `SPORTRADAR_SIGN_ENDPOINT` to an
// internal service that accepts { url } and returns { signedUrl }.

import fetch from 'node-fetch';

const SIGN_ENDPOINT = process.env.SPORTRADAR_SIGN_ENDPOINT || null;

export async function getSignedDownloadUrl(assetUrl) {
  if (!SIGN_ENDPOINT) return null; // no signing configured
  try {
    const res = await fetch(SIGN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: assetUrl })
    });
    if (!res.ok) return null;
    const j = await res.json();
    return j && (j.signedUrl || j.url || null);
  } catch (e) {
    return null;
  }
}

export default { getSignedDownloadUrl };
