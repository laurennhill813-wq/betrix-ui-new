import fetch from "node-fetch";
import FormData from "form-data";
import fs from "fs";
import os from "os";
import path from "path";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TEST_CHAT_ID || process.env.BOT_BROADCAST_CHAT_ID;
const URL = process.env.TEST_IMAGE_URL;

if (!BOT_TOKEN || !CHAT || !URL) {
  console.error(
    "Missing TELEGRAM_BOT_TOKEN, TEST_CHAT_ID/BOT_BROADCAST_CHAT_ID, or TEST_IMAGE_URL env vars",
  );
  process.exit(1);
}

(async () => {
  try {
    console.log("Downloading", URL);
    const r = await fetch(URL, { redirect: "follow" });
    if (!r.ok) {
      console.error("Failed to download", r.status);
      process.exit(1);
    }
    const ct = r.headers.get("content-type") || "application/octet-stream";
    const buf = Buffer.from(await r.arrayBuffer());
    const ext = (ct.split("/")[1] || "bin").split(";")[0];
    const tmp = path.join(os.tmpdir(), `upl-${Date.now()}.${ext}`);
    await fs.promises.writeFile(tmp, buf);
    console.log("Saved to", tmp, "ct=", ct);

    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`;
    const form = new FormData();
    form.append("chat_id", String(CHAT));
    form.append("photo", fs.createReadStream(tmp), {
      filename: path.basename(tmp),
      contentType: ct,
    });
    form.append("caption", "Direct multipart upload test");
    const headers = form.getHeaders();
    console.log("Uploading to Telegram...");
    const res = await fetch(url, { method: "POST", body: form, headers });
    const text = await res.text().catch(() => "");
    console.log(
      "Telegram response",
      res.status,
      text.slice ? text.slice(0, 400) : text,
    );
    try {
      await fs.promises.unlink(tmp);
    } catch (e) {}
  } catch (e) {
    console.error("Error", e && e.message ? e.message : e);
    process.exit(1);
  }
})();
