import { PROVIDERS, registerProvider } from "./registry.js";
// Prefer the provider-level dispatcher under src/providers/sportradar when present
import { handler as sportradarHandler } from "../../providers/sportradar/index.js";
import { fetchSportradar } from "./sportradar.js";

// Attach adapter functions. If we have the higher-level dispatcher, use it;
// otherwise fall back to the service-level fetcher.
try {
  if (sportradarHandler && typeof sportradarHandler === "function") {
    registerProvider("sportradar", sportradarHandler);
  } else {
    registerProvider("sportradar", fetchSportradar);
  }
} catch (e) {
  // fallback
  registerProvider("sportradar", fetchSportradar);
}

export { PROVIDERS };
