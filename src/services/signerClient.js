import fetch from "node-fetch";

// Generic signer client that can be used for any provider URL.
// It prefers `SIGN_ENDPOINT` but falls back to the older SPORTRADAR_* vars for compatibility.
export async function signUrl(url, opts = {}) {
  const endpoint =
    process.env.SIGN_ENDPOINT ||
    process.env.SPORTRADAR_SIGN_ENDPOINT ||
    process.env.SPORTRADAR_SIGNER_ENDPOINT;
  if (!endpoint)
    throw new Error(
      "SIGN_ENDPOINT (or SPORTRADAR_SIGN_ENDPOINT) not configured",
    );

  const payload = Object.assign({ url }, opts || {});
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`signer error ${res.status} ${t}`);
  }
  return await res.json();
}

export default { signUrl };
