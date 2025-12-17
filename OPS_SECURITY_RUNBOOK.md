Operations & Security Runbook (Short)
===================================

Immediate remediation steps applied:

- Removed hardcoded API secrets from repository (`.env.local` sanitized).
- Added `.env.example` to document required variables.
- Hardened webhook verification to require `WEBHOOK_SECRET` when configured; warn if missing.
- Introduced structured logging utilities and replaced console logging in webhook entry points.

Recommended next steps:

1. Rotate any secrets that were previously committed to the repository (API keys, DB credentials, Telegram token).
2. Add a CI pre-commit secret scanning step to reject commits containing API keys or `.env.local` content.
3. Configure secret storage in your platform (Render, Heroku, Azure KeyVault) and ensure `WEBHOOK_SECRET` and `DATABASE_URL` are provisioned.
4. Migrate payments ledger from Redis into Postgres and deprecate Redis keys used for long-term storage.
5. Audit logs to ensure no sensitive values are being logged in plain text.
