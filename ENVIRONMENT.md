Environment & Secrets
=====================

This project loads runtime configuration from environment variables. Do NOT commit secret values to the repository. Use `.env.local` only for local development and keep it out of version control.

Required environment variables (example names shown in `.env.example`):

- `TELEGRAM_TOKEN` - Bot token from Telegram
- `REDIS_URL` - Redis connection URL
- `DATABASE_URL` - Postgres connection URL (for drizzle)

Optional provider keys:
- `SERPAPI_KEY`, `AZURE_OPENAI_KEY`, `COHERE_API_KEY`, `SPORTSGAMEODDS_API_KEY`

Webhook secrets:
- `WEBHOOK_SECRET` or `TELEGRAM_WEBHOOK_SECRET` - secret token used to verify incoming Telegram webhook requests. When configured, incoming requests without this secret are rejected.

Local setup
-----------
1. Copy `.env.example` to `.env.local`.
2. Fill in values.
3. Start the app with `npm start` or using provided PowerShell scripts. Keep `.env.local` out of Git.
