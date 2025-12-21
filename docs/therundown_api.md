# TheRundown API — Integration Reference

This document contains TheRundown API documentation (v1 and v2) consolidated for integration into this project. It includes updates, endpoints, examples, and notes taken from the official docs.

---

## Updates (chronological highlights)

- Aug 29, 2025 — Markets by sport and date endpoint: `GET /v2/sports/<sport-id>/markets/<date>` added.
- Apr 26, 2025 — Websocket filtering with `sport_ids`, `event_ids`, and `date` added.
- Apr 26, 2025 — Line periods reference added (period ids for full game, halves, periods, live, etc.).
- Nov 10, 2024 — Get available markets for all sports by date (`/api/v2/sports/markets/YYYY-MM-DD`).
- Sep 28, 2024 — Conference and Division Schedule Filtering for schedules endpoint.
- Aug 24, 2024 — US Political Futures added.
- Jun 18, 2024 — V2 API Guide published.
- Oct 22, 2023 — Player and Team Game Stats Complete Indication (`meta.complete`).
- Aug 19, 2023 — Websocket filtering for scores and public player/team prop markets.
- (See original docs for full changelog.)

---

## Overview

TheRundown provides real-time odds, scores, schedules, and stats from multiple sportsbooks. Use V1 for legacy endpoints and snapshots; use V2 for advanced markets (player/team/game props, market participants, and more efficient delta updates).

Base hosts:
- V1 (non-RapidAPI): `https://api.therundown.io/api/v1/`
- WebSocket: `wss://therundown.io/api/v1/ws?key=<key>`

Authentication: pass API key as `X-TheRundown-Key: <key>` header or `?key=<key>` query parameter.

Notes:
- Any value `0.0001` denotes NotPublished / off the board.
- Prefer `teams_normalized` for stable team identifiers.
- Use V2 delta for market-level changes; V1 delta returns changed events.

---

## Line Periods (period_id values)

Period mapping:
- 0 — PeriodFullGame
- 1 — PeriodFirstHalf
- 2 — PeriodSecondHalf
- 3 — PeriodFirstPeriod
- 4 — PeriodSecondPeriod
- 5 — PeriodThirdPeriod
- 6 — PeriodFourthPeriod
- 7 — PeriodLiveFullGame

---

## Websockets

- Use secure websocket `wss://therundown.io/api/v1/ws?key=<key>`.
- Filtering params supported (example): `?affiliate_ids=3,0&sport_ids=1,2&event_ids=abc,def&date=2025-05-26`.
- Messages include meta.type (`spread`, `moneyline`, `total`, `score`, etc.) and `data` payloads.

Example market update (spread):

{"meta":{"type":"spread"},"data":{...}}

Example score update:

{"meta":{"type":"score"},"data":{"sport_id":13,"event_id":"...","event_status":"STATUS_FIRST_HALF",...}}

---

## Key Endpoints (summary)

Sports & metadata:
- `GET /sports` — List sports and ids.
- `GET /<sport-id>/dates` — Dates containing odds for upcoming events.
- `GET /<sport-id>/conferences` — Conferences for sport.
- `GET /<sport-id>/divisions` — Divisions for sport.

Affiliates (sportsbooks):
- `GET /affiliates`

Events / Odds (V1):
- `GET /<sport-id>/events/<date>`
- `GET /<sport-id>/openers/<date>`
- `GET /<sport-id>/closing/<date>`
- `GET /v1/delta?last_id=<delta-last-id>`
- `GET /events/<event-id>`

Historical lines:
- `GET /lines/<line-id>/moneyline`
- `GET /lines/<line-id>/spread`
- `GET /lines/<line-id>/total`

Teams & Players:
- `GET /sports/<sport-id>/teams`
- `GET /v2/teams/<team-id>/players` (V2)

Schedules:
- `GET /sports/<sport-id>/schedule` — with `from`, `limit`, `season_year`, `conference_id`, `division_id`, `team_id`, etc.

V2 — Markets, Stats, Delta (recommended for market-level updates):
- `GET /v2/delta?last_id=<delta-last-id>` — market changes since last id.
- `GET /v2/<sport-id>/events/<date>` — V2 market events by sport and date.
- `GET /v2/events/<event-id>` — V2 single event markets & scores.
- `GET /v2/events/<event-id>/markets` — list markets for an event.
- `GET /v2/markets/participants` — participants info for markets/events.
- `GET /v2/sports/<sport-id>/markets/<date>` — markets for sport/date (added Aug 29, 2025).
- `GET /v2/markets` — list all available markets.

Stats endpoints (V2):
- `GET /v2/stats` — list available stats metadata.
- `GET /v2/teams/<team-id>/stats` — season stats for a team.
- `GET /v2/teams/<team-id>/players/stats` — players' season stats for a team.
- `GET /v2/events/<event-id>/stats` — team stats for an event.
- `GET /v2/events/<event-id>/players/stats` — player stats for an event.

---

## Delta usage notes

- Use the `last_id` from previous responses to request only changes since that id.
- Filter by `sport_id` or `affiliate_ids` as needed: `?affiliate_ids=3` or `?affiliate_ids=0,3` (0 returns score/event info).
- If too many updates occurred, the delta endpoint can return HTTP 400; in that case fetch a full snapshot from the events endpoint and restart with updated `last_id`.

---

## Examples & Quick Curl

Get conferences (example via RapidAPI headers):

curl --request GET \
  --url https://therundown-therundown-v1.p.rapidapi.com/sports/1/conferences \
  --header 'x-rapidapi-host: therundown-therundown-v1.p.rapidapi.com' \
  --header 'x-rapidapi-key: <key>'

Get all markets for a date (V2):

https://therundown.io/api/v2/sports/markets/2024-09-17?key=<your-key>

---

## Integration suggestions for this project

- Use the V2 delta endpoint to keep local cache of markets up-to-date.
- Subscribe to WebSocket with `affiliate_ids` and `sport_ids` filters to reduce message noise.
- Map teams using the `teams_normalized.team_id` for stable identifiers.

---

## Source / Full Original Content

This file consolidates the project-provided copy of TheRundown API docs. For any missing details (examples, full JSON schemas, or Postman collections) consult TheRundown official docs or contact@therundown.io.
