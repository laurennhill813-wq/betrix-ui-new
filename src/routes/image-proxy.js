import express from "express";
import crypto from "crypto";
import imageProxy from "../services/image-proxy.js";

const router = express.Router();

const SECRET = process.env.IMAGE_PROXY_SECRET || null;
// Helper to validate signature: sig=hex(hmac(secret, url))
function validSig(url, sig) {
  if (!SECRET) return false;
  if (!sig) return false;
  try {
    const h = crypto.createHmac("sha256", SECRET).update(url).digest("hex");
    return crypto.timingSafeEqual(
      Buffer.from(h, "hex"),
      Buffer.from(sig, "hex"),
    );
  } catch (e) {
    return false;
  }
}

// GET /internal/image-proxy?url=...&sig=...
router.get("/image-proxy", async (req, res) => {
  try {
    const u = req.query.url;
    const sig = req.query.sig;
    if (!u) return res.status(400).json({ ok: false, error: "url required" });
    if (SECRET && !validSig(u, sig))
      return res.status(401).json({ ok: false, error: "invalid signature" });

    const img = await imageProxy.fetchAndCacheImage(u);
    if (!img || !img.path)
      return res.status(502).json({ ok: false, error: "failed to fetch" });

    // Stream file with proper content-type
    res.setHeader(
      "Content-Type",
      img.contentType || "application/octet-stream",
    );
    const stream = require("fs").createReadStream(img.path);
    stream.on("error", (e) => {
      res.status(500).end();
    });
    stream.pipe(res);
  } catch (e) {
    res
      .status(500)
      .json({ ok: false, error: e && e.message ? e.message : String(e) });
  }
});

export default function createImageProxyRouter() {
  return router;
}
