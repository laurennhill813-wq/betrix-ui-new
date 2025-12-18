Render Deployment Notes

This file lists the recommended Render environment variables and a sample Scheduled Job payload for the auto-media ticker.

Required env vars

- `REDIS_URL`: URL to Redis instance used for caching, liveliness counters, and last-chat persistence.
- `TELEGRAM_BOT_TOKEN`: Bot token used to send messages/photos (set to enable outgoing sends).
- `BOT_BROADCAST_CHAT_ID`: Numeric Telegram `chat.id` where the bot should post (populate after retrieving from webhook or admin endpoint).

Recommended/Optional env vars

- `ADMIN_API_KEY`: Short secret used to protect admin endpoints (set this before enabling public access to `/api/admin/*`).
- `DEBUG_TELEGRAM_UPDATES`: Set to `true` temporarily to surface raw Telegram webhook payloads in service logs for one-off extraction of `chat.id`.
- `SPORTRADAR_KEY`: Sportradar API key if you want to enable Sportradar provider functionality.
- Provider keys (optional): `REUTERS_KEY`, `AP_CONTENT_KEY`, `AP_IMAGES_KEY`, `GETTY_KEY`, `IMAGN_KEY`, `ODDS_PREMATCH_KEY`, `ODDS_PROPS_KEY`, `ODDS_FUTURES_KEY`, `ODDS_REGULAR_KEY`, `NBA_API_KEY`, `NHL_API_KEY`, `NFL_API_KEY`, `NCAAMB_API_KEY`, `TENNIS_API_KEY` — set as needed for additional providers present in `src/config/providers_full.js`.
- `PORT`: Port to listen on (Render sets this automatically; default 5000 used locally).

How to obtain `BOT_BROADCAST_CHAT_ID`

- Option A (recommended):
  1. Set `REDIS_URL` and `ADMIN_API_KEY` in Render and redeploy.
  2. Send any message to your Telegram bot from the target chat.
  3. Call the admin endpoint to read the last seen chat id:
     - GET `https://<your-service>.onrender.com/api/admin/last-chat`
     - Header: `x-admin-key: <ADMIN_API_KEY>`
  4. Copy the returned `chat_id` into `BOT_BROADCAST_CHAT_ID` and restart.

- Option B (ephemeral / debugging):
  1. Set `DEBUG_TELEGRAM_UPDATES=true` in Render and redeploy.
  2. Send a message to the bot and inspect service logs to find the `message.chat.id` value.
  3. Turn `DEBUG_TELEGRAM_UPDATES` off immediately after retrieving the id.

Sample Render Scheduled Job (auto-media ticker)

- Purpose: trigger the job that posts aggregated media to the configured `BOT_BROADCAST_CHAT_ID`.
- Endpoint (POST):
  - `https://<your-service>.onrender.com/api/jobs/auto-media-tick`
  - Method: `POST`
  - Body: none (the job reads env and Redis state)
  - Headers: none required
- Example Render Scheduled Job configuration:
  - Name: `auto-media-ticker`
  - URL: `https://<your-service>.onrender.com/api/jobs/auto-media-tick`
  - HTTP Method: `POST`
  - Schedule: e.g., `@hourly` or `0 * * * *` (choose cadence appropriate to your rate limits)

Notes & Safety

- The service purposely no-ops when `TELEGRAM_BOT_TOKEN` or `BOT_BROADCAST_CHAT_ID` are missing. This prevents accidental posts during testing/deploy.
- Prefer using the `ADMIN_API_KEY` to gate admin-only endpoints. Do not expose `ADMIN_API_KEY` publicly.
- If you enable `DEBUG_TELEGRAM_UPDATES`, treat logs as sensitive — they contain raw webhook payloads. Only enable temporarily.
- Provider API keys are optional; the system will probe and enable configured providers at startup when their keys are present.

If you want, I can also:

- Create a Render Dashboard checklist with exact steps to set env vars and create the scheduled job.
- Add a one-click `render.yaml` sample showing the scheduled job resource.
