// TelegramService with defensive sanitization and fallback for editMessageText
// This file replaces/updates the existing service to sanitize message text
// before sending to Telegram and to attempt a safe fallback if Telegram
// responds with an entities parsing error.

const HttpClient = require('./http-client');
const { sanitizeTelegramHtml, escapeAngleBrackets } = require('../utils/telegram-sanitize');

class TelegramService {
  constructor(token, httpClient) {
    this.token = token;
    // Accept an injected httpClient for easier testing; otherwise use the default service client.
    this.httpClient = httpClient || new HttpClient(token);
  }

  // params is an object expected to include properties accepted by your http client,
  // such as: chatId, messageId, text, parse_mode, reply_markup, etc.
  // We preserve the existing call shape by sanitizing payload.text before sending.
  async editMessage(params = {}) {
    const payload = { ...params };

    if (payload.text) {
      if (payload.parse_mode && String(payload.parse_mode).toLowerCase() === 'html') {
        payload.text = sanitizeTelegramHtml(payload.text);
      } else {
        // If not using HTML parse mode, still escape angle brackets to avoid accidental tag parsing
        payload.text = escapeAngleBrackets(payload.text);
      }
    }

    // Log outgoing payload for diagnostics (consider reducing log level in production)
    try {
      // The project's existing http client may expect a method name and payload.
      // If your http client has a different signature, adjust this call accordingly.
      return await this.httpClient.fetch('editMessageText', payload);
    } catch (err) {
      const desc = (err && (err.description || err.message || err.toString())) || '';
      // Detect Telegram entity parsing errors and attempt a safe retry
      if (/can't parse entities|Unsupported start tag|Bad Request: can't parse entities/i.test(desc)) {
        const fallbackPayload = { ...payload };
        // Remove parse_mode and fully escape content
        delete fallbackPayload.parse_mode;
        fallbackPayload.text = escapeAngleBrackets(payload.text || '');

        try {
          console.warn('Telegram editMessageText failed due to entity parsing; retrying with escaped text.');
          return await this.httpClient.fetch('editMessageText', fallbackPayload);
        } catch (err2) {
          // Attach payloads for easier debugging and rethrow
          err2.originalPayload = payload;
          err2.fallbackPayload = fallbackPayload;
          console.error('editMessageText retry failed', err2);
          throw err2;
        }
      }

      // Not an entity parsing error, rethrow
      throw err;
    }
  }

  // Optional: expose sendMessage similarly (left unchanged, but sanitation can be added if desired)
  async sendMessage(params = {}) {
    const payload = { ...params };
    if (payload.text) {
      if (payload.parse_mode && String(payload.parse_mode).toLowerCase() === 'html') {
        payload.text = sanitizeTelegramHtml(payload.text);
      } else {
        payload.text = escapeAngleBrackets(payload.text);
      }
    }
    return await this.httpClient.fetch('sendMessage', payload);
  }
}

module.exports = TelegramService;
