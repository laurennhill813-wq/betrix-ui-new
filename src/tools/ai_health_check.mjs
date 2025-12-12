#!/usr/bin/env node
import { AzureAIService } from '../services/azure-ai.js';
import { HuggingFaceService } from '../services/huggingface.js';

async function checkAzure() {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const key = process.env.AZURE_OPENAI_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const embDeploy = process.env.AZURE_EMBEDDINGS_DEPLOYMENT || process.env.AZURE_OPENAI_EMBEDDINGS || 'text-embedding-3-large';
  console.log('\n=== Azure AI Check ===');
  if (!endpoint || !key || !deployment) {
    console.log('Azure config missing: make sure AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_KEY, AZURE_OPENAI_DEPLOYMENT are set');
    return;
  }
  const s = new AzureAIService(endpoint, key, deployment, process.env.AZURE_OPENAI_API_VERSION || undefined, { timeoutMs: 60000, logger: console });
  console.log('Azure enabled:', s.enabled);
  try {
    console.log('Attempting embeddings probe (small)');
    const emb = await s.embeddings(['hello']);
    console.log('Embeddings success: length=', Array.isArray(emb) ? emb.length : 'unknown');
  } catch (e) {
    console.error('Embeddings probe failed:', e && e.message || e);
  }
  try {
    console.log('Attempting chat probe (small)');
    const out = await s.chat('Hello');
    console.log('Chat probe success preview:', String(out).slice(0,200));
  } catch (e) {
    console.error('Chat probe failed:', e && e.message || e);
  }
}

async function checkHuggingFace() {
  console.log('\n=== HuggingFace Check ===');
  const models = process.env.HUGGINGFACE_MODELS || process.env.HUGGINGFACE_MODEL || '';
  const token = process.env.HUGGINGFACE_TOKEN || process.env.HUGGINGFACE_API_KEY || null;
  if (!models) {
    console.log('No HuggingFace models configured (HUGGINGFACE_MODELS/HUGGINGFACE_MODEL)');
    return;
  }
  const hf = new HuggingFaceService(models, token);
  console.log('HuggingFace enabled:', hf.enabled, 'models:', hf.models);
  try {
    const out = await hf.chat('Hello from health-check');
    console.log('HuggingFace chat success preview:', String(out).slice(0,300));
  } catch (e) {
    console.error('HuggingFace probe failed:', e && e.message || e);
  }
}

async function main() {
  await checkAzure();
  await checkHuggingFace();
  console.log('\nAI health check complete.');
}

main().catch(e => { console.error('Health check script error', e); process.exit(1); });
