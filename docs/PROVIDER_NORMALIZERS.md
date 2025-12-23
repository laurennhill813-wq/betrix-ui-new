Provider normalizers and probes

Summary
- The aggregator can now publish provider metadata to Redis at the key `rapidapi:providers:meta`.
- For providers that expose only lists (teams/seasons/conferences), the aggregator records metadata and may optionally run a best-effort probe to fetch fixtures when `RAPIDAPI_KEY` is set.

How to add a normalizer
1. Add a function to `src/lib/rapidapi-normalizers.js` that accepts a provider metadata object and returns an enriched meta shape.
2. Export a `dispatch` map keyed by RapidAPI host (e.g. `sportspage-feeds.p.rapidapi.com`).
3. The aggregator will dynamically import `src/lib/rapidapi-normalizers.js` and use any matching normalizer to enrich `providersMeta`.

Example normalizer (already present):
- `sportspage-feeds.p.rapidapi.com` -> returns `{ provider: 'sportspage', kind: 'team-list', teams: [...] }`

Probes
- Probes are best-effort and only run if `RAPIDAPI_KEY` is available in the environment.
- Probe endpoints are conservative guesses and may be updated per-provider in `src/lib/fixtures-aggregator.js`.
- If you add additional probe endpoints, add them to the `probeEndpoints` map in `src/lib/fixtures-aggregator.js`.

Publishing
- The aggregator writes provider metadata to Redis at `rapidapi:providers:meta` as a JSON string.
- The UI can read that key to display which providers, teams, seasons, or leagues are available.

Notes
- Probes and normalization are intentionally non-fatal: errors are swallowed to avoid breaking aggregation.
- Implement provider-specific richer probes where API docs are available to improve fixture extraction.
