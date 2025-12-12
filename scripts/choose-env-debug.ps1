$envFilePrimary = Join-Path -Path (Get-Location) -ChildPath '.env.local'
$envFileFallback = Join-Path -Path (Get-Location) -ChildPath '.env.local.fixed'

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

Write-Host "Primary exists:" (Test-Path $envFilePrimary)
Write-Host "Fallback exists:" (Test-Path $envFileFallback)
Write-Host "Primary valid:" (Is-EnvFileValid $envFilePrimary)
Write-Host "Fallback valid:" (Is-EnvFileValid $envFileFallback)

if ((Test-Path $envFilePrimary) -and (Is-EnvFileValid $envFilePrimary)) {
    Write-Host "Chosen: primary (.env.local)"
} elseif ((Test-Path $envFileFallback) -and (Is-EnvFileValid $envFileFallback)) {
    Write-Host "Chosen: fallback (.env.local.fixed)"
} elseif (Test-Path $envFileFallback) {
    Write-Host "Chosen: fallback (exists but not fully valid)"
} else {
    Write-Host "No usable env file found"
}
