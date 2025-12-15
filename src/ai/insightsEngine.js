import { Logger } from '../utils/logger.js';
const logger = new Logger('ai:insightsEngine');

// Minimal insightsEngine scaffold.
// Exports: generateInsight(event, match) which returns a short insight/explaination.

export async function generateInsight(event = {}, match = {}) {
  try {
    if (event.type === 'goal') {
      const scorer = event.player || 'Player';
      const minute = event.minute ? `${event.minute}’` : 'soon';
      return `${scorer} scored at ${minute} — looks decisive.`;
    }
    if (event.type === 'red_card' || event.card === 'red') {
      return `Red card shown — game will be affected.`;
    }
    return 'No special insights for this event.';
  } catch (err) {
    logger.warn(`generateInsight failed: ${err?.message || String(err)}`);
    return 'Insight unavailable.';
  }
}

export default { generateInsight };
