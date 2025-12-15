import { Logger } from '../utils/logger.js';
const logger = new Logger('ai:newsEngine');

// Minimal newsEngine scaffold.
// Exports: generateHeadline(event, match) and summarizeEvent(event, match)

export async function generateHeadline(event = {}, match = {}) {
  try {
    // Simple deterministic headline generator (fallback)
    const team = event.team || match.home || match.away || 'Team';
    const type = event.type || event.event || 'event';
    const minute = event.minute ? ` (${event.minute}’)` : '';
    return `${team} ${type}${minute}`;
  } catch (err) {
    logger.warn(`generateHeadline failed: ${err?.message || String(err)}`);
    return 'Match update';
  }
}

export async function summarizeEvent(event = {}, match = {}) {
  try {
    const head = await generateHeadline(event, match);
    const details = event.detail || event.description || '';
    return `${head}: ${details}`.trim();
  } catch (err) {
    logger.warn(`summarizeEvent failed: ${err?.message || String(err)}`);
    return 'Event update';
  }
}

export default { generateHeadline, summarizeEvent };
