import express from 'express';
import rateLimit from 'express-rate-limit';
import promClient from 'prom-client';
import freeFootball from '../api/freeFootballApi.js';
import nflApi from '../api/nflApi.js';

const router = express.Router();

// Basic rate limiting to protect RapidAPI quota
const limiter = rateLimit({
  windowMs: 30 * 1000, // 30s
  max: 15, // max 15 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
});

// Prometheus metrics
const collectDefault = promClient.collectDefaultMetrics;
try { collectDefault(); } catch (e) { /* ignore in environments without metrics */ }
const httpRequestDuration = new promClient.Histogram({
  name: 'football_proxy_request_duration_seconds',
  help: 'Duration of requests to football proxy',
  labelNames: ['route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.3, 1, 3],
});

router.use(limiter);

// Metrics endpoint (exposed under /api/football/metrics)
router.get('/metrics', async (_req, res) => {
  try {
    res.set('Content-Type', promClient.register.contentType);
    const body = await promClient.register.metrics();
    res.send(body);
  } catch (err) {
    res.status(500).send(err.message || 'metrics error');
  }
});

async function proxyHandler(routeName, fn, req, res) {
  const end = httpRequestDuration.startTimer({ route: routeName });
  try {
    const data = await fn();
    end({ status: '200' });
    return res.json({ ok: true, data });
  } catch (err) {
    const status = err && err.status ? err.status : 500;
    end({ status: String(status) });
    console.warn(`[football proxy] ${routeName} error`, err && err.message ? err.message : err);
    return res.status(status).json({ ok: false, error: err.message || 'proxy error', detail: err.body || null });
  }
}

// GET /api/football/event-stats/:id
router.get('/event-stats/:id', async (req, res) => {
  const id = req.params.id;
  return proxyHandler('event-stats', () => freeFootball.getEventStatistics(id), req, res);
});

// GET /api/football/matches  (passes query params through)
router.get('/matches', async (req, res) => {
  const params = req.query || {};
  return proxyHandler('matches', () => freeFootball.getMatches(params), req, res);
});

// GET /api/football/nfl/teams
router.get('/nfl/teams', async (req, res) => {
  return proxyHandler('nfl-teams', () => nflApi.getTeamListing(), req, res);
});

export default router;
