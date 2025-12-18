"use strict";
// startup-enforce-webhooks.js
// Minimal, safe no-op used for preloading. Keeps process side-effect free.
try {
  if (
    typeof process !== "undefined" &&
    process.env &&
    !process.env.STARTUP_ENFORCE_LOGGED
  ) {
    try {
      process.env.STARTUP_ENFORCE_LOGGED = "1";
    } catch (e) {
      void e;
    }
    console.debug && console.debug("startup-enforce-webhooks loaded (no-op)");
  }
} catch (e) {
  void e;
}
