import fetch from "node-fetch";

/**
 * callProvider: low-level HTTP helper with retries and basic backoff.
 * Retries on 429/502/503/504 and on transient network errors.
 * Respects `Retry-After` header when present.
 */
export async function callProvider(
  { base, path, auth = {}, key },
  { timeoutMs = 30000, attempts = 3, backoffMs = 300 } = {},
) {
  let url = `${base}${path}`;
  const baseOpts = { headers: {} };

  if (auth.method === "query" && key) {
    const sep = url.includes("?") ? "&" : "?";
    url = `${url}${sep}${auth.queryParam}=${encodeURIComponent(key)}`;
  } else if (auth.method === "header" && key) {
    baseOpts.headers[auth.headerName || "Api-Key"] = key;
  }

  const shouldRetryStatus = (status) => [429, 502, 503, 504].includes(status);

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const opts = Object.assign({}, baseOpts);
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      opts.signal = controller.signal;

      const res = await fetch(url, opts);
      clearTimeout(id);

      const text = await res.text();
      const headers = Object.fromEntries(res.headers.entries());
      let json = null;
      try {
        json = JSON.parse(text);
      } catch (e) {
        /* non-json body */
      }

      // If the status indicates transient failure and we have more attempts, honor Retry-After
      if (shouldRetryStatus(res.status) && attempt < attempts) {
        // parse Retry-After if present (seconds)
        const ra = headers["retry-after"];
        let wait = backoffMs * Math.pow(2, attempt - 1);
        if (ra) {
          const raNum = Number(String(ra).trim());
          if (!Number.isNaN(raNum) && raNum > 0)
            wait = Math.max(wait, raNum * 1000);
        }
        // jitter
        wait = wait + Math.floor(Math.random() * Math.min(1000, wait));
        await new Promise((r) => setTimeout(r, wait));
        continue; // retry
      }

      return {
        ok: res.ok,
        status: res.status,
        headers,
        bodyText: text,
        body: json,
      };
    } catch (err) {
      // network or abort error
      if (attempt < attempts) {
        const wait =
          backoffMs * Math.pow(2, attempt - 1) +
          Math.floor(Math.random() * 200);
        await new Promise((r) => setTimeout(r, wait));
        continue; // retry
      }
      return { ok: false, error: err.message || String(err) };
    }
  }

  return { ok: false, error: "Failed after retries" };
}
