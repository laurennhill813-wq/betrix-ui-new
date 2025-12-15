Media providers
================

This folder contains provider adapters used by `src/media/mediaRouter.js`.

Adapter contract
---------------

- Each provider is an optional module under `src/media/providers/<provider>.js`.
- Exports (async): `getImageForEvent({ event, match })` and `getImageForMatch({ match })`.
- If the provider cannot return an image, the function should return `null`.
- If a provider is enabled but only scaffolded, it may return a placeholder URL and include `meta.scaffold=true`.

How to implement a real adapter
-------------------------------

1. Add your provider credentials to environment variables (see `env.providers.example`).
2. Use provider REST APIs to search by team names, player names, competition, or ids.
3. Return an object `{ imageUrl: 'https://...', meta: { provider: 'name', ... } }`.
4. Keep the adapter robust: don't throw on network errors; catch and return `null`.

Security
--------

- Keep API keys out of source control. Use Render/your platform's secret store.
- Adapters should never log raw API responses containing personal data.
