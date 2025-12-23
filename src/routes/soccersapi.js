import express from 'express';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const router = express.Router();

// GET /api/soccersapi/leagues - return cached leagues or fetch directly
router.get('/soccersapi/leagues', async (req, res) => {
  const app = req.app;
  const redis = app.locals && app.locals.redis;
  const cacheKey = 'rapidapi:soccersapi:leagues';
  try {
    if (redis) {
      const cached = await redis.get(cacheKey).catch(() => null);
      if (cached) return res.json(JSON.parse(cached));
    }
  } catch (e) {
    // continue to fetch directly
  }

  // Load directUrl from subscriptions.json
  try {
    const subsPath = path.join(process.cwd(), 'src', 'rapidapi', 'subscriptions.json');
    const raw = fs.readFileSync(subsPath, 'utf8');
    const subs = JSON.parse(raw);
    const entry = (Array.isArray(subs) ? subs.find(s => s.host && s.host.includes('soccersapi')) : null) || subs.soccersapi;
    const url = entry && (entry.directUrl || entry.sampleEndpoint || entry.sampleEndpoints && entry.sampleEndpoints[0]);
    if (!url) return res.status(404).json({ ok: false, error: 'SoccersAPI directUrl not found in subscriptions.json' });

    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) return res.status(502).json({ ok: false, status: r.status, statusText: r.statusText });
    const body = await r.json();
    const leagues = Array.isArray(body.data) ? body.data.map(l => ({ id: l.id || l.league_id || null, name: l.name || l.title || l.league })) : [];
    const out = { ok: true, source: 'soccersapi', count: leagues.length, leagues };
    if (redis) await redis.set(cacheKey, JSON.stringify(out), 'EX', 300).catch(() => null);
    return res.json(out);
  } catch (e) {
    return res.status(500).json({ ok: false, error: e && e.message ? e.message : String(e) });
  }
});

export default function createSoccersRouter() { return router; }
