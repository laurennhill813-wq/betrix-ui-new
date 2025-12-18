import Redis from "ioredis";
import { AzureAIService } from "../src/services/azure-ai.js";
import createRag from "../src/ai/rag.js";

(async function () {
  try {
    const redis = new Redis(process.env.REDIS_URL);
    const azure = new AzureAIService(
      process.env.AZURE_OPENAI_ENDPOINT,
      process.env.AZURE_OPENAI_KEY,
      process.env.AZURE_OPENAI_DEPLOYMENT,
      process.env.AZURE_OPENAI_API_VERSION,
      {
        embeddingsDeployment: process.env.AZURE_EMBEDDINGS_DEPLOYMENT,
        logger: console,
      },
    );
    const rag = createRag({ redis, azure, logger: console });
    const id = "manual-test-" + Date.now();
    const text =
      "Hello from manual RAG index test at " + new Date().toISOString();
    console.log("Indexing document", id);
    await rag.indexDocument(id, text, { source: "manual-test" });
    console.log("Indexed", id);

    // scan for vec:* keys
    let cursor = "0";
    const found = [];
    do {
      const res = await redis.scan(cursor, "MATCH", "vec:*", "COUNT", 1000);
      cursor = res[0];
      const keys = res[1] || [];
      if (keys.length) found.push(...keys);
    } while (cursor !== "0");
    console.log("Found vec keys (sample 50):", found.slice(0, 50));
    if (found.length) {
      const match = found.find((k) => k.includes(id)) || found[0];
      const h = await redis.hgetall(match);
      console.log("Sample hgetall for", match, h);
    }
    await redis.quit();
  } catch (e) {
    console.error("TEST_FAILED", e && e.message ? e.message : e);
    if (e && e.cause) console.error("Cause:", e.cause);
    process.exit(1);
  }
})();
