#!/usr/bin/env node
// Cross-platform Node wrapper for the unified test runner
import { spawnSync } from 'child_process';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

function findTestFiles(dir) {
  const out = [];
  try {
    const files = readdirSync(dir, { withFileTypes: true });
    for (const f of files) {
      const p = join(dir, f.name);
      if (f.isDirectory()) out.push(...findTestFiles(p));
      else if (/\.(mjs|js)$/.test(f.name)) out.push(p);
    }
  } catch (e) { }
  return out;
}

function containsNodeTest(filepath) {
  try {
    const txt = readFileSync(filepath, 'utf8');
    return txt.includes("node:test");
  } catch (e) { return false; }
}

async function main() {
  const testsDir = join(process.cwd(), 'tests');
  const all = findTestFiles(testsDir).filter(Boolean);

  const nodeFiles = all.filter(f => containsNodeTest(f));
  const jestFiles = all.filter(f => !containsNodeTest(f));

  let nodeExit = 0;
  if (nodeFiles.length) {
    console.log('Running Node built-in tests...');
    // Put reporter option before file list to avoid it being interpreted as a filename
    const args = ['--test', '--test-reporter=spec', ...nodeFiles];
    const r = spawnSync('node', args, { stdio: 'inherit' });
    nodeExit = r.status || 0;
  } else {
    console.log('No node:test files found.');
  }

  let jestExit = 0;
  if (jestFiles.length) {
    console.log('Running Jest (single invocation) on', jestFiles.length, 'files...');
    const args = ['jest', '--passWithNoTests', '--runInBand', '--verbose', ...jestFiles];
    const r = spawnSync('npx', args, { stdio: 'inherit' });
    jestExit = r.status || 0;
  } else {
    console.log('No Jest-style files found.');
  }

  console.log('\n=== Combined Test Summary ===');
  console.log('Node exit code:', nodeExit);
  console.log('Jest exit code:', jestExit);
  process.exit(nodeExit !== 0 || jestExit !== 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Test runner error', err);
  process.exit(2);
});
