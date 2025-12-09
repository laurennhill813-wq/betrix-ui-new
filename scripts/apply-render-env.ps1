<#
Helper: write `env.render` contents into `.env.render` and print instructions to set these vars on Render.

Usage (PowerShell):
  pwsh .\scripts\apply-render-env.ps1

Notes:
- This script does NOT call Render APIs automatically (no RENDER_API provided). It writes `./.env.render`
  and prints copy/paste commands and the curl template for Render's API if you later supply a `RENDER_API` key and `SERVICE_ID`.
#>
Set-StrictMode -Version Latest
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$envFile = Join-Path $root '..\env.render'
$outFile = Join-Path $root '..\.env.render'
if (-Not (Test-Path $envFile)) {
  Write-Error "env.render not found at $envFile"
  exit 1
}
Write-Output "Writing $outFile (safe local copy)..."
Get-Content $envFile | Set-Content -Path $outFile -Encoding UTF8

Write-Output "\nDone. Next steps to apply these variables to Render:"
Write-Output "1) Using the Render dashboard:"
Write-Output "   - Open your service in Render (Environment > Environment Variables)."
Write-Output "   - Copy the contents of ./.env.render and add each key/value as an Environment Variable."

Write-Output "2) Using the Render API (requires RENDER_API token and SERVICE_ID):"
Write-Output "   - Example curl template (fill SERVICE_ID and RENDER_API):"
Write-Output "```powershell"
Write-Output "curl -X POST https://api.render.com/v1/services/SERVICE_ID/env-vars -H \"Authorization: Bearer <RENDER_API>\" -H \"Content-Type: application/json\" -d '{\n  \"envVars\": [\n    { \"key\": \"ADMIN_SECRET\", \"value\": \"YOUR_VALUE\" },\n    { \"key\": \"DATABASE_URL\", \"value\": \"YOUR_DB_URL\" }\n  ]\n}'"
Write-Output "```"

Write-Output "3) Alternatively, use Render CLI (if installed):"
Write-Output "   - Install: https://render.com/docs/cli"
Write-Output "   - Then run (example):"
Write-Output "```powershell"
Write-Output "render services env set <service-name> ADMIN_SECRET=... DATABASE_URL=..."
Write-Output "```"

Write-Output "4) Security: treat ./.env.render as sensitive. Do not commit it to public repos."

Write-Output "\nIf you want, provide RENDER_API and SERVICE_ID and I can generate the exact curl payload for you to run."

exit 0
