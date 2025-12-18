import axios from "axios";

// Generic Image Provider
// Configure via environment variables per-provider. This module attempts a
// best-effort search call and returns a single image URL when available.

const DEFAULT_SEARCH_PATH = process.env.IMAGE_SERVICE_SEARCH_PATH || "/search";
const BASE =
  process.env.IMAGE_SERVICE_BASE || process.env.IMAGE_SERVICE_URL || null;
const KEY = process.env.IMAGE_SERVICE_KEY || null;
const KEY_HEADER = process.env.IMAGE_SERVICE_KEY_HEADER || "Authorization";
const RESULT_FIELD = process.env.IMAGE_SERVICE_RESULT_FIELD || null; // optional path like 'items.0.url' or 'data.0.image_url'

function extractByField(obj, path) {
  if (!path) return null;
  const parts = String(path).split(".");
  let cur = obj;
  for (const p of parts) {
    if (!cur) return null;
    // allow numeric indices
    const idx = Number.isNaN(Number(p)) ? p : Number(p);
    cur = cur[idx];
  }
  return cur;
}

async function findImage({ q = "sports", limit = 1, extras = {} } = {}) {
  if (!BASE) return null;

  try {
    const url = `${BASE.replace(/\/+$/, "")}${DEFAULT_SEARCH_PATH}`;
    const headers = {};
    if (KEY)
      headers[KEY_HEADER] = KEY.startsWith("Bearer ") ? KEY : `Bearer ${KEY}`;

    const params = Object.assign({ q, limit }, extras);
    const resp = await axios.get(url, { params, headers, timeout: 10_000 });
    const body = resp && resp.data ? resp.data : null;
    if (!body) return null;

    // 1) If RESULT_FIELD configured, use it
    if (RESULT_FIELD) {
      const v = extractByField(body, RESULT_FIELD);
      if (Array.isArray(v) && v.length > 0 && typeof v[0] === "string")
        return v[0];
      if (typeof v === "string" && v) return v;
    }

    // 2) Common shapes: items[], data[]
    const candidates = [];
    if (Array.isArray(body.items)) candidates.push(...body.items);
    if (Array.isArray(body.data)) candidates.push(...body.data);
    if (typeof body.url === "string") candidates.push({ url: body.url });

    for (const c of candidates) {
      if (!c) continue;
      if (typeof c === "string" && c.startsWith("http")) return c;
      if (c.url && typeof c.url === "string") return c.url;
      if (c.image_url && typeof c.image_url === "string") return c.image_url;
      if (c.thumbnail && typeof c.thumbnail === "string") return c.thumbnail;
    }

    // 3) As a last resort, try first-level keys looking like URLs
    for (const k of Object.keys(body)) {
      const v = body[k];
      if (
        typeof v === "string" &&
        v.startsWith("http") &&
        /\.(jpg|jpeg|png|gif|webp)(?:\?|$)/i.test(v)
      )
        return v;
    }

    return null;
  } catch (e) {
    // Do not throw — just return null if provider fails
    return null;
  }
}

export default { findImage };
