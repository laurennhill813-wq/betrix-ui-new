# Load `.env.local.fixed` into the current process and run the worker
$envFile = Join-Path -Path (Get-Location) -ChildPath '.env.local.fixed'

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
        Write-Error "Missing $envFile"
        exit 1
    }

    if (-not (Load-EnvFile $envFile)) { Write-Error "Failed to read $envFile"; exit 1 }

    Write-Host "Environment loaded from .env.local.fixed. Starting worker..." -ForegroundColor Green
    & node src/worker-final.js
} catch {
    Write-Error "run-with-fixed-env failed: $_"
    exit 1
}
