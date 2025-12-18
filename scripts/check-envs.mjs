const keys = [
  "AZURE_OPENAI_ENDPOINT",
  "AZURE_OPENAI_KEY",
  "AZURE_OPENAI_DEPLOYMENT",
  "AZURE_EMBEDDINGS_DEPLOYMENT",
  "AZURE_OPENAI_API_VERSION",
  "REDIS_URL",
];
for (const k of keys) {
  const v = process.env[k];
  if (v === undefined) console.log(`${k}=<NOT SET>`);
  else console.log(`${k}=set (len=${v.length})`);
}
