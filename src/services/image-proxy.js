import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import fetch from "../lib/fetch.js";
import { getSignedDownloadUrl } from "../data/images-sportradar-exchange.js";

const CACHE_DIR =
  process.env.IMAGE_PROXY_CACHE_DIR ||
  path.join(os.tmpdir(), "betrix-image-cache");
const CACHE_TTL_MS = Number(process.env.IMAGE_PROXY_TTL_MS || 1000 * 60 * 60); // 1 hour
const SPORTRADAR_KEY =
  process.env.SPORTRADAR_API_KEY || process.env.IMAGE_SERVICE_KEY || null;

// Ensure cache dir exists
try {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
} catch (e) {}

function cachePathFor(url) {
  const h = crypto.createHash("sha1").update(url).digest("hex");
  return path.join(CACHE_DIR, h);
}

async function statSafe(p) {
  try {
    return await fs.promises.stat(p);
  } catch (e) {
    return null;
  }
}

// Fetch a remote image (with Sportradar-specific key appending and UA) and store locally.
// Returns { path, contentType } on success, or null on failure.
export async function fetchAndCacheImage(url) {
  if (!url) return null;
  const cue = cachePathFor(url);
  const metaPath = cue + ".meta.json";

  // If cached and fresh, return it
  const st = await statSafe(cue);
  if (st) {
    const now = Date.now();
    if (now - st.mtimeMs < CACHE_TTL_MS) {
      // read meta
      try {
        const metaRaw = await fs.promises.readFile(metaPath, "utf8");
        const meta = JSON.parse(metaRaw);
        return {
          path: cue,
          contentType: meta.contentType || "application/octet-stream",
        };
      } catch (e) {
        return { path: cue, contentType: "application/octet-stream" };
      }
    }
  }

  // Build fetch URL: append api_key if sportradar and missing
  let fetchUrl = url;
  const isSportradar = String(url || "")
    .toLowerCase()
    .includes("sportradar");
  if (isSportradar && SPORTRADAR_KEY && !fetchUrl.includes("api_key=")) {
    fetchUrl =
      fetchUrl +
      (fetchUrl.includes("?")
        ? `&api_key=${SPORTRADAR_KEY}`
        : `?api_key=${SPORTRADAR_KEY}`);
  }

  // Try multiple header strategies for protected providers (Sportradar, Reuters, Getty)
  const baseHeaders = {
    "User-Agent": "BetrixBot/1.0 (+https://betrix.example)",
    Accept: "*/*",
  };
  const headerStrategies = [];
  // default
  headerStrategies.push(baseHeaders);
  // X-API-Key header (some provider endpoints prefer header)
  if (SPORTRADAR_KEY)
    headerStrategies.push({ ...baseHeaders, "X-API-Key": SPORTRADAR_KEY });
  // Referer + Origin variations
  headerStrategies.push({
    ...baseHeaders,
    Referer: "https://developer.sportradar.com/",
  });
  headerStrategies.push({ ...baseHeaders, Referer: "https://sportradar.com/" });
  // Combined strategies
  if (SPORTRADAR_KEY)
    headerStrategies.push({
      ...baseHeaders,
      "X-API-Key": SPORTRADAR_KEY,
      Referer: "https://developer.sportradar.com/",
    });

  let res = null;
  let lastErr = null;
  for (const headers of headerStrategies) {
    try {
      res = await fetch(fetchUrl, {
        redirect: "follow",
        headers,
        timeout: 15000,
      });
    } catch (err) {
      lastErr = err;
      // try next header strategy
      console.warn(
        "[image-proxy] fetch error for",
        fetchUrl,
        "headers=",
        headers,
        "err=",
        err && err.message,
      );
      res = null;
    }
    if (res) {
      if (!res.ok) {
        // Log details and try next strategy
        console.warn(
          "[image-proxy] non-ok response",
          res.status,
          res.statusText,
          "for",
          fetchUrl,
        );
        // If 403, try next strategy
        // if Sportradar and we got 403 we'll try a signed-url exchange below after strategies
        res = null;
        continue;
      }
      // got a successful response
      break;
    }
  }
  if (!res) {
    // If this looks like a Sportradar asset and we have a signing endpoint, try exchange
    if (isSportradar) {
      try {
        const signed = await getSignedDownloadUrl(fetchUrl);
        if (signed) {
          try {
            const r2 = await fetch(signed, {
              redirect: "follow",
              headers: {
                "User-Agent": "BetrixBot/1.0 (+https://betrix.example)",
                Accept: "*/*",
              },
              timeout: 15000,
            });
            if (r2 && r2.ok) {
              res = r2;
              // replace fetchUrl with signed for meta
              fetchUrl = signed;
            }
          } catch (e) {
            // ignore and fall through to write diag
            console.warn(
              "[image-proxy] signed-url fetch failed",
              e && e.message,
            );
          }
        }
      } catch (e) {
        // ignore exchange errors
        console.warn("[image-proxy] exchange attempt failed", e && e.message);
      }
    }
  }
  if (!res) {
    // final diagnostic log
    console.warn(
      "[image-proxy] failed to fetch",
      fetchUrl,
      "lastErr=",
      lastErr && lastErr.message,
    );
    // write a diagnostic file to help provider debugging
    try {
      const diag = {
        url: fetchUrl,
        lastErr: lastErr && lastErr.message,
        triedAt: Date.now(),
        isSportradar,
      };
      const diagPath = cue + ".diag.json";
      await fs.promises.writeFile(
        diagPath,
        JSON.stringify(diag, null, 2),
        "utf8",
      );
    } catch (e) {
      // ignore diag write failures
    }
    return null;
  }
  const ct =
    res.headers && res.headers.get
      ? res.headers.get("content-type") || "application/octet-stream"
      : "application/octet-stream";

  // Choose extension
  let ext = "bin";
  if (ct.includes("png")) ext = "png";
  else if (ct.includes("jpeg") || ct.includes("jpg")) ext = "jpg";
  else if (ct.includes("gif")) ext = "gif";
  else if (ct.includes("svg")) ext = "svg";

  const finalPath = cue + "." + ext;
  const meta = { contentType: ct, url: fetchUrl, fetchedAt: Date.now() };

  // Stream to file: convert Web Stream to Node stream if needed
  const tmpPath = finalPath + ".tmp";
  const out = fs.createWriteStream(tmpPath);
  
  // Check if res.body is a Node stream or a Web stream
  if (res.body && typeof res.body.pipe === "function") {
    // Node stream
    await new Promise((resolve, reject) => {
      res.body.pipe(out);
      out.on("finish", resolve);
      out.on("error", reject);
      res.body.on("error", reject);
    });
  } else if (res.body && res.body[Symbol.asyncIterator]) {
    // Web stream (async iterable)
    await new Promise(async (resolve, reject) => {
      try {
        for await (const chunk of res.body) {
          out.write(chunk);
        }
        out.end();
        out.on("finish", resolve);
        out.on("error", reject);
      } catch (e) {
        reject(e);
      }
    });
  } else {
    // Fallback: convert buffer
    const buf = await res.arrayBuffer();
    await fs.promises.writeFile(tmpPath, Buffer.from(buf));
  }
  
  // rename
  await fs.promises.rename(tmpPath, finalPath);
  await fs.promises.writeFile(metaPath, JSON.stringify(meta), "utf8");

  // Cleanup: remove old variants without ext
  try {
    if (await statSafe(cue)) await fs.promises.unlink(cue);
  } catch (e) {}

  return { path: finalPath, contentType: ct };
}

export default { fetchAndCacheImage };
