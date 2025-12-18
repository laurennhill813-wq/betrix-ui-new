import PROVIDERS_FULL from "../../config/providers_full.js";

// Legacy minimal registry entries (kept for backwards compatibility)
const LEGACY = {
  sportradar: {
    id: "sportradar",
    name: "Sportradar",
    keyEnv: "SPORTRADAR_KEY",
    sports: ["soccer", "tennis", "basketball", "americanfootball"],
    base: "https://api.sportradar.com",
    handler: null, // to be assigned to adapter function
    auth: {
      method: "query", // 'query' or 'header'
      queryParam: "api_key",
      headerName: "Api-Key",
    },
  },
};

// Merge canonical full providers (from config) with legacy entries.
// Non-destructive: legacy keys are preserved and canonical entries are added.
export const PROVIDERS = {
  // Spread full canonical providers first so legacy keys (like 'sportradar')
  // can override or be preserved below if present.
  ...PROVIDERS_FULL,
  ...LEGACY,
};

export function registerProvider(id, handlerFn) {
  if (!PROVIDERS[id]) {
    throw new Error(`Provider ${id} not declared in registry`);
  }
  PROVIDERS[id].handler = handlerFn;
}
