# Sportradar environment variables (sample)

Provide these environment variables in your deployment environment. Do NOT commit real keys to the repo.

- `SPORTRADAR_KEY` — your Sportradar API key (required for prefetch).
- `REDIS_URL` — Redis connection string (e.g. `redis://:password@host:6379`).
- `SPORTRADAR_PREFETCH_CRON` — cron expression for periodic prefetch (default `"*/5 * * * *"`).
- `SPORTRADAR_QPS_LIMIT` — QPS limit for Sportradar (default `5`).
- `SPORTRADAR_TTL_SEC` — TTL in seconds for fixtures cache (default `120`).
- `SPORTRADAR_TTL_TEAMS` — TTL in seconds for teams cache (default `300`).

Example `.env` snippet:

```
SPORTRADAR_KEY=<redacted>
REDIS_URL=redis://:password@redis.example.com:6379
SPORTRADAR_PREFETCH_CRON="*/15 * * * *"
SPORTRADAR_QPS_LIMIT=5
SPORTRADAR_TTL_SEC=120
SPORTRADAR_TTL_TEAMS=300
```

Supported sports are: soccer, nba, nfl, mlb, nhl, tennis, nascar. To extend, edit `src/config/sportradar-sports.js`.
