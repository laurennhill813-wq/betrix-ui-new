import fetch from 'node-fetch';

export async function callProvider({ base, path, auth = {}, key }, { timeoutMs = 30000 } = {}) {
  let url = `${base}${path}`;
  const opts = { headers: {} };

  if (auth.method === 'query' && key) {
    const sep = url.includes('?') ? '&' : '?';
    url = `${url}${sep}${auth.queryParam}=${encodeURIComponent(key)}`;
  } else if (auth.method === 'header' && key) {
    opts.headers[auth.headerName || 'Api-Key'] = key;
  }

  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    opts.signal = controller.signal;
    const res = await fetch(url, opts);
    clearTimeout(id);

    const text = await res.text();
    const headers = Object.fromEntries(res.headers.entries());
    let json = null;
    try { json = JSON.parse(text); } catch (e) { /* non-json body */ }

    return { ok: res.ok, status: res.status, headers, bodyText: text, body: json };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}
