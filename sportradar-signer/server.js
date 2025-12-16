import express from 'express';
import bodyParser from 'body-parser';
import pino from 'pino';
import cors from 'cors';
import { config } from './config.js';
import { signSportradarAsset } from './signer.js';
import { localTmpDir } from './storage.js';
import path from 'path';
import fs from 'fs';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '5mb' }));

// Health
app.get('/healthz', (req, res) => res.json({ ok: true }));

// POST /sign { url }
app.post('/sign', async (req, res) => {
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'missing url' });
  try {
    const signedUrl = await signSportradarAsset(url);
    return res.json({ signedUrl });
  } catch (err) {
    logger.error({ err: err && err.message }, 'sign failed');
    return res.status(500).json({ error: err && err.message });
  }
});

// Serve local fallback files when storage is filesystem-based
const localDir = localTmpDir();
if (localDir && fs.existsSync(localDir)) {
  app.use('/_signer_local', express.static(localDir, { index: false }));
} else {
  // ensure dir exists so later uploads will be servable
  try {
    fs.mkdirSync(localDir, { recursive: true });
    app.use('/_signer_local', express.static(localDir, { index: false }));
  } catch (e) {
    logger.warn('Could not create local signer dir', e && e.message);
  }
}

const port = config.port || 8080;
app.listen(port, () => logger.info(`sportradar-signer listening on ${port}`));

export default app;
