Data Model (Overview)
======================

Core entities introduced in Postgres (see `migrations/001_create_core_tables.sql`):

- `users` — Stores minimal user profile: `telegram_id`, `name`, `created_at`, `updated_at`.
- `subscriptions` — Tracks subscription tiers per user.
- `payments` — Ledger of payment events and provider references.

The application previously used Redis for ephemeral user data and payment mapping. The migration plan is to:

1. Start writing authoritative records to Postgres for `users`, `subscriptions`, and `payments`.
2. Maintain transient caches and queues in Redis (e.g., `telegram:updates`, `prefetch:*`).
3. Provide migration scripts to move persisted payment mappings from Redis keys `payment:order:*` and `payment:by_provider_ref:*` into the `payments` table.
