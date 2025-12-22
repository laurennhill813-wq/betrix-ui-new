# Football / NFL RapidAPI Integration (quick start)

This file explains how to use the small RapidAPI client modules added under `src/api`.

1) Set environment variables (never commit your real key):

```
RAPIDAPI_KEY=your_rapidapi_key_here
RAPIDAPI_HOST_FREE_FOOTBALL=free-football-api-data.p.rapidapi.com
RAPIDAPI_HOST_NFL=nfl-api-data.p.rapidapi.com
```

2) Example usage (browser or server-side code with `fetch` available):

```js
import freeFootball from './src/api/freeFootballApi.js';
import nflApi from './src/api/nflApi.js';

// Get event statistics
const stats = await freeFootball.getEventStatistics(12650707).catch(err => { console.error(err); });

// Get NFL team listing
const teams = await nflApi.getTeamListing().catch(err => { console.error(err); });
```

3) Protecting the key

- For public frontends, do NOT embed `RAPIDAPI_KEY` in client-side code. Instead create a small server/proxy endpoint that forwards requests to RapidAPI and injects the key.

Example Node/Express proxy snippet:

```js
// server/routes/football.js
import express from 'express';
import freeFootball from '../../src/api/freeFootballApi.js';
const router = express.Router();

router.get('/event-stats/:id', async (req, res) => {
  try {
    const data = await freeFootball.getEventStatistics(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, detail: err.body });
  }
});

export default router;
```

4) Notes

- RapidAPI sometimes returns 403/Forbidden when the host or key are incorrect or the subscription is blocked. Verify `x-rapidapi-host` and `x-rapidapi-key` headers.
- Some endpoints may require different path or query parameter names — consult RapidAPI endpoint docs.

5) Server proxy / CI

- The project exposes a server-side proxy at `/api/football/*` which keeps your `RAPIDAPI_KEY` server-side. Endpoints added:
  - `GET /api/football/event-stats/:id`
  - `GET /api/football/matches`
  - `GET /api/football/nfl/teams`
  - `GET /api/football/metrics` (Prometheus metrics)

- Basic protections included:
  - Rate limiting (15 requests / 30s per IP) to protect RapidAPI quota
  - Prometheus metrics (useful with Prometheus scraping)

- A lightweight frontend widget is available at `/football-widget.html` which calls the proxy and renders fixtures (suitable for embedding on a dashboard).

- A GitHub Actions workflow `ci.yml` was added at `.github/workflows/ci.yml` to run the repository tests on push/PR to `main`.
