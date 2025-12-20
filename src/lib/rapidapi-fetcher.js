// Clean RapidAPI fetcher (single export, minimal implementation)
export class RapidApiFetcher {
  constructor({ apiKey } = {}) {
    this.apiKey = apiKey || process.env.RAPIDAPI_KEY || null;
  }

  _buildHeaders(host) {
    const headers = {
      "X-RapidAPI-Key": this.apiKey || "",
      "X-RapidAPI-Host": host,
      Accept: "application/json",
    };
    try {
      const hostNorm = String(host || "").toLowerCase();
      if (hostNorm.includes("the-odds-api.com") || hostNorm.includes("api.the-odds-api.com")) {
        const theOddsKey = process.env.THEODDS_API_KEY || process.env.THEODDS_KEY || this.apiKey || process.env.RAPIDAPI_KEY || "";
        headers["x-api-key"] = theOddsKey;
      }
    } catch (e) {}
    return headers;
  }

  async fetchRapidApi(host, endpoint, opts = {}) {
    if (!host) throw new Error("host required");
    const url = `https://${host}${endpoint}`;
    const headers = this._buildHeaders(host);
    const maxAttempts = Math.max(1, Number(opts.retries || 1));
    const timeoutMs = Number(opts.timeout || 15000);
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      let timeoutHandle = null;
      try {
        const fetchOpts = { method: opts.method || "GET", headers };
        if (controller) {
          fetchOpts.signal = controller.signal;
          timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
        }
        const res = await fetch(url, fetchOpts);
        const httpStatus = res.status;
        let body = null;
        try { body = await res.json().catch(() => null); } catch (e) { body = null; }
        const hdrs = {};
        try { if (res && res.headers && typeof res.headers.entries === "function") for (const [k, v] of res.headers.entries()) hdrs[k] = v; } catch (e) {}
        if (timeoutHandle) clearTimeout(timeoutHandle);
        return { httpStatus, body, url, headers: hdrs };
      } catch (err) {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        try { console.warn("[rapidapi-fetcher-error]", err && err.message ? err.message : String(err)); } catch (e) {}
        if (attempt >= maxAttempts) return { httpStatus: null, body: null, url, error: { message: err && err.message ? err.message : String(err) } };
        const backoffBase = Number(opts.backoffBaseMs || 200);
        const delay = Math.min(10000, backoffBase * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 200));
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    return { httpStatus: null, body: null, url };
  }
}

export function normalizeRedisKeyPart(s) {
  if (s === undefined || s === null) return "";
  return String(s).replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
}
// Generic RapidAPI fetcher
export class RapidApiFetcher {
  constructor({ apiKey } = {}) {
    this.apiKey = apiKey || process.env.RAPIDAPI_KEY || null;
  }

  _buildHeaders(host) {
    const headers = {
      "X-RapidAPI-Key": this.apiKey || "",
      "X-RapidAPI-Host": host,
      "Accept": "application/json",
    };
    // The Odds API (direct) expects an `x-api-key` header, not X-RapidAPI-Key.
    try {
      const hostNorm = String(host || "").toLowerCase();
      if (hostNorm.includes("the-odds-api.com") || hostNorm.includes("api.the-odds-api.com")) {
        const theOddsKey = process.env.THEODDS_API_KEY || process.env.THEODDS_KEY || this.apiKey || process.env.RAPIDAPI_KEY || "";
        headers["x-api-key"] = theOddsKey;
      }
    } catch (e) {}
    return headers;
  }

  // Enhanced fetch with optional retries, timeout and verbose error logging.
  async fetchRapidApi(host, endpoint, opts = {}) {
    if (!host) throw new Error("host required");
    const url = `https://${host}${endpoint}`;
    const headers = this._buildHeaders(host);

    const maxAttempts = Math.max(1, Number(opts.retries || 1));
    const timeoutMs = Number(opts.timeout || 15000);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      let timeoutHandle = null;
      try {
        const fetchOpts = {
          method: opts.method || "GET",
          headers,
        };
        if (controller) {
          fetchOpts.signal = controller.signal;
          timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
        }
        // Clean RapidAPI fetcher module
        export class RapidApiFetcher {
          constructor({ apiKey } = {}) {
            this.apiKey = apiKey || process.env.RAPIDAPI_KEY || null;
          }

          _buildHeaders(host) {
            const headers = {
              "X-RapidAPI-Key": this.apiKey || "",
              "X-RapidAPI-Host": host,
              Accept: "application/json",
            };
            try {
              const hostNorm = String(host || "").toLowerCase();
              if (hostNorm.includes("the-odds-api.com") || hostNorm.includes("api.the-odds-api.com")) {
                const theOddsKey = process.env.THEODDS_API_KEY || process.env.THEODDS_KEY || this.apiKey || process.env.RAPIDAPI_KEY || "";
                headers["x-api-key"] = theOddsKey;
              }
            } catch (e) {}
            return headers;
          }

          async fetchRapidApi(host, endpoint, opts = {}) {
            if (!host) throw new Error("host required");
            const url = `https://${host}${endpoint}`;
            const headers = this._buildHeaders(host);
            const maxAttempts = Math.max(1, Number(opts.retries || 1));
            const timeoutMs = Number(opts.timeout || 15000);
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
              const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
              let timeoutHandle = null;
              try {
                const fetchOpts = { method: opts.method || "GET", headers };
                if (controller) {
                  fetchOpts.signal = controller.signal;
                  timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
                }
                const res = await fetch(url, fetchOpts);
                const httpStatus = res.status;
                let body = null;
                try { body = await res.json().catch(() => null); } catch (e) { body = null; }
                const hdrs = {};
                try { if (res && res.headers && typeof res.headers.entries === "function") for (const [k, v] of res.headers.entries()) hdrs[k] = v; } catch (e) {}
                if (timeoutHandle) clearTimeout(timeoutHandle);
                return { httpStatus, body, url, headers: hdrs };
              } catch (err) {
                if (timeoutHandle) clearTimeout(timeoutHandle);
                try { console.warn("[rapidapi-fetcher-error]", err && err.message ? err.message : String(err)); } catch (e) {}
                if (attempt >= maxAttempts) return { httpStatus: null, body: null, url, error: { message: err && err.message ? err.message : String(err) } };
                const backoffBase = Number(opts.backoffBaseMs || 200);
                const delay = Math.min(10000, backoffBase * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 200));
                await new Promise((r) => setTimeout(r, delay));
              }
            }
            return { httpStatus: null, body: null, url };
          }
        }

        export function normalizeRedisKeyPart(s) {
          if (s === undefined || s === null) return "";
          return String(s).replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
        }
        };
