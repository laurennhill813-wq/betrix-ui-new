Sportradar integration & signed-download guide
============================================

Goal
----
Help the app fetch protected Sportradar image assets and post them to Telegram by either:

- Using a direct API key (if your Sportradar account allows direct asset downloads from server-to-server requests), or
- Using a signing/exchange endpoint (recommended): a small internal service that calls Sportradar using an account that is permitted to download assets and returns a time-limited signed URL the app can fetch.

Environment variables
---------------------

- `SPORTRADAR_API_KEY` or `SPORTRADAR_KEY` — your Sportradar API key (if available). The adapter will append this to manifest URLs so manifests can be read.
- `SPORTRADAR_SIGN_ENDPOINT` — *optional but recommended* — URL of an internal signing service that accepts `{ url }` and returns `{ signedUrl }`.

How it works in this repo
-------------------------

- `src/data/images-sportradar.js` parses Sportradar manifest XML and returns candidate asset URLs.
- `src/services/image-proxy.js` tries several fetch header strategies. If all fail and the URL looks like a Sportradar asset, it will call the configured `SPORTRADAR_SIGN_ENDPOINT` via `src/data/images-sportradar-exchange.js` to obtain a signed download URL and try that instead.
- Diagnostic files for failed fetches are written to the image cache directory (default: OS temp dir under `betrix-image-cache`) with `.diag.json` suffix.

Setting up a signing endpoint
-----------------------------

You have two options:

1. Ask Sportradar to enable server-to-server downloads for your API key (allowlist your server IPs), or
2. Implement a small internal service (can be hosted on the same private network) that:
   - Accepts POST `/sign` JSON body `{ url }`
   - Uses credentials that are allowed to download the asset from Sportradar (Sportradar's platform or an umbrella account)
   - Downloads the asset and re-uploads it to a short-lived public location (S3 presigned URL, or returns a signed Sportradar URL if their API supports it)
   - Returns `{ signedUrl: 'https://...' }` to the app

The app includes a helper CLI to test this flow locally (see next section).

Testing locally
---------------

1. Make sure `SPORTRADAR_SIGN_ENDPOINT` is set to your signing endpoint.
2. Run the interactive helper to POST an asset and attempt a fetch:

```powershell
$env:SPORTRADAR_SIGN_ENDPOINT = 'https://your-internal-signer.example/sign'
node scripts/sportradar-exchange-cli.mjs
```

Follow prompts to paste the asset URL. The helper will show the signing response and whether the signed URL is fetchable from your environment.

Retrying the media pipeline
---------------------------

Once you have a working signer or allowed API key:

```powershell
$env:SPORTRADAR_API_KEY = 'your_key_here'
$env:SPORTRADAR_SIGN_ENDPOINT = 'https://your-internal-signer.example/sign'   # optional
node scripts/test-selectAndPost.mjs
node scripts/forceMediaTick.mjs
```

If assets still fail with `403`, collect diagnostics in the image cache directory (look for `*.diag.json`) and share them with Sportradar support or paste here for me to help prepare a support package.

Security & licensing
---------------------

- Licensed images from Sportradar (or Reuters/Getty/AP) must be used according to your subscription terms. Ensure you have the right to rehost or post assets externally (Telegram channel). If in doubt, consult your account rep.
- Keep signing endpoints internal and authenticated; do not expose them publicly.

Need help?
----------
If you want I can:

- Help craft the minimal signing service code (Node.js + S3 presigner) to run on a trusted host, or
- Prepare the diagnostic bundle for Sportradar support (I already generated `.diag.json` files in the image cache).

Tell me which option you prefer and provide the signing endpoint or Sportradar credentials (if you want me to run tests locally you must paste them here or run the scripts locally following the instructions above). Do NOT paste secrets into public chat logs if you don't want them exposed.
