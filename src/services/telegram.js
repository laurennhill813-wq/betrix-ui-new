// Telegram API service (ESM)
// Combines sanitization (escape/whitelist) with safe edit/send behaviour

import { Logger } from "../utils/logger.js";
import { HttpClient } from "./http-client.js";
import { chunkText } from "../utils/formatters.js";
import * as sanitize from "../utils/telegram-sanitize.js";

const logger = new Logger("Telegram");

class TelegramService {
  constructor(botToken, safeChunkSize = 3000) {
    this.botToken = botToken;
    this.safeChunkSize = safeChunkSize;
    this.baseUrl = `https://api.telegram.org/bot${botToken}`;
  }

  // sendMessage with chunking and sanitization
  async sendMessage(chatId, text, options = {}) {
    const chunks = chunkText(String(text || ""), this.safeChunkSize);

    // Choose parse mode: prefer explicit parse_mode, otherwise default to Markdown
    const parseMode =
      options && options.parse_mode ? options.parse_mode : "MarkdownV2";

    for (let i = 0; i < chunks.length; i++) {
      const suffix =
        chunks.length > 1 ? `\n\nPage ${i + 1}/${chunks.length}` : "";
      let bodyText = chunks[i] + suffix;

      // Sanitize based on parse mode.
      // If caller provided explicit parse_mode, assume they've sanitized dynamic fields
      // themselves and don't auto-escape to preserve intended formatting. Otherwise
      // perform a safe MarkdownV2 escape by default.
      if (options && options.parse_mode) {
        // leave bodyText as-is
      } else if (String(parseMode).toLowerCase() === "html") {
        bodyText = sanitize.sanitizeTelegramHtml(bodyText);
      } else {
        // For MarkdownV2 (default), escape MarkdownV2 special chars
        bodyText = sanitize.escapeMarkdownV2(bodyText);
      }

      const payload = {
        chat_id: chatId,
        text: bodyText,
        parse_mode: parseMode,
        disable_web_page_preview: true,
        ...options,
      };

      try {
        await HttpClient.fetch(
          `${this.baseUrl}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
          `sendMessage to ${chatId}`,
        );
      } catch (err) {
        logger.error("sendMessage failed", err);
        throw err;
      }
    }
  }

  // editMessage with sanitization and safe fallback to sendMessage
  async editMessage(chatId, messageId, text, replyMarkup = null, options = {}) {
    // Determine parse mode: prefer explicit options.parse_mode, then replyMarkup.parse_mode, otherwise MarkdownV2
    let parse = "MarkdownV2";
    if (options && options.parse_mode) parse = options.parse_mode;
    else if (
      replyMarkup &&
      typeof replyMarkup === "object" &&
      replyMarkup.parse_mode
    )
      parse = replyMarkup.parse_mode;

    // Sanitize text according to chosen parse mode
    let safeText = String(text || "");
    // Sanitize text according to chosen parse mode. If caller provided parse_mode
    // assume they've escaped dynamic fields; otherwise escape for MarkdownV2.
    if (options && options.parse_mode) {
      // keep as provided
    } else if (String(parse).toLowerCase() === "html")
      safeText = sanitize.sanitizeTelegramHtml(safeText);
    else safeText = sanitize.escapeMarkdownV2(safeText);

    const payload = {
      chat_id: chatId,
      message_id: messageId,
      text: safeText,
      parse_mode: parse,
      disable_web_page_preview: true,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    };

    try {
      return await HttpClient.fetch(
        `${this.baseUrl}/editMessageText`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
        `editMessage ${messageId}`,
      );
    } catch (err) {
      const desc =
        (err && (err.description || err.message || String(err))) || "";
      if (
        /can't parse entities|Unsupported start tag|Bad Request: can't parse entities/i.test(
          desc,
        )
      ) {
        // Try a safe fallback: remove parse_mode and send as plain text with MarkdownV2-escaped text
        const sendOpts = { reply_markup: replyMarkup };
        if (options && options.parse_mode)
          sendOpts.parse_mode = options.parse_mode;
        try {
          await this.sendMessage(chatId, safeText, sendOpts);
          return { ok: true, fallback: "sent_new" };
        } catch (e2) {
          logger.warn(
            "Fallback sendMessage after editMessage failure also failed",
            e2 && e2.message ? e2.message : e2,
          );
          return { ok: false, reason: "edit_and_send_failed" };
        }
      }
      throw err;
    }
  }

  // Answer callback query (inline button response)
  async answerCallback(callbackQueryId, text = "", showAlert = false) {
    return HttpClient.fetch(
      `${this.baseUrl}/answerCallbackQuery`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text,
          show_alert: showAlert,
        }),
      },
      `answerCallback ${callbackQueryId}`,
    );
  }

  // Webhook helpers
  async setWebhook(
    url,
    allowedUpdates = ["message", "callback_query"],
    secretToken = null,
  ) {
    const body = { url, allowed_updates: allowedUpdates };
    if (secretToken) body.secret_token = secretToken;
    return HttpClient.fetch(
      `${this.baseUrl}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      "setWebhook",
    );
  }

  async deleteWebhook() {
    return HttpClient.fetch(
      `${this.baseUrl}/deleteWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
      "deleteWebhook",
    );
  }

  async getWebhookInfo() {
    return HttpClient.fetch(
      `${this.baseUrl}/getWebhookInfo`,
      { method: "POST" },
      "getWebhookInfo",
    );
  }

  // Send a photo by URL with optional caption
  async sendPhoto(chatId, photoUrl, caption = "", options = {}) {
    // Sanitize caption according to parse mode (default to MarkdownV2)
    const parseMode = options.parse_mode || "MarkdownV2";
    let safeCaption = String(caption || "");
    if (String(parseMode).toLowerCase() === "html")
      safeCaption = sanitize.sanitizeTelegramHtml(safeCaption);
    else safeCaption = sanitize.escapeMarkdownV2(safeCaption);

    const payload = Object.assign(
      {
        chat_id: chatId,
        photo: photoUrl,
        caption: safeCaption,
        parse_mode: parseMode,
      },
      options,
    );
    try {
      return await HttpClient.fetch(
        `${this.baseUrl}/sendPhoto`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
        `sendPhoto to ${chatId}`,
      );
    } catch (err) {
      logger.error("sendPhoto failed", err);
      throw err;
    }
  }
}

export { TelegramService };
export default TelegramService;
