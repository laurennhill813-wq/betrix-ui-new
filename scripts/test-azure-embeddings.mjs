import path from "path";
import { fileURLToPath } from "url";
import { AzureAIService } from "../src/services/azure-ai.js";

(async () => {
  try {
    const svc = new AzureAIService(
      process.env.AZURE_OPENAI_ENDPOINT,
      process.env.AZURE_OPENAI_KEY,
      process.env.AZURE_OPENAI_DEPLOYMENT,
      process.env.AZURE_OPENAI_API_VERSION,
    );
    console.log("Using embeddings deployment:", svc.embeddingsDeployment);
    const inputs = ["hello world", "football match"];
    const v = await svc.embeddings(inputs);
    if (!Array.isArray(v)) {
      console.error("Embeddings call returned non-array:", v);
      process.exit(2);
    }
    console.log(
      "Embeddings returned",
      v.length,
      "vectors. First vector length:",
      Array.isArray(v[0]) ? v[0].length : typeof v[0],
    );
    process.exit(0);
  } catch (err) {
    console.error("Embed test failed:", err && err.message ? err.message : err);
    if (err && err.stack) console.error(err.stack);
    process.exit(3);
  }
})();
