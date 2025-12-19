import fetch from "../src/lib/fetch.js";
import crypto from "crypto";
import { config } from "./config.js";
import { uploadTempBuffer, getPresignedUrl } from "./storage.js";

export async function signSportradarAsset(url) {
  if (!config.sportradarKey) throw new Error("Missing SPORTRADAR_API_KEY");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.limits.timeoutMs);

  const headers = {
    "User-Agent": "BETRIX-Signer/1.0",
    "x-api-key": config.sportradarKey,
  };

  let response;
  try {
    response = await fetch(url, { headers, signal: controller.signal });
  } catch (err) {
    throw new Error("Fetch failed: " + (err && err.message));
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok)
    throw new Error(`Sportradar rejected request: ${response.status}`);

  const arr = await response.arrayBuffer();
  const buffer = Buffer.from(arr);

  if (buffer.length > config.limits.maxAssetBytes)
    throw new Error("Asset exceeds MAX_ASSET_MB");

  const ext = guessExt(response.headers.get("content-type")) || "jpg";
  const key = `sportradar/${crypto.randomUUID()}.${ext}`;

  await uploadTempBuffer(
    buffer,
    key,
    response.headers.get("content-type") || "application/octet-stream",
  );

  return getPresignedUrl(key);
}

function guessExt(contentType) {
  if (!contentType) return null;
  const ct = contentType.toLowerCase();
  if (ct.includes("png")) return "png";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  if (ct.includes("gif")) return "gif";
  if (ct.includes("svg")) return "svg";
  return null;
}

export default { signSportradarAsset };
