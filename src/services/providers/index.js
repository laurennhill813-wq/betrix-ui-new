import { PROVIDERS, registerProvider } from './registry.js';
import { fetchSportradar } from './sportradar.js';

// Attach adapter functions
registerProvider('sportradar', fetchSportradar);

export { PROVIDERS };
