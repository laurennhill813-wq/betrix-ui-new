#!/usr/bin/env node
const { spawnSync } = require("child_process");
const { readdirSync } = require("fs");
const path = require("path");

const testsDir = path.join(__dirname);
const entries = readdirSync(testsDir)
  // include .js and .cjs test files but exclude runner/debug scripts
  .filter(
    (f) =>
      /\.(js|cjs)$/.test(f) &&
      !/^run-all-tests/.test(f) &&
      f !== "run-tests.js",
  )
  .sort();

const { writeFileSync } = require("fs");

(async () => {
  const results = [];
  for (const f of entries) {
    console.log("\n=== Running", f);
    const full = path.join(testsDir, f);
    // Allow per-test timeout (ms) via env TEST_TIMEOUT_MS.
    // Use a longer default for integration tests to avoid spurious timeouts.
    const inferredDefault = /integration/.test(f) ? 600000 : 120000;
    const TIMEOUT_MS = Number(process.env.TEST_TIMEOUT_MS || inferredDefault);
    // Use spawn with a manual timeout to avoid spawnSync ETIMEDOUT issues on some platforms
    const { spawn } = require("child_process");
    const start = Date.now();
    console.log(
      `(timeout ${TIMEOUT_MS}ms) Spawning ${process.execPath} ${full}`,
    );
    let status = null;
    let signal = null;
    let error = null;

    await new Promise((resolve) => {
      const child = spawn(process.execPath, [full], { stdio: "inherit" });
      let killed = false;
      const to = setTimeout(() => {
        if (!child.killed) {
          killed = true;
          child.kill("SIGTERM");
        }
      }, TIMEOUT_MS);

      child.on("exit", (code, sig) => {
        clearTimeout(to);
        status = code;
        signal = sig;
        if (killed && !sig) signal = "SIGTERM";
        resolve();
      });

      child.on("error", (e) => {
        clearTimeout(to);
        error = String(e);
        resolve();
      });
    });

    const took = Date.now() - start;
    const printedStatus =
      typeof status === "number"
        ? status
        : signal
          ? `signal:${signal}`
          : "unknown";
    console.log("=>", f, "exit", printedStatus, `(took ${took}ms)`);
    results.push({ file: f, status, signal, error });
  }

  // write a diagnostics file for CI/debugging
  try {
    writeFileSync(
      path.join(testsDir, "run-all-tests-results.json"),
      JSON.stringify(results, null, 2),
    );
    console.log("\nWrote", path.join("tests", "run-all-tests-results.json"));
  } catch (e) {
    console.warn("Could not write diagnostics file:", e && e.message);
  }

  const failures = results.filter((r) => {
    // If we have a numeric exit status, non-zero means failure
    if (typeof r.status === "number") return r.status !== 0;
    // If the child was terminated by a signal (e.g. timeout), treat as failure
    if (r.signal) return true;
    return false;
  });

  if (failures.length === 0) {
    console.log("\nAll test files passed.");
    // Leave exit 0 for now
    process.exit(0);
  } else {
    console.error("\nSome tests failed. Summary:");
    for (const ff of failures) {
      console.error(` - ${ff.file}: ${ff.status}`);
      if (ff.error) console.error("   error:", ff.error);
    }
    console.error("Runner exiting with code 1 due to test failures.");
    process.exit(1);
  }
})().catch((e) => {
  console.error("Runner fatal error", e && e.stack ? e.stack : e);
  process.exit(1);
});
