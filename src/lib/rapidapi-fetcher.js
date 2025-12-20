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
    return headers;
  }

  async fetchRapidApi(host, endpoint, opts = {}) {
    if (!host) throw new Error("host required");
    const url = `https://${host}${endpoint}`;
    const headers = this._buildHeaders(host);
    const res = await fetch(url, { method: opts.method || "GET", headers, timeout: opts.timeout || 15000 });
    const httpStatus = res.status;
    let body = null;
    try {
      body = await res.json().catch(() => null);
    } catch (e) {
      body = null;
    }
    return { httpStatus, body, url };
  }
}

export function normalizeRedisKeyPart(s) {
  if (s === undefined || s === null) return "";
  return String(s).replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
}
