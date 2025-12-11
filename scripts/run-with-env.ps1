<#
Load `.env.local` into the current process and run the worker in the same PowerShell session.

Usage:
  pwsh -NoProfile -ExecutionPolicy Bypass -File scripts\run-with-env.ps1

If `.env.local` does not exist, the script will prompt to create one (invokes `set-env.ps1`).
#>

$envFile = Join-Path -Path (Get-Location) -ChildPath '.env.local'

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

try {
    if (-not (Test-Path $envFile)) {
        Write-Host "No .env.local found at $envFile" -ForegroundColor Yellow
        $ans = Read-Host "Would you like to run interactive env setup now? (y/N)"
        if ($ans -match '^[Yy]') {
            pwsh -NoProfile -ExecutionPolicy Bypass -File scripts\set-env.ps1
            if (-not (Test-Path $envFile)) { Write-Error ".env.local still missing after setup. Aborting."; exit 1 }
        } else {
            Write-Error ".env.local is required to proceed. Create it or run scripts\set-env.ps1 first."; exit 1
        }
    }

    if (-not (Load-EnvFile $envFile)) { Write-Error "Failed to read $envFile"; exit 1 }

    Write-Host "Environment loaded. Starting worker..." -ForegroundColor Green
    # Run worker in the same session so it inherits env vars
    & node src/worker-final.js
} catch {
    Write-Error "run-with-env failed: $_"
    exit 1
}
