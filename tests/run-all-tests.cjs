#!/usr/bin/env node
const { spawnSync } = require('child_process');
const { readdirSync } = require('fs');
const path = require('path');

const testsDir = path.join(__dirname);
const entries = readdirSync(testsDir)
  .filter(f => /\.(js|cjs)$/.test(f) && f !== 'run-all-tests.cjs' && f !== 'run-tests.js')
  .sort();

let allOk = true;
for (const f of entries) {
  console.log('\n=== Running', f);
  const full = path.join(testsDir, f);
  const res = spawnSync(process.execPath, [full], { stdio: 'inherit' });
  console.log('=>', f, 'exit', res.status);
  if (res.status !== 0) {
    allOk = false;
    break;
  }
}

if (allOk) {
  console.log('\nAll test files passed.');
  process.exit(0);
} else {
  console.error('\nSome tests failed. See logs above.');
  process.exit(1);
}
