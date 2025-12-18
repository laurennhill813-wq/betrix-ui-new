// Azure AI smoke tests (dynamic imports)
import assert from "assert";

const fsMod = await import("fs");
const vm = await import("vm");
const fs = fsMod;

function loadAzureAIServiceWithFetch(mockFetch) {
  const srcPath = "src/services/azure-ai.js";
  let src = fs.readFileSync(srcPath, "utf8");
  // Replace any node-fetch import with a global mocked fetch (handle CRLF and LF)
  src = src.replace(
    /import\s+fetch\s+from\s+['"]node-fetch['"];?/g,
    "const fetch = global.__mocked_fetch__",
  );
  // Mock persona and metrics imports used by the service so vm.runInContext doesn't choke on ESM imports
  src = src.replace(
    /import\s+persona\s+from\s+['"].*?persona\.js['"];?/g,
    "const persona = global.__mocked_persona__",
  );
  src = src.replace(
    /import\s+metrics\s+from\s+['"].*?metrics\.js['"];?/g,
    "const metrics = global.__mocked_metrics__",
  );
  // Convert ESM exports to CommonJS-compatible form for vm execution
  src = src.replace(/export\s+class\s+([A-Za-z0-9_]+)/g, "class $1");
  src = src.replace(/export\s+default\s+/g, "");
  // ensure module.exports is set after the class definition
  src += "\nmodule.exports.AzureAIService = AzureAIService;";

  const sandbox = {
    global: {},
    console,
    setTimeout,
    clearTimeout,
    AbortController,
    Buffer,
    process,
  };
  sandbox.global = sandbox;
  sandbox.__mocked_fetch__ = mockFetch;
  // Provide simple mocks for persona and metrics so the AzureAIService can call them
  sandbox.__mocked_persona__ = {
    getSystemPrompt: (opts) => "You are BETRIX AI assistant.",
    FEW_SHOT_EXAMPLES: [],
  };
  sandbox.__mocked_metrics__ = {
    incRequest: () => {},
    observeLatency: () => {},
    incError: () => {},
    addTokens: () => {},
  };
  sandbox.exports = {};
  sandbox.module = { exports: sandbox.exports };

  vm.createContext(sandbox);
  const wrapped = `(function(module, exports){\n${src}\n})(module, exports);`;
  vm.runInContext(wrapped, sandbox, { filename: srcPath });
  return sandbox.module.exports.AzureAIService;
}

async function runSuccessTest() {
  const successfulFetch = async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () =>
      JSON.stringify({
        choices: [{ message: { content: "Hello from Azure" } }],
      }),
  });

  const AzureAIService = loadAzureAIServiceWithFetch(successfulFetch);
  const s = new AzureAIService("https://example.com", "key", "deployment");
  const res = await s.chat("hi");
  assert.strictEqual(res, "Hello from Azure");
}

async function runErrorTest() {
  const errorFetch = async () => ({
    ok: false,
    status: 500,
    statusText: "Internal Server Error",
    text: async () => JSON.stringify({ error: { message: "something bad" } }),
  });

  const AzureAIService = loadAzureAIServiceWithFetch(errorFetch);
  const s = new AzureAIService("https://example.com", "key", "deployment");
  let threw = false;
  try {
    await s.chat("hi");
  } catch (err) {
    threw = true;
    assert.ok(
      err.message.includes("something bad") ||
        err.message.includes("AzureAI error"),
    );
  }
  assert.ok(threw, "Expected chat() to throw on non-OK response");
}

async function runTimeoutTest() {
  const timeoutFetch = (url, opts) =>
    new Promise((resolve, reject) => {
      if (opts && opts.signal) {
        opts.signal.addEventListener("abort", () => {
          const e = new Error("aborted");
          e.name = "AbortError";
          reject(e);
        });
      }
      // never resolve
    });

  const AzureAIService = loadAzureAIServiceWithFetch(timeoutFetch);
  const s = new AzureAIService(
    "https://example.com",
    "key",
    "deployment",
    "2023-05-15",
    { timeoutMs: 50, logger: console },
  );
  let threw = false;
  try {
    await s.chat("hi");
  } catch (err) {
    threw = true;
    assert.ok(
      err.message.includes("aborted") || err.message.includes("aborted after"),
    );
  }
  assert.ok(threw, "Expected chat() to throw on timeout/abort");
}

(async () => {
  try {
    await runSuccessTest();
    await runErrorTest();
    await runTimeoutTest();
    console.log("\nAll Azure AI smoke tests passed.");
    process.exit(0);
  } catch (err) {
    console.error("\nAzure AI smoke tests failed:", err);
    process.exit(2);
  }
})();
