# SportGameOdds Integration — Pagination & CLI

This file documents the pagination helpers and the small CLI added to fetch paginated results from the SportGameOdds provider.

Files added/modified

- `src/services/sportsgameodds.js` — added `fetchAllEvents`, `fetchAllTeams`, `fetchAllOdds` helpers. These perform cursor-based pagination, perform a per-request rate-limit check using Redis, and cache aggregated results briefly.

- `tools/sgo-paginate.js` — CLI wrapper that invokes the new helpers and prints counts & sample items.

Quick CLI usage (PowerShell)

```powershell
# Using mock redis (no REDIS_URL) and the provided API key
$env:SPORTSGAMEODDS_API_KEY='d95d85bced0f6106cd1b2e5e6fcd8c85'
$env:USE_MOCK_REDIS='1'
node .\tools\sgo-paginate.js --league=nba --what=events --limit=100

# With a real Redis instance
$env:SPORTSGAMEODDS_API_KEY='YOUR_KEY'
$env:REDIS_URL='redis://:password@redis-host:6379'
node .\tools\sgo-paginate.js --league=epl --what=odds --limit=100
```

Examples: using the service programmatically

```javascript
import { getRedis } from './src/lib/redis-factory.js';
import { fetchAllEvents, fetchAllOdds } from './src/services/sportsgameodds.js';

const redis = getRedis();
const events = await fetchAllEvents({ league: 'nba', limit: 100, redis, forceFetch: true });
console.log('events count', events.length);

const odds = await fetchAllOdds({ league: 'nba', limit: 100, redis, forceFetch: true });
console.log('odds count', odds.length);
```

Notes & recommendations

- The helpers respect the existing rate limit implementation (env: `SPORTSGAMEODDS_RATE_LIMIT_PER_MIN`). If the Redis-based minute bucket is full the helpers throw; the CLI surfaces that as an error.

- Aggregated results are cached briefly (default `SPORTSGAMEODDS_CACHE_TTL=600` seconds). Use `forceFetch: true` to bypass cache.

- When fetching many pages, expect the request to take longer; consider using the CLI or a worker job to prefetch/populate Redis for popular leagues.

Next steps

- Run the CLI for sample leagues (`nba`, `epl`, `nfl`) and share a sample `events` and `odds` JSON here. I will produce the final Redis key schema and adapt the Telegram callback handlers to the provider payload if you want.

SportGameOdds integration — quick guide

Purpose

- Inspect SportGameOdds API payloads, populate Redis cache, and map payloads into Telegram menus.

Prerequisites

- `SPORTSGAMEODDS_API_KEY` set in your environment or on Render.

- `REDIS_URL` or `USE_MOCK_REDIS=1` for local testing.

- `jq` installed for the shell script output formatting.

Quick steps

1. Install dependencies (same as project):

```pwsh
npm install
```

1. Run the direct curl script to inspect raw payloads:

```pwsh
bash tools/sgo-calls.sh
```

1. Use the Node inspector to fetch and cache payloads via app code:

```pwsh
node tools/inspect-sgo.js nba epl nfl
```

What the inspector does

- Calls `fetchEvents` then `fetchOdds` for the first event per league using the `sportsgameodds` service added to `src/services`.

- Stores results into Redis using the service's caching logic.

-- Prints the JSON payloads (truncated for console readability).

Next steps (after you run inspector)

- Share one sample `events` and `odds` payload here and I will propose the concrete Redis schema mapping and the exact Telegram menu layout and callback mapping for all sports.

If you want, I can prepare a PR that also adds a small scheduled job to prefetch popular leagues on a 10-minute cadence to avoid hitting provider limits.
