// Minimal Telegram client using global fetch (Node 20+)
const TELEGRAM_TOKEN =
  process.env.TELEGRAM_TOKEN || process.env.TELEGRAM_BOT_TOKEN || null;
const TELEGRAM_BASE = TELEGRAM_TOKEN
  ? `https://api.telegram.org/bot${TELEGRAM_TOKEN}`
  : null;

async function safeFetch(path, body) {
  if (!TELEGRAM_BASE) throw new Error("Missing TELEGRAM_TOKEN");
  const url = `${TELEGRAM_BASE}${path}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await resp.json().catch(() => null);
  if (!json || !json.ok)
    throw new Error("Telegram API error: " + JSON.stringify(json));
  return json;
}

export async function sendTelegramMessage(chatId, text, options = {}) {
  if (!TELEGRAM_TOKEN) {
    console.warn(
      "[Telegram] TELEGRAM_TOKEN not set; skipping sendTelegramMessage",
    );
    return null;
  }
  try {
    const payload = Object.assign({ chat_id: chatId, text }, options);
    return await safeFetch("/sendMessage", payload);
  } catch (err) {
    console.error("[Telegram] sendMessage failed", err?.message || err);
    return null;
  }
}

export async function sendTelegramPhoto(
  chatId,
  photoUrl,
  caption,
  options = {},
) {
  if (!TELEGRAM_TOKEN) {
    console.warn(
      "[Telegram] TELEGRAM_TOKEN not set; skipping sendTelegramPhoto",
    );
    return null;
  }
  try {
    const payload = Object.assign(
      { chat_id: chatId, photo: photoUrl, caption },
      options,
    );
    return await safeFetch("/sendPhoto", payload);
  } catch (err) {
    console.error("[Telegram] sendPhoto failed", err?.message || err);

    // If Telegram couldn't fetch the provided URL (e.g. wrong type of web page content),
    // attempt to fetch the image locally and upload it as multipart/form-data using `form-data`.
    try {
      const msg = String(err?.message || "").toLowerCase();
      if (
        msg.includes("wrong type of the web page content") ||
        msg.includes("failed to get http url") ||
        msg.includes("can't parse entities")
      ) {
        // try to fetch image ourselves
        const imgRes = await fetch(photoUrl, { redirect: "follow" });
        const ct =
          imgRes.headers && imgRes.headers.get
            ? imgRes.headers.get("content-type")
            : "";
        if (imgRes.ok && ct && ct.startsWith("image/")) {
          const buf = Buffer.from(await imgRes.arrayBuffer());
          const FormDataPkg = (await import("form-data")).default;
          const formData = new FormDataPkg();
          formData.append("chat_id", String(chatId));
          if (caption) formData.append("caption", caption);
          const ext = (ct.split("/")[1] || "jpg").split(";")[0];
          const filename = `upload.${ext}`;
          const tmp = require("path").join(
            require("os").tmpdir(),
            `${Date.now()}-${filename}`,
          );
          const fs = await import("fs");
          await fs.promises.writeFile(tmp, buf);
          formData.append("photo", fs.createReadStream(tmp), {
            filename,
            contentType: ct,
          });

          const uploadUrl = `${TELEGRAM_BASE}/sendPhoto`;
          const headers = formData.getHeaders ? formData.getHeaders() : {};
          const uploadResp = await fetch(uploadUrl, {
            method: "POST",
            body: formData,
            headers,
          });
          try {
            await fs.promises.unlink(tmp);
          } catch (e) {}
          const uploadJson = await uploadResp.json().catch(() => null);
          if (!uploadJson || !uploadJson.ok) {
            console.error(
              "[Telegram] sendPhoto upload failed",
              uploadResp.status,
              uploadJson,
            );
            return null;
          }
          return uploadJson;
        }
      }
    } catch (uploadErr) {
      console.error(
        "[Telegram] sendPhoto upload fallback failed",
        uploadErr && uploadErr.message ? uploadErr.message : uploadErr,
      );
      try {
        (await import("../brain/telemetry.js")).default.incCounter(
          "upload_fallback_failures",
        );
      } catch (e) {}
    }

    return null;
  }
}

export default { sendTelegramMessage, sendTelegramPhoto };
