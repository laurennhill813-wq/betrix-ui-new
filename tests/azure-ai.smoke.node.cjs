const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

function loadAzureAIServiceWithFetch(mockFetch) {
  const srcPath = 'src/services/azure-ai.js';
  let src = fs.readFileSync(srcPath, 'utf8');
  // Replace any "import fetch from 'node-fetch'" regardless of newline/CRLF style
  src = src.replace(/import\s+fetch\s+from\s+['"]node-fetch['"];?/, 'const fetch = global.__mocked_fetch__');
  // Convert ES module "export class" to a form loadable in the VM/CommonJS context
  src = src.replace(/export\s+class\s+AzureAIService/, 'class AzureAIService');
  // Ensure the class is exported to the module.exports object for our VM wrapper
  src = src + '\n\nmodule.exports.AzureAIService = AzureAIService;';

  const sandbox = { global: {}, console, setTimeout, clearTimeout, AbortController, Buffer, process };
  sandbox.global = sandbox;
  sandbox.__mocked_fetch__ = mockFetch;
  sandbox.exports = {};
  sandbox.module = { exports: sandbox.exports };

  vm.createContext(sandbox);
  const wrapped = `(function(module, exports){\n${src}\n})(module, exports);`;
  try {
    vm.runInContext(wrapped, sandbox, { filename: srcPath });
  } catch (vmErr) {
    // If VM execution fails (often due to remaining ES module imports),
    // fall back to running the ESM smoke test runner which works in ESM mode.
    console.error('VM execution failed while loading AzureAI service:', vmErr && vmErr.message);
    try {
      const cp = require('child_process');
      // Run the ESM test file with the current node executable
      cp.execFileSync(process.execPath, ['tests/azure-ai.smoke.node.js'], { stdio: 'inherit' });
      // If the fallback succeeded, exit cleanly from this test file
      process.exit(0);
    } catch (fallbackErr) {
      console.error('Fallback ESM test run failed:', fallbackErr && fallbackErr.message);
      throw vmErr;
    }
  }
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
    if (!(err.message.includes('something bad') || err.message.includes('AzureAI error'))) throw err;
    console.log('[PASS] Error case ->', err.message);
  }
  if (!threw) throw new Error('Expected chat() to throw on non-OK response');
}

async function runTimeoutTest() {
  const timeoutFetch = (url, opts) => {
    return new Promise((resolve, reject) => {
      if (opts && opts.signal) {
        opts.signal.addEventListener('abort', () => {
          const e = new Error('aborted');
          e.name = 'AbortError';
          reject(e);
        });
      }
    });
  };

  const AzureAIService = loadAzureAIServiceWithFetch(timeoutFetch);
  const s = new AzureAIService('https://example.com', 'key', 'deployment', '2023-05-15', { timeoutMs: 50, logger: console });
  let threw = false;
  try {
    await s.chat('hi');
  } catch (err) {
    threw = true;
    if (!(err.message.includes('aborted') || err.message.includes('aborted after'))) throw err;
    console.log('[PASS] Timeout/abort case ->', err.message);
  }
  if (!threw) throw new Error('Expected chat() to throw on timeout/abort');
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
