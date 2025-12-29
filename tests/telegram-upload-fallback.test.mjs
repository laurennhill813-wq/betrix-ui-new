import { strict as assert } from "assert";

import * as telegramClient from "../src/telegram/telegramClient.js";

function makeResp({ ok = true, status = 200, jsonBody = null, textBody = null, headers = {} } = {}) {
  return {
    ok,
    status,
    headers: { get: (k) => headers[k.toLowerCase()] || null },
    json: async () => jsonBody,
    text: async () => (textBody !== null ? textBody : JSON.stringify(jsonBody)),
    arrayBuffer: async () => {
      // simple PNG header bytes
      return new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer;
    },
  };
}

describe("telegram upload fallback", () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    process.env.TELEGRAM_TOKEN = "test-token";
  });
  afterEach(() => {
    global.fetch = realFetch;
    delete process.env.TELEGRAM_TOKEN;
  });

  it("retries by downloading and uploading when Telegram can't fetch URL", async () => {
    const photoUrl = "https://example.org/redirect-page";
    const telegramBase = "https://api.telegram.org/bottest-token";
    let callIndex = 0;

    global.fetch = async (url, opts = {}) => {
      callIndex++;
      const s = String(url || "");

      // First call: initial sendPhoto via safeFetch -> return Telegram API error JSON
      if (s.startsWith(telegramBase) && callIndex === 1) {
        return makeResp({ ok: false, status: 400, jsonBody: { ok: false, description: "Bad Request: wrong type of the web page content" }, textBody: "{\"ok\":false,\"description\":\"Bad Request: wrong type of the web page content\"}" });
      }

      // Second call: fetch(photoUrl) to download image
      if (s === photoUrl) {
        return makeResp({ ok: true, status: 200, headers: { "content-type": "image/png" } });
      }

      // Third call: upload fallback POST to Telegram sendPhoto with multipart headers
      if (s.startsWith(telegramBase) && opts && opts.method === "POST") {
        // Expect a multipart upload (headers contain boundary)
        const hdrs = opts.headers || {};
        const ct = hdrs["content-type"] || hdrs["Content-Type"] || "";
        if (ct && ct.includes("multipart/form-data")) {
          return makeResp({ ok: true, status: 200, jsonBody: { ok: true, result: {} } });
        }
        // If not multipart, return generic failure
        return makeResp({ ok: false, status: 400, jsonBody: { ok: false } });
      }

      // Default
      return makeResp({ ok: true, status: 200, jsonBody: {} });
    };

    const res = await telegramClient.sendTelegramPhoto(1111, photoUrl, "fallback caption");
    assert(res && res.ok === true, "expected upload fallback to succeed and return ok:true");
  });
});
