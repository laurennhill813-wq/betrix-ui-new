import fs from "fs/promises";
(async function () {
  try {
    const content = await fs.readFile(".env.local", "utf8");
    for (const line of content.split(/\r?\n/)) {
      if (!line || !line.includes("=")) continue;
      const [k, v] = line.split("=", 2);
      process.env[k] = v;
    }
    // verify envs are present (masked)
    const keys = [
      "AZURE_OPENAI_ENDPOINT",
      "AZURE_OPENAI_KEY",
      "AZURE_OPENAI_DEPLOYMENT",
      "AZURE_EMBEDDINGS_DEPLOYMENT",
      "AZURE_OPENAI_API_VERSION",
    ];
    for (const k of keys) {
      const v = process.env[k];
      console.log(`${k} => ${v ? "set (len=" + v.length + ")" : "<NOT SET>"}`);
    }
    // import and run the test script
    await import("./test-azure-embeddings.mjs");
  } catch (e) {
    console.error("run-test-embeds failed:", e && e.message ? e.message : e);
    process.exit(2);
  }
})();
