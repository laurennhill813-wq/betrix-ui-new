#!/usr/bin/env node
import fetch from 'node-fetch';
import { createClient as createRedisClient } from 'redis';
import { Client as PgClient } from 'pg';

const timeoutMs = 15000;
const ac = (ms) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(id) };
};

async function testOpenAI() {
  const key = process.env.OPENAI_API_KEY;
  console.log('\n--- OpenAI (api.openai.com) ---');
  if (!key) { console.log('OPENAI_API_KEY not set'); return; }
  const { signal, clear } = ac(timeoutMs);
  try {
    const res = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${key}` }, signal });
    clear();
    console.log('Status:', res.status);
    const txt = await res.text();
    console.log('Body preview:', txt.slice(0,1000));
  } catch (e) { console.log('Error:', e.message || e); }
}

async function testCohere() {
  const key = process.env.COHERE_API_KEY;
  console.log('\n--- Cohere ---');
  if (!key) { console.log('COHERE_API_KEY not set'); return; }
  const { signal, clear } = ac(timeoutMs);
  try {
    const res = await fetch('https://api.cohere.ai/v1/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'command-xlarge', prompt: 'hi', max_tokens: 1 }),
      signal
    });
    clear();
    console.log('Status:', res.status);
    const txt = await res.text();
    console.log('Body preview:', txt.slice(0,1000));
  } catch (e) { console.log('Error:', e.message || e); }
}

async function testAnthropic() {
  const key = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_APIKEY || process.env.ANTHROPIC;
  const anthropicVersion = process.env.ANTHROPIC_API_VERSION || process.env.ANTHROPIC_VERSION || '2023-06-01';
  console.log('\n--- Anthropic ---');
  if (!key) { console.log('ANTHROPIC_API_KEY not set'); return; }
  const { signal, clear } = ac(timeoutMs);
  try {
    const res = await fetch('https://api.anthropic.com/v1/models', { headers: { 'x-api-key': key, 'Anthropic-Version': anthropicVersion }, signal });
    clear();
    console.log('Status:', res.status);
    const txt = await res.text();
    console.log('Body preview:', txt.slice(0,1000));
  } catch (e) { console.log('Error:', e.message || e); }
}

async function testOpenRouter() {
  const key = process.env.OPENROUTER_API_KEY;
  console.log('\n--- OpenRouter ---');
  if (!key) { console.log('OPENROUTER_API_KEY not set'); return; }
  const { signal, clear } = ac(timeoutMs);
  try {
    const res = await fetch('https://api.openrouter.ai/v1/models', { headers: { Authorization: `Bearer ${key}` }, signal });
    clear();
    console.log('Status:', res.status);
    const txt = await res.text();
    console.log('Body preview:', txt.slice(0,1000));
  } catch (e) { console.log('Error:', e.message || e); }
}

async function probeEndpoints(name, key, endpoints, headerNames = ['Authorization']) {
  console.log(`\n--- Probing ${name} endpoints ---`);
  if (!key) { console.log(`${name} key not set`); return null; }
  for (const ep of endpoints) {
    try {
      const headers = {};
      // try common header forms: Authorization: Bearer <key> or x-api-key
      if (headerNames.includes('Authorization')) headers['Authorization'] = `Bearer ${key}`;
      if (headerNames.includes('x-api-key')) headers['x-api-key'] = key;
      const { signal, clear } = ac(timeoutMs);
      const res = await fetch(ep, { headers, signal });
      clear();
      console.log(`${name} -> tried ${ep} status=${res.status}`);
      const txt = await res.text();
      console.log('Body preview:', txt.slice(0,1000));
      return { endpoint: ep, status: res.status, body: txt };
    } catch (e) {
      console.log(`${name} -> ${ep} error:`, e.message || e);
    }
  }
  return null;
}

async function testGROQ() {
  const key = process.env.GROQ_API_KEY;
  // GROQ is used by Sanity and other services; try common public hosts
  const endpoints = [
    'https://api.groq.dev/v1/models',
    'https://api.groq.ai/v1/models',
    'https://api.groq.io/v1/models'
  ];
  return await probeEndpoints('GROQ', key, endpoints, ['Authorization', 'x-api-key']);
}

async function testDeepSeek() {
  const key = process.env.DEEPSEEK_API_KEY;
  const candidates = [
    { method: 'GET', url: 'https://api.deepseek.ai/v1/models' },
    { method: 'GET', url: 'https://api.deepseek.com/v1/models' },
    { method: 'GET', url: 'https://api.deepseek.io/v1/models' },
    { method: 'GET', url: 'https://deepseek.ai/api/v1/models' },
    { method: 'POST', url: 'https://api.deepseek.ai/v1/generate', body: { prompt: 'hello', max_tokens: 1 } },
    { method: 'POST', url: 'https://api.deepseek.com/v1/generate', body: { prompt: 'hello', max_tokens: 1 } },
    { method: 'POST', url: 'https://deepseek.ai/api/v1/generate', body: { prompt: 'hello', max_tokens: 1 } },
  ];
  console.log('\n--- DeepSeek aggressive probe ---');
  if (!key) { console.log('DEEPSEEK_API_KEY not set'); return null; }
  for (const c of candidates) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      headers['Authorization'] = `Bearer ${key}`;
      // also try x-api-key if Authorization fails
      const { signal, clear } = ac(timeoutMs);
      const opts = { method: c.method, headers, signal };
      if (c.body) opts.body = JSON.stringify(c.body);
      const res = await fetch(c.url, opts);
      clear();
      console.log(`DeepSeek -> tried ${c.url} ${c.method} status=${res.status}`);
      const txt = await res.text();
      console.log('Body preview:', txt.slice(0,1000));
      return { endpoint: c.url, status: res.status, body: txt };
    } catch (e) {
      console.log(`DeepSeek -> ${c.url} error:`, e.message || e);
    }
  }
  // try header alternative
  for (const c of candidates) {
    try {
      const headers = { 'Content-Type': 'application/json', 'x-api-key': key };
      const { signal, clear } = ac(timeoutMs);
      const opts = { method: c.method, headers, signal };
      if (c.body) opts.body = JSON.stringify(c.body);
      const res = await fetch(c.url, opts);
      clear();
      console.log(`DeepSeek (x-api-key) -> tried ${c.url} ${c.method} status=${res.status}`);
      const txt = await res.text();
      console.log('Body preview:', txt.slice(0,1000));
      return { endpoint: c.url, status: res.status, body: txt };
    } catch (e) {
      console.log(`DeepSeek (x-api-key) -> ${c.url} error:`, e.message || e);
    }
  }
  return null;
}

async function testRedis() {
  const url = process.env.REDIS_URL || process.env.REDIS;
  console.log('\n--- Redis ---');
  if (!url) { console.log('REDIS_URL not set'); return; }
  const client = createRedisClient({ url });
  try {
    await client.connect();
    const pong = await client.ping();
    console.log('Connected, PING ->', pong);
    await client.disconnect();
  } catch (e) { console.log('Redis error:', e.message || e); try { await client.disconnect(); } catch {} }
}

async function testPostgres() {
  const url = process.env.DATABASE_URL;
  console.log('\n--- Postgres ---');
  if (!url) { console.log('DATABASE_URL not set'); return; }
  const client = new PgClient({ connectionString: url });
  try {
    await client.connect();
    const res = await client.query('SELECT 1 as ok');
    console.log('Query result:', res.rows && res.rows[0]);
    await client.end();
  } catch (e) { console.log('Postgres error:', e.message || e); try { await client.end(); } catch {} }
}

async function testTelegram() {
  const token = process.env.TELEGRAM_TOKEN;
  console.log('\n--- Telegram Bot ---');
  if (!token) { console.log('TELEGRAM_TOKEN not set'); return; }
  const { signal, clear } = ac(timeoutMs);
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, { signal });
    clear();
    console.log('Status:', res.status);
    const txt = await res.text();
    console.log('Body preview:', txt.slice(0,1000));
  } catch (e) { console.log('Error:', e.message || e); }
}

async function main() {
  console.log('Starting connectivity checks (timeout', timeoutMs, 'ms)');
  await testOpenAI();
  await testCohere();
  await testAnthropic();
  await testOpenRouter();
  await testRedis();
  await testPostgres();
  await testTelegram();
  console.log('\nConnectivity checks complete.');
}

main().catch(e => { console.error('Fatal error', e); process.exit(1); });
