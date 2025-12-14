#!/usr/bin/env node
const { spawnSync } = require('child_process');
const { readdirSync } = require('fs');
const path = require('path');

const testsDir = path.join(__dirname);
const entries = readdirSync(testsDir)
  // include .js and .cjs test files but exclude runner/debug scripts
  .filter(f => /\.(js|cjs)$/.test(f)
    && !/^run-all-tests/.test(f)
    && f !== 'run-tests.js')
  .sort();

const { writeFileSync } = require('fs');
const results = [];
for (const f of entries) {
  console.log('\n=== Running', f);
  const full = path.join(testsDir, f);
  // Allow per-test timeout (ms) via env TEST_TIMEOUT_MS, default 60s
  const TIMEOUT_MS = Number(process.env.TEST_TIMEOUT_MS || 60000);
  const res = spawnSync(process.execPath, [full], { stdio: 'inherit', timeout: TIMEOUT_MS });
  const status = typeof res.status === 'number' ? res.status : (res.signal ? `signal:${res.signal}` : 'unknown');
  console.log('=>', f, 'exit', status);
  // Capture ETIMEDOUT and other errors explicitly
  let err = null;
  if (res.error) {
    err = String(res.error);
  } else if (res.signal === 'SIGTERM' || res.signal === 'SIGKILL') {
    err = `killed by signal ${res.signal} (timeout ${TIMEOUT_MS}ms?)`;
  }
  results.push({ file: f, status: res.status, signal: res.signal, error: err });
}

// write a diagnostics file for CI/debugging
try {
  writeFileSync(path.join(testsDir, 'run-all-tests-results.json'), JSON.stringify(results, null, 2));
  console.log('\nWrote', path.join('tests', 'run-all-tests-results.json'));
} catch (e) {
  console.warn('Could not write diagnostics file:', e && e.message);
}

const failures = results.filter(r => {
  // If we have a numeric exit status, non-zero means failure
  if (typeof r.status === 'number') return r.status !== 0;
  // If the child was terminated by a signal (e.g. timeout), treat as failure
  if (r.signal) return true;
  return false;
});

if (failures.length === 0) {
  console.log('\nAll test files passed.');
  // Leave exit 0 for now
  process.exit(0);
} else {
  console.error('\nSome tests failed. Summary:');
  for (const ff of failures) {
    console.error(` - ${ff.file}: ${ff.status}`);
    if (ff.error) console.error('   error:', ff.error);
  }
  console.error('Runner exiting with code 1 due to test failures.');
  process.exit(1);
}
