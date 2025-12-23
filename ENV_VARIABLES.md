(Environment variables required by the project)

- `SPORTBEX_API_KEY`: API key for Sportbex provider (used by `src/routes/sportbex.js` and probe scripts). Set this in your environment when running Sportbex probes or the app.
- `PREFETCH_INTERVAL_SECONDS`: Interval in seconds for prefetch scheduler (default 60).
- `PREFETCH_MAX_BACKOFF_SECONDS`: Maximum backoff in seconds for failing prefetches (default 3600).

Notes:

- Prefetch provider health is stored in Redis keys with prefix `betrix:provider:health:<provider>` (JSON with `ok`, `ts`, `message`).
- Prefetch failure counts are stored under `prefetch:failures:<type>` and backoff schedules under `prefetch:next:<type>`.

