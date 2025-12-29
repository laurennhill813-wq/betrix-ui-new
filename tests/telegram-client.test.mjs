import { strict as assert } from "assert";
import { fileURLToPath } from "url";
import path from "path";

// Ensure test preload (mocks) is loaded if test runner doesn't already.
const __filename = fileURLToPath(import.meta.url);

import * as telegramClient from "../src/telegram/telegramClient.js";

function makeHeaders(map) {
  return {
    get: (k) => map[k.toLowerCase()] || null,
  };
}

describe("telegramClient.sendTelegramPhoto", () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    process.env.TELEGRAM_TOKEN = "test-token";
  });

  afterEach(() => {
    global.fetch = realFetch;
    delete process.env.TELEGRAM_TOKEN;
  });

  it("sends photo when URL is direct image (HEAD image)", async () => {
    let seenSendPhoto = false;
    const photoUrl = "https://images.example.com/pic.jpg";

    global.fetch = async (url, opts = {}) => {
      const s = String(url || "");
      if (s.startsWith("https://api.telegram.org/bot")) {
        // sendPhoto call
        seenSendPhoto = true;
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, result: {} }),
        };
      }

      if (s === photoUrl && opts && opts.method === "HEAD") {
        return {
          ok: true,
          status: 200,
          headers: makeHeaders({ "content-type": "image/jpeg" }),
        };
      }

      // default
      return { ok: true, status: 200, json: async () => ({}) };
    };

    const res = await telegramClient.sendTelegramPhoto(12345, photoUrl, "caption here");
    assert(seenSendPhoto, "expected sendPhoto to be called");
  });

  it("extracts og:image from HTML and sends that image", async () => {
    const pageUrl = "https://example.com/page";
    const ogImage = "https://cdn.example.com/og.jpg";
    let sendPhotoPayload = null;

    global.fetch = async (url, opts = {}) => {
      const s = String(url || "");
      if (s.startsWith("https://api.telegram.org/bot")) {
        // capture payload
        sendPhotoPayload = opts && opts.body ? JSON.parse(opts.body) : null;
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }

      if (s === pageUrl && opts && (opts.method === "HEAD" || !opts.method)) {
        return {
          ok: true,
          status: 200,
          headers: makeHeaders({ "content-type": "text/html" }),
          text: async () => `<html><head><meta property="og:image" content="${ogImage}"/></head></html>`,
        };
      }

      // default
      return { ok: true, status: 200, json: async () => ({}) };
    };

    await telegramClient.sendTelegramPhoto(999, pageUrl, "my caption");
    assert(sendPhotoPayload && sendPhotoPayload.photo === ogImage, "expected og:image to be sent");
  });

  it("falls back to sendMessage when URL is not an image and no og:image", async () => {
    const pageUrl = "https://example.com/noimage";
    let sendMessageCalled = false;

    global.fetch = async (url, opts = {}) => {
      const s = String(url || "");
      if (s.startsWith("https://api.telegram.org/bot") && s.includes("/sendMessage")) {
        sendMessageCalled = true;
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }

      if (s === pageUrl) {
        return {
          ok: true,
          status: 200,
          headers: makeHeaders({ "content-type": "text/html" }),
          text: async () => `<html><head></head><body>No image here</body></html>`,
        };
      }

      return { ok: true, status: 200, json: async () => ({}) };
    };

    await telegramClient.sendTelegramPhoto(777, pageUrl, "fallback caption");
    assert(sendMessageCalled, "expected sendMessage fallback to be called");
  });
});
