import express from 'express';
import { fetchSportbex } from '../lib/sportbex-client.js';

const router = express.Router();

// Convenience: GET /sportbex/competitions/:sportId
router.get('/sportbex/competitions/:sportId', async (req, res) => {
  try {
    const { sportId } = req.params;
    const p = `/betfair/competitions/${encodeURIComponent(sportId)}`;
    const r = await fetchSportbex(p);
    return res.status(r.httpStatus || 200).json(r.body || { ok: false });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e && e.message ? e.message : String(e) });
  }
});

// Convenience: GET /sportbex/events/:competitionId
router.get('/sportbex/events/:competitionId', async (req, res) => {
  try {
    const { competitionId } = req.params;
    const p = `/betfair/events/${encodeURIComponent(competitionId)}`;
    const r = await fetchSportbex(p + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''));
    return res.status(r.httpStatus || 200).json(r.body || { ok: false });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e && e.message ? e.message : String(e) });
  }
});

// Generic proxy: GET /sportbex/proxy?path=/betfair/marketIds/...
router.get('/sportbex/proxy', async (req, res) => {
  try {
    const path = req.query.path;
    if (!path) return res.status(400).json({ ok: false, error: 'missing path query param' });
    const r = await fetchSportbex(path + (req.url.includes('?') && req.url.includes('&') ? '&' + req.url.split('&').slice(1).join('&') : ''));
    return res.status(r.httpStatus || 200).json(r.body || { ok: false });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e && e.message ? e.message : String(e) });
  }
});

// Market Odds (POST): POST /sportbex/market-odds -> body forwarded
router.post('/sportbex/market-odds', express.json(), async (req, res) => {
  try {
    const body = req.body || {};
    const r = await fetchSportbex('/betfair/market-odds', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
    return res.status(r.httpStatus || 200).json(r.body || { ok: false });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e && e.message ? e.message : String(e) });
  }
});

export default function createSportbexRouter() { return router; }
