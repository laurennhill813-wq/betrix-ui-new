<#
Load `.env.local` into the current process and run the worker in the same PowerShell session.

Usage:
  pwsh -NoProfile -ExecutionPolicy Bypass -File scripts\run-with-env.ps1

If `.env.local` does not exist, the script will prompt to create one (invokes `set-env.ps1`).
#>

$envFilePrimary = Join-Path -Path (Get-Location) -ChildPath '.env.local'
$envFileFallback = Join-Path -Path (Get-Location) -ChildPath '.env.local.fixed'

function Load-EnvFile($path) {
    if (-not (Test-Path $path)) { return $false }
    $lines = Get-Content -LiteralPath $path -ErrorAction Stop
    foreach ($line in $lines) {
        $trim = $line.Trim()
        if ($trim -eq '' -or $trim.StartsWith('#')) { continue }
        $idx = $trim.IndexOf('=')
        if ($idx -lt 0) { continue }
        $k = $trim.Substring(0,$idx).Trim()
        $v = $trim.Substring($idx+1).Trim()
        # Remove surrounding quotes if present
        if (($v.StartsWith('"') -and $v.EndsWith('"')) -or ($v.StartsWith("'") -and $v.EndsWith("'"))) {
            $v = $v.Substring(1,$v.Length-2)
        }
        Write-Host "Setting env: $k" -ForegroundColor Cyan
        [System.Environment]::SetEnvironmentVariable($k, $v, 'Process')
    }
    return $true
}

function Is-EnvFileValid($path) {
    if (-not (Test-Path $path)) { return $false }
    $lines = Get-Content -LiteralPath $path -ErrorAction SilentlyContinue
    if (-not $lines) { return $false }
    $validCount = 0
    foreach ($line in $lines) {
        $t = $line.Trim()
        if ($t -eq '' -or $t.StartsWith('#')) { continue }
        $i = $t.IndexOf('=')
        if ($i -le 0) { continue }
        $key = $t.Substring(0,$i).Trim()
        if ($key.Length -gt 0) { $validCount += 1 }
        if ($validCount -ge 3) { break }
    }
    return ($validCount -ge 3)
}

try {

    # Prefer .env.local but fall back to .env.local.fixed silently if primary missing or unreadable.
    $chosenEnv = $null
    if ((Test-Path $envFilePrimary) -and (Is-EnvFileValid $envFilePrimary)) {
        $chosenEnv = $envFilePrimary
    } elseif ((Test-Path $envFileFallback) -and (Is-EnvFileValid $envFileFallback)) {
        Write-Host "Using fallback .env.local.fixed" -ForegroundColor Yellow
        $chosenEnv = $envFileFallback
    } elseif (Test-Path $envFileFallback) {
        # fallback exists but may be malformed — still attempt it
        Write-Host "Fallback .env.local.fixed present; attempting to use it" -ForegroundColor Yellow
        $chosenEnv = $envFileFallback
    } else {
        Write-Error "Neither .env.local nor .env.local.fixed found or valid. Aborting."; exit 1
    }

    if (-not (Load-EnvFile $chosenEnv)) { Write-Error "Failed to read $chosenEnv"; exit 1 }

    Write-Host "Environment loaded. Starting worker..." -ForegroundColor Green
    # Run worker in the same session so it inherits env vars
    & node src/worker-final.js
} catch {
    Write-Error "run-with-env failed: $_"
    exit 1
}
