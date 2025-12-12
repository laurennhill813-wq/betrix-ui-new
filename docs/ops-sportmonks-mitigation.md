SportMonks TLS Mitigation — Short-term operational steps

If you see repeated "certificate has expired" errors for `api.sportsmonks.com` in logs, follow these steps while contacting SportMonks support:

1) Short-term testing bypass (NOT for production):
   - Set environment variable `SPORTSMONKS_INSECURE=true` on your worker. This makes the SportMonks client accept the endpoint certificate per-request only (it does NOT disable TLS globally).
   - Restart your service.

2) Pause automated prefetch attempts for SportMonks to reduce noise and repeated failures:
   - You can set `SPORTSMONKS_TLS_PAUSE_SECONDS=300` to pause prefetch for 5 minutes after a detected TLS error (the code sets a Redis key `prefetch:next:sportsmonks` automatically when it detects an expired cert).

3) Force AI to use Azure (avoid Gemini quota errors):
   - Set `FORCE_AZURE=1` in the environment to prefer Azure in the AI wrapper. The wrapper now logs which provider was used.

4) Longer-term:
   - Contact SportMonks support with the certificate details from logs (CN, valid_to, fingerprint). Example logs: `CERT_HAS_EXPIRED` and `peer certificate` data from `scripts/inspect-sportmonks-cert.js`.
   - If SportMonks cannot fix quickly, consider temporarily disabling SportMonks by setting `PROVIDER_SPORTSMONKS_ENABLED=false` or adjusting `allowedProviders` when initializing `SportsAggregator`.

Commands (PowerShell) to run locally:

```powershell
# Inspect the remote certificate (dev-only; rejects unauthorized disabled inside script)
node .\scripts\inspect-sportmonks-cert.js

# Run our test analyse harness forcing Azure
$env:FORCE_AZURE = '1'
node .\scripts\test-analyse-mock.mjs

# If you must bypass TLS just for SportMonks calls in a dev/test environment
# (do NOT set NODE_TLS_REJECT_UNAUTHORIZED=0 in production)
$env:SPORTSMONKS_INSECURE = 'true'
node src/worker-final.js
```

Notes:
- The repository now adds an automated short pause in the prefetch scheduler when a certificate-expired error is detected. This reduces repeated error spam in logs.
- Avoid disabling global TLS verification (`NODE_TLS_REJECT_UNAUTHORIZED=0`) in production.
