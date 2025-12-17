#!/usr/bin/env node
// Cross-platform Node wrapper for the unified test runner
import { spawnSync } from 'child_process';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

// Diagnostic listeners to trace unexpected exits and rejections
process.on('beforeExit', code => {
  console.error('DBG beforeExit code=', code);
});
process.on('exit', code => {
  try {
    // show a small stack so we can see who's calling exit if any
    const s = new Error('stack').stack;
    console.error('DBG exit code=', code, '\nstack:\n', s);
  } catch (e) {
    console.error('DBG exit code=', code);
  }
});
process.on('uncaughtException', err => {
  console.error('DBG uncaughtException', err && err.stack ? err.stack : err);
});
process.on('unhandledRejection', (r) => {
  console.error('DBG unhandledRejection', r);
});

// Intercept direct process.exit calls to log callsite
try {
  const _realExit = process.exit;
  process.exit = function (code) {
    try {
      console.error('DBG process.exit called with code=', code, '\ncallstack:\n', new Error().stack);
    } catch (e) {
      console.error('DBG process.exit called with code=', code);
    }
    return _realExit.call(process, code);
  };
} catch (e) {
  // ignore
}

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
    // Improved heuristics to detect files intended to be run with Node's built-in runner
    // Check content for explicit node:test imports, node:assert, top-level test() or run() calls
    const fileName = filepath.toLowerCase();
    if (txt.includes('node:test')) return true;
    if (txt.includes("from 'node:assert'") || txt.includes('from "node:assert"')) return true;
    // Detect plain 'assert' imports (common in node-script style tests)
    if (/\bimport\s+assert\b/.test(txt) || txt.includes("from 'assert'") || txt.includes('from "assert"')) return true;
    // Treat files with an explicit top-level run() as script-style node tests
    if (/^\s*run\s*\(/m.test(txt)) return true;  // top-level run()
    if (/\.node\.(js|mjs)$/.test(fileName)) return true;
    if (/\.smoke\.node\.(js|mjs)$/.test(fileName)) return true;
    if (txt.includes('require.main === module') || txt.includes('import.meta.url')) return true;
    if (txt.includes('process.exit(') || txt.includes('runtests(') || txt.includes('runtests()') || txt.includes('runtests().catch')) return true;
    // If the file uses top-level assert calls and does not contain Jest-style describe/test blocks,
    // treat it as a node-style script test.
    if ((/\bassert\s*\(/.test(txt) || /\bassert\./.test(txt)) && !(/\bdescribe\s*\(|\btest\s*\(/.test(txt))) return true;
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

  // Classify files into Node built-in tests, Node script-style tests, or Jest files.
  const nodeTestFiles = [];
  const nodeScriptFiles = [];
  const jestFiles = [];

  for (const f of all) {
    const txt = readFileSync(f, 'utf8');
    // If heuristics mark this as a node-style test, prefer node execution.
    if (containsNodeTest(f)) {
      // If it contains a top-level run() invocation, treat as a script-style file
      if (/^\s*run\s*\(/m.test(txt)) {
        nodeScriptFiles.push(f);
      } else {
        nodeTestFiles.push(f);
      }
    } else if (isCommonJS(f)) {
      // CommonJS modules should be executed as scripts
      nodeScriptFiles.push(f);
    } else {
      // Otherwise, hand off to Jest
      jestFiles.push(f);
    }
  }

  let nodeExit = 0;
  if (nodeTestFiles.length) {
    console.log('Running Node built-in tests...');
    // Put reporter option before file list to avoid it being interpreted as a filename
    const args = ['--test', '--test-reporter=spec', ...nodeTestFiles];
    console.log('Debug: nodeFiles count:', nodeTestFiles.length);
    console.log('Debug: node args:', args);
    let r = spawnSync('node', args, { stdio: 'inherit' });
    console.log('Node built-in process result:', { status: r.status, signal: r.signal, error: r.error ? String(r.error) : null });
    // If the child failed, re-run it capturing output for diagnostics
    if ((r.status !== 0) || r.error) {
      console.error('Node built-in tests returned non-zero; capturing output for diagnosis...');
      r = spawnSync('node', args, { stdio: 'pipe', encoding: 'utf8' });
      console.error('--- Captured stdout ---\n', r.stdout || '(none)');
      console.error('--- Captured stderr ---\n', r.stderr || '(none)');
    }
    // Prefer explicit numeric status if available, otherwise treat errors as exit code 1
    nodeExit = (r.status !== null && r.status !== undefined) ? r.status : (r.error ? 1 : 0);
  } else {
    console.log('No node:test files found.');
  }

  // Execute any CommonJS-style node script tests individually with plain node
  if (nodeScriptFiles.length) {
    console.log('Running standalone Node script tests (CommonJS) ...');
    console.log('Debug: node script count:', nodeScriptFiles.length);
    for (const f of nodeScriptFiles) {
      console.log('Running script:', f);
      let r = spawnSync(process.execPath, [f], { stdio: 'inherit' });
      console.log('Script result for', f, ':', { status: r.status, signal: r.signal, error: r.error ? String(r.error) : null });
      // Re-run with captured output if it failed
      if ((r.status !== 0) || r.error) {
        console.error('Script returned non-zero; capturing output for', f);
        r = spawnSync(process.execPath, [f], { stdio: 'pipe', encoding: 'utf8' });
        console.error('--- Captured stdout for', f, '---\n', r.stdout || '(none)');
        console.error('--- Captured stderr for', f, '---\n', r.stderr || '(none)');
      }
      const scriptExit = (r.status !== null && r.status !== undefined) ? r.status : (r.error ? 1 : 0);
      if (scriptExit !== 0) {
        nodeExit = scriptExit;
        console.error('Script failed:', f, 'exit code:', scriptExit);
      }
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
    let r = spawnSync('npx', args, { stdio: 'inherit', env: jestEnv });
    console.log('Jest process result:', { status: r.status, signal: r.signal, error: r.error ? String(r.error) : null });
    if ((r.status !== 0) || r.error) {
      console.error('Jest returned non-zero; capturing output for diagnosis...');
      r = spawnSync('npx', args, { stdio: 'pipe', encoding: 'utf8', env: jestEnv });
      console.error('--- Captured stdout (jest) ---\n', r.stdout || '(none)');
      console.error('--- Captured stderr (jest) ---\n', r.stderr || '(none)');
    }
    jestExit = (r.status !== null && r.status !== undefined) ? r.status : (r.error ? 1 : 0);
  } else {
    console.log('No Jest-style files found.');
  }

  console.log('\n=== Combined Test Summary ===');
  console.log('Node exit code:', nodeExit);
  console.log('Jest exit code:', jestExit);
  // Propagate child exit codes so CI fails on actual test failures.
  // Use logical OR so any non-zero exit from node or jest results in failure.
  const finalExit = nodeExit || jestExit;
  console.log('Final exit code:', finalExit);
  process.exit(finalExit);
}

main().catch(err => {
  console.error('Test runner error', err);
  process.exit(2);
});
