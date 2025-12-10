// Utility to sanitize/escape text before sending to Telegram API.
// - Escapes angle brackets for unsupported tags
// - Allows a whitelist of Telegram-supported HTML tags to remain
// - Provides a short escape fallback for when we want to avoid any parsing

const ALLOWED_TAGS = new Set([
  'b', 'strong', 'i', 'em', 'u', 'ins', 's', 'strike', 'del', 'code', 'pre', 'a'
]);

function sanitizeTelegramHtml(text) {
  if (typeof text !== 'string' || text.length === 0) return text;

  // Replace unsupported tags like <fixture-id> by escaping their angle brackets,
  // while preserving allowed tags.
  return text.replace(/<\/?([a-zA-Z0-9-]+)(\s[^>]*)?>/g, (match, tagName) => {
    if (!tagName) return match.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (ALLOWED_TAGS.has(tagName.toLowerCase())) return match;
    // Escape the whole match to avoid Telegram parsing it as an entity
    return match.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  });
}

// Simpler coarse-grain escape when we want to remove ALL HTML parsing:
function escapeAngleBrackets(text) {
  if (typeof text !== 'string' || text.length === 0) return text;
  return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
export { sanitizeTelegramHtml, escapeAngleBrackets };
