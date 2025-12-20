# FlashLive Sports (FlashLive)

Fast live scores, standings and detailed stats across 30+ sports.

Summary
- Popularity: 9.9 / 10
- Latency (observed): ~346ms
- Pricing tiers: BASIC (free), PRO $10/mo, ULTRA $39/mo, MEGA $99/mo
- Support: tipsters@rapi.one | https://t.me/api_tipsters
- Docs: https://flashlive.rapi.one/ and OpenAPI spec (Flashlive-sports)

Quick curl (RapidAPI example)

curl --request GET \
  --url 'https://flashlive-sports.p.rapidapi.com/v1/news/list?entity_id=1&page=0&category_id=59&locale=en_INT' \
  --header 'x-rapidapi-host: flashlive-sports.p.rapidapi.com' \
  --header 'x-rapidapi-key: <RAPIDAPI_KEY>'

Quick curl (Direct provider using `x-portal-apikey` header)

curl --request GET \
  --url 'https://flashlive-sports-api.hgapi.top/v1/events/list?locale=en_INT&page=0' \
  --header 'x-portal-apikey: <FLASHLIVE_API_KEY>'

Auth / Headers
- RapidAPI: `x-rapidapi-key`, `x-rapidapi-host` (when via RapidAPI)
- Direct API: `x-portal-apikey` (preferred header) or `x-portal-apikey` as query param

Recommended integration points
- /v1/events/live-list — list of currently live events (useful for live-match feeds)
- /v1/events/list — upcoming events by sport/tournament/date
- /v1/events/details, /v1/events/odds — per-event detailed data
- /v1/news/list, /v1/news/top — news integration (for UI thumbnails and articles)

Notes for Betrix integration
- We added `FlashLiveService` at `src/services/flashlive-service.js` which uses `x-portal-apikey` (env: `FLASHLIVE_API_KEY` / `FLASHLIVE_KEY`) and `FLASHLIVE_HOST`.
- Scheduler writes normalized keys under `rapidapi:flashlive:fixtures:live` and `rapidapi:flashlive:fixtures:upcoming` so these fixtures are picked up by the unified aggregator.
- To enable locally, set:
  - `FLASHLIVE_API_KEY` (your key)
  - `FLASHLIVE_HOST` (optional; default `flashlive-sports-api.hgapi.top`)

Contact / Support
- Vendor support: tipsters@rapi.one
