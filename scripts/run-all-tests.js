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
    // Heuristics to detect files intended to be run with Node's built-in runner
    // - explicit `node:test` import
    // - filename conventions like `.node.js` or `.smoke.node.js`
    // - script-style tests that call `process.exit` or have a runTests() entry
    const fileName = filepath.toLowerCase();
    if (txt.includes('node:test')) return true;
    if (/\.node\.(js|mjs)$/.test(fileName)) return true;
    if (/\.smoke\.node\.(js|mjs)$/.test(fileName)) return true;
    if (txt.includes('require.main === module') || txt.includes('import.meta.url')) return true;
    if (txt.includes('process.exit(') || txt.includes('runtests(') || txt.includes('runtests()') || txt.includes('runtests().catch')) return true;
    // (do not treat any arbitrary 'await' usages as node:test — that causes false positives)
    return false;
  } catch (e) { return false; }
}

function isCommonJS(filepath) {
  try {
    const txt = readFileSync(filepath, 'utf8');
    return txt.includes('require(') || txt.includes('module.exports') || txt.includes('exports.');
  } catch (e) { return false; }
}

async function main() {
  const testsDir = join(process.cwd(), 'tests');
  const all = findTestFiles(testsDir)
    .filter(Boolean)
    .filter(p => {
      const base = p.split(/[/\\]/).pop().toLowerCase();
      // skip test helpers / runners
      if (base === 'run-all-tests.js' || base === 'run-tests.js') return false;
      return true;
    });

  // Separate files that should be run via `node --test` from standalone
  // CommonJS script-style tests which should be executed with normal `node <file>`.
  const nodeTestFiles = all.filter(f => containsNodeTest(f) && !isCommonJS(f));
  const nodeScriptFiles = all.filter(f => isCommonJS(f) && (
    readFileSync(f, 'utf8').includes('process.exit') || readFileSync(f, 'utf8').includes('spawnSync') || readFileSync(f, 'utf8').includes('runTests()')
  ));
  const jestFiles = all.filter(f => !containsNodeTest(f) && !nodeScriptFiles.includes(f));

  let nodeExit = 0;
  if (nodeTestFiles.length) {
    console.log('Running Node built-in tests...');
    // Put reporter option before file list to avoid it being interpreted as a filename
    const args = ['--test', '--test-reporter=spec', ...nodeTestFiles];
    console.log('Debug: nodeFiles count:', nodeTestFiles.length);
    console.log('Debug: node args:', args);
    const r = spawnSync('node', args, { stdio: 'inherit' });
    nodeExit = r.status || 0;
  } else {
    console.log('No node:test files found.');
  }

  // Execute any CommonJS-style node script tests individually with plain node
  if (nodeScriptFiles.length) {
    console.log('Running standalone Node script tests (CommonJS) ...');
    console.log('Debug: node script count:', nodeScriptFiles.length);
    for (const f of nodeScriptFiles) {
      console.log('Running script:', f);
      const r = spawnSync(process.execPath, [f], { stdio: 'inherit' });
      if ((r.status || 0) !== 0) nodeExit = r.status || 1;
    }
  }

  let jestExit = 0;
  if (jestFiles.length) {
    console.log('Running Jest (single invocation) on', jestFiles.length, 'files...');
    const args = ['jest', '--passWithNoTests', '--runInBand', '--verbose', ...jestFiles];
    console.log('Debug: jestFiles count:', jestFiles.length);
    console.log('Debug: npx args:', args);
    // Ensure Jest runs with ESM support in CI
    const jestEnv = { ...process.env, NODE_OPTIONS: '--experimental-vm-modules' };
    console.log('Debug: NODE_OPTIONS for jest:', jestEnv.NODE_OPTIONS);
    const r = spawnSync('npx', args, { stdio: 'inherit', env: jestEnv });
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
