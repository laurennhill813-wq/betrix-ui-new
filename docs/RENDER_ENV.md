# Render Environment Variables (BETRIX worker)

This file contains a minimal set of environment variables you can paste into the Render dashboard for the BETRIX worker service. Add the values in the Render service → Environment → Add Environment Variable, then redeploy the service.

IMPORTANT:

- Do NOT commit real secrets to the repository. Use the Render dashboard to set secrets.
- `SPORTSMONKS_INSECURE=true` is a temporary testing workaround only — it disables TLS verification for SportMonks requests per-request and is unsafe in production.

Required (for Telegram image posting):

- `TELEGRAM_BOT_TOKEN` = <your-telegram-bot-token>
- `BOT_BROADCAST_CHAT_ID` = <target-chat-or-channel-id> (example: `-1001234567890`)

SportMonks (provider) - quick ops:

- `SPORTSMONKS_BASE` = https://api.sportmonks.com/v3
  - If you previously used a misspelled domain (e.g. `api.sportsmonks.com`) the worker now normalises it automatically.
- `SPORTSMONKS_API_KEY` or `SPORTSMONKS_API` = <your-sportsmonks-api-key>
- `SPORTSMONKS_INSECURE` = `true` # optional short-term testing only; do NOT leave enabled in production
- `SPORTSMONKS_TLS_PAUSE_SECONDS` = `300` # how long to pause prefetch after TLS error (default 300)

AI providers (only if you use them):

- Azure OpenAI
  - `AZURE_ENDPOINT` = https://<your-azure-endpoint>.cognitiveservices.azure.com
  - `AZURE_API_KEY` = <your-azure-api-key>
  - `AZURE_DEPLOYMENT` = <deployment-name> (e.g. `gpt-5-chat`)
- HuggingFace (optional)
  - `HUGGINGFACE_API_KEY` = <hf-token>

Runtime infra (from Render/Redis/etc):

- `REDIS_URL` = rediss://... (Render managed Redis)
- `DATABASE_URL` = postgres://... (if Postgres is used)

Example copy/paste block for Render (PowerShell friendly):

```pwsh
# Replace values before pasting
$envVars = @{
  TELEGRAM_BOT_TOKEN = 'replace-with-bot-token'
  BOT_BROADCAST_CHAT_ID = '-1001234567890'
  SPORTSMONKS_BASE = 'https://api.sportmonks.com/v3'
  SPORTSMONKS_API_KEY = 'replace-with-key'
  # SPORTSMONKS_INSECURE = 'true' # only enable for short-term testing
}

# Manually add them into Render dashboard UI for the worker service
```

Post-change checklist:

- Add `TELEGRAM_BOT_TOKEN` + `BOT_BROADCAST_CHAT_ID` and redeploy. The worker log line "TELEGRAM_BOT_TOKEN not set" should disappear.
- If SportMonks TLS errors persist, contact SportMonks support and remove `SPORTSMONKS_INSECURE` after they fix certificates.

If you'd like, I can also (A) patch the repo to include a `docs/RENDER_ENV.example` env file (without secrets) or (B) run a quick PR that documents all required env variables. Tell me which.
