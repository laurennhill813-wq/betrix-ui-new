#!/usr/bin/env node
const { spawnSync } = require("child_process");
const { readdirSync, writeFileSync } = require("fs");
const path = require("path");

const testsDir = path.join(__dirname);
const entries = readdirSync(testsDir)
  .filter(
    (f) =>
      /\.(js|cjs)$/.test(f) &&
      f !== "run-all-tests.cjs" &&
      f !== "run-tests.js" &&
      f !== "run-all-tests-debug.cjs",
  )
  .sort();

const results = [];
for (const f of entries) {
  const full = path.join(testsDir, f);
  const res = spawnSync(process.execPath, [full], { encoding: "utf8" });
  results.push({
    file: f,
    status: res.status,
    signal: res.signal,
    error: res.error && String(res.error),
    stdout: res.stdout && res.stdout.slice(0, 2000),
    stderr: res.stderr && res.stderr.slice(0, 2000),
  });
}

writeFileSync(
  path.join(__dirname, "run-all-tests-debug.json"),
  JSON.stringify(results, null, 2),
);
console.log("Wrote run-all-tests-debug.json");
for (const r of results) {
  console.log(r.file, "=>", r.status || r.signal || "unknown");
}
const anyFail = results.some((r) => r.status !== 0);
process.exit(anyFail ? 1 : 0);
