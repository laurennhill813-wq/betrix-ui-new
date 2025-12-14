import express from 'express';
import { runAutoMediaTick } from '../jobs/auto-media-ticker.js';

const router = express.Router();

router.post('/jobs/auto-media-tick', async (req, res) => {
  try {
    await runAutoMediaTick();
    res.json({ ok: true });
  } catch (err) {
    console.error('auto-media-tick route failed', err && err.message ? err.message : err);
    res.status(500).json({ ok: false });
  }
});

export default router;
