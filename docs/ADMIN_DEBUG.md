**Admin Debug Endpoints**

- **Base path**: `/api/admin/*` (protected by `ADMIN_API_KEY` when configured)

- Authentication options (choose one):
  - Header: `x-admin-key: <ADMIN_API_KEY>`
  - Header: `Authorization: Bearer <ADMIN_API_KEY>`
  - Query: `?api_key=<ADMIN_API_KEY>`

- Endpoints
  - `GET /api/admin/providers`
    - Returns bootstrap/provider status information from Redis:
      - `bootstrap`: last API bootstrap status (SportMonks/Football-Data/Sportradar)
      - `sportsmonksStrategy`: last auth strategy used for SportMonks
      - `prefetchNext`: timestamp until which SportMonks prefetch is paused
      - `sportradarHealth`: last Sportradar probe summary
    - Example (PowerShell):
      ```pwsh
      $env:ADMIN_API_KEY='YOUR_KEY'
      Invoke-RestMethod -Uri 'https://<your-service>.onrender.com/api/admin/providers' -Headers @{ 'x-admin-key' = $env:ADMIN_API_KEY }
      ```

  - `POST /api/admin/inspect-sportmonks`
    - Runs `scripts/inspect-sportmonks-cert.js` on the server and returns stdout/stderr.
    - Useful to share cert output with SportMonks support.
    - Example (PowerShell):
      ```pwsh
      Invoke-RestMethod -Uri 'https://<your-service>.onrender.com/api/admin/inspect-sportmonks' -Method Post -Headers @{ 'x-admin-key' = $env:ADMIN_API_KEY }
      ```

  - `POST /api/admin/test-send`
    - Protected endpoint to trigger a single Telegram send for testing.
    - Body (JSON):
      - For photo:
        ```json
        { "type": "photo", "photoUrl": "https://.../image.jpg", "caption": "Test caption", "chat_id": "-100000..." }
        ```
      - For text:
        ```json
        { "type": "text", "text": "Hello from admin test", "chat_id": "-100000..." }
        ```
    - If `chat_id` is omitted, the server will try `BOT_BROADCAST_CHAT_ID` env var.
    - Example (PowerShell):
      ```pwsh
      $body = @{ type = 'photo'; photoUrl = 'https://example.com/p.jpg'; caption='hi' } | ConvertTo-Json
      Invoke-RestMethod -Uri 'https://<your-service>.onrender.com/api/admin/test-send' -Method Post -Headers @{ 'x-admin-key' = $env:ADMIN_API_KEY } -Body $body -ContentType 'application/json'
      ```

- Alerts
  - The service supports a simple webhook alert integration via `ALERT_WEBHOOK_URL`.
  - When SportMonks TLS certificate errors are detected, the service will fire a best-effort POST with JSON containing `service`, `event`, `endpoint`, `cert` and `timestamp` fields.
  - Example webhook receiver (expects JSON):
    ```json
    { "service":"sportmonks","event":"tls_certificate_invalid","endpoint":"https://api.sportmonks.com/v3","cert":{...},"timestamp":"..." }
    ```

- Safety notes
  - Admin endpoints are protected by `ADMIN_API_KEY` when configured. If `ADMIN_API_KEY` is not set, admin endpoints are open to local/dev access — do NOT enable that in public environments without an admin key.
  - `SPORTSMONKS_INSECURE=true` is a temporary testing workaround only — it disables TLS verification for SportMonks calls and is unsafe in production.

*** End of file
