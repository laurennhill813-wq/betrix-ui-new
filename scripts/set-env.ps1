<#
Secure environment bootstrap for local testing.

This script interactively prompts for required environment values (secrets are prompted hidden), writes a local `.env.local` file in the repository root, restricts file permissions to the current user, and sets the values for the current PowerShell session (Process scope).

USAGE (PowerShell):
  pwsh -NoProfile -ExecutionPolicy Bypass -File scripts\set-env.ps1

Notes:
- Do NOT paste secrets here into chat. Run this script locally and paste the values when prompted.
- The created file is `.env.local` and should be excluded from VCS. The script will try to set restrictive ACLs on Windows using `icacls`.
#>

function Convert-SecureStringToPlain {
    param([System.Security.SecureString]$s)
    if (-not $s) { return $null }
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
    try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

$vars = @(
    @{ key='AZURE_OPENAI_API_VERSION'; prompt='Azure OpenAI API Version (example: 2024-08-01-preview)'; secret=$false },
    @{ key='AZURE_OPENAI_DEPLOYMENT'; prompt='Azure OpenAI Deployment name (example: gpt-5-chat)'; secret=$false },
    @{ key='AZURE_OPENAI_ENDPOINT'; prompt='Azure OpenAI Endpoint (https://...cognitiveservices.azure.com/)'; secret=$false },
    @{ key='AZURE_OPENAI_KEY'; prompt='Azure OpenAI Key'; secret=$true },
    @{ key='COHERE_API_KEY'; prompt='Cohere API Key (optional)'; secret=$true },
    @{ key='DATABASE_URL'; prompt='DATABASE_URL (Postgres)'; secret=$true },
    @{ key='ADMIN_API_KEY'; prompt='ADMIN_API_KEY (optional)'; secret=$true },
    @{ key='ADMIN_SECRET'; prompt='ADMIN_SECRET (optional)'; secret=$true },
    @{ key='REDIS_URL'; prompt='REDIS_URL (redis:// or rediss://)'; secret=$true },
    @{ key='SPORTSGAMEODDS_API_KEY'; prompt='SPORTSGAMEODDS_API_KEY'; secret=$true },
    @{ key='TELEGRAM_TOKEN'; prompt='TELEGRAM_TOKEN (bot token)'; secret=$true },
    @{ key='TELEGRAM_WEBHOOK_SECRET'; prompt='TELEGRAM_WEBHOOK_SECRET (optional)'; secret=$true },
    @{ key='TELEGRAM_WEBHOOK_URL'; prompt='TELEGRAM_WEBHOOK_URL (optional)'; secret=$false }
)

$envPairs = @()
Write-Host "Starting interactive env setup. You'll be prompted for each value. Secrets are hidden while typing." -ForegroundColor Cyan

foreach ($v in $vars) {
    $key = $v.key
    $prompt = $v.prompt
    if ($v.secret) {
        $ss = Read-Host -AsSecureString -Prompt "$prompt (input hidden)"
        $val = Convert-SecureStringToPlain $ss
    } else {
        $val = Read-Host -Prompt $prompt
    }
    if ($null -eq $val -or $val -eq '') {
        Write-Host "Skipping empty value for $key" -ForegroundColor Yellow
    } else {
        $envPairs += @{ key=$key; value=$val }
        # set in current process
        [System.Environment]::SetEnvironmentVariable($key, $val, 'Process')
    }
}

# Write to .env.local (do not commit)
$envFile = Join-Path -Path (Get-Location) -ChildPath '.env.local'
$lines = @()
foreach ($p in $envPairs) { $lines += "${($p.key)}=${($p.value)}" }

try {
    $content = $lines -join "`n"
    Set-Content -LiteralPath $envFile -Value $content -Encoding UTF8 -Force
    Write-Host "Wrote $envFile" -ForegroundColor Green

    # Restrict permissions (Windows): remove inheritance and grant full control to current user only
    try {
        $username = $env:USERNAME
        icacls $envFile /inheritance:r | Out-Null
        icacls $envFile /grant:r "$username:F" | Out-Null
        icacls $envFile /remove:g "Users" | Out-Null
        Write-Host "Restricted file ACLs to current user: $username" -ForegroundColor Green
    } catch {
        Write-Host ("Warning: Failed to set ACLs on {0}: {1}" -f $envFile, $_) -ForegroundColor Yellow
    }
} catch {
    Write-Host ("Failed to write {0}: {1}" -f $envFile, $_) -ForegroundColor Red
}

Write-Host "\nNext steps:" -ForegroundColor Cyan
Write-Host "- To run the worker in this shell (uses Process env vars set above):" -ForegroundColor Green
Write-Host "    node src/worker-final.js" -ForegroundColor Gray
Write-Host "- Or run the core-runner (dev runner):" -ForegroundColor Green
Write-Host "    node scripts/core-runner.js" -ForegroundColor Gray
Write-Host "- To run tests that require envs, run (after setting):" -ForegroundColor Green
Write-Host "    npm test" -ForegroundColor Gray

Write-Host "\nIf you prefer not to store secrets on disk, do not enter values for the secret prompts and set them in your session manually (example):" -ForegroundColor Cyan
Write-Host "    $env:REDIS_URL='rediss://...'; $env:TELEGRAM_TOKEN='...'; node src/worker-final.js" -ForegroundColor Gray

Write-Host "\nDone. Keep `.env.local` private and do not paste secrets into chat." -ForegroundColor Cyan
