const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

function loadAzureAIServiceWithFetch(mockFetch) {
  const srcPath = 'src/services/azure-ai.js';
  let src = fs.readFileSync(srcPath, 'utf8');
  // Replace the top-level import of node-fetch with a reference to a provided fetch
  src = src.replace(/import\s+fetch\s+from\s+['"]node-fetch['"];?\n/, 'const fetch = global.__mocked_fetch__\n');

  const sandbox = { global, console, setTimeout, clearTimeout, AbortController, Buffer, process };
  sandbox.global = sandbox;
  sandbox.__mocked_fetch__ = mockFetch;
  sandbox.exports = {};
  sandbox.module = { exports: sandbox.exports };

  vm.createContext(sandbox);
  const wrapped = `(function(module, exports){\n${src}\n})(module, exports);`;
  vm.runInContext(wrapped, sandbox, { filename: srcPath });
  return sandbox.module.exports.AzureAIService;
}

async function runSuccessTest() {
  const successfulFetch = async (url, opts) => {
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => JSON.stringify({ choices: [ { message: { content: 'Hello from Azure' } } ] }),
    };
  };

  const AzureAIService = loadAzureAIServiceWithFetch(successfulFetch);
  const s = new AzureAIService('https://example.com', 'key', 'deployment');
  const res = await s.chat('hi');
  assert.strictEqual(res, 'Hello from Azure');
  console.log('[PASS] Success case');
}

async function runErrorTest() {
  const errorFetch = async (url, opts) => {
    return {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => JSON.stringify({ error: { message: 'something bad' } }),
    };
  };
  const AzureAIService = loadAzureAIServiceWithFetch(errorFetch);
  const s = new AzureAIService('https://example.com', 'key', 'deployment');
  let threw = false;
  try {
    await s.chat('hi');
  } catch (err) {
    threw = true;
    assert.ok(err.message.includes('something bad') || err.message.includes('AzureAI error'));
    console.log('[PASS] Error case ->', err.message);
  }
  assert.ok(threw, 'Expected chat() to throw on non-OK response');
}

async function runTimeoutTest() {
  // Simulate a fetch that never resolves; use AbortController to ensure our service times out
  const timeoutFetch = (url, opts) => {
    return new Promise((resolve, reject) => {
      // if opts.signal is provided, listen for abort
      if (opts && opts.signal) {
        opts.signal.addEventListener('abort', () => {
          const e = new Error('aborted');
          e.name = 'AbortError';
          reject(e);
        });
      }
      // otherwise never resolve to simulate a hang
    });
  };

  const AzureAIService = loadAzureAIServiceWithFetch(timeoutFetch);
  const s = new AzureAIService('https://example.com', 'key', 'deployment', '2023-05-15', { timeoutMs: 50, logger: console });
  let threw = false;
  try {
    await s.chat('hi');
  } catch (err) {
    threw = true;
    assert.ok(err.message.includes('aborted') || err.message.includes('aborted after'), 'Expected abort/timeout message');
    console.log('[PASS] Timeout/abort case ->', err.message);
  }
  assert.ok(threw, 'Expected chat() to throw on timeout/abort');
}

(async () => {
  try {
    await runSuccessTest();
    await runErrorTest();
    await runTimeoutTest();
    console.log('\nAll Azure AI smoke tests passed.');
    process.exit(0);
  } catch (err) {
    console.error('\nAzure AI smoke tests failed:', err);
    process.exit(2);
  }
})();
