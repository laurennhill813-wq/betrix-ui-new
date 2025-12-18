import { startServer } from "./src/server.js";

// Minimal root entrypoint expected by many CI scripts.
// Starts the Express server exported from `src/server.js`.
if (process.env.NODE_ENV !== "test") {
  startServer();
}
