param(
  [Parameter(Mandatory=$true)] [string] $ApiKey,
  [Parameter(Mandatory=$true)] [string] $ServiceId
)

function Load-EnvFile($path) {
  if (-not (Test-Path $path)) { return @{} }
  $lines = Get-Content $path -ErrorAction Stop
  $env = @{}
  foreach ($l in $lines) {
    $line = $l.Trim()
    if (-not $line -or $line.StartsWith('#') -or -not $line.Contains('=')) { continue }
    $idx = $line.IndexOf('=')
    $k = $line.Substring(0,$idx).Trim()
    $v = $line.Substring($idx+1).Trim()
    if ($v.StartsWith('"') -and $v.EndsWith('"')) { $v = $v.Trim('"') }
    if ($v.StartsWith("'") -and $v.EndsWith("'")) { $v = $v.Trim("'") }
    $env[$k] = $v
  }
  return $env
}

$envFile = Join-Path (Get-Location) 'env.render'
$envs = Load-EnvFile $envFile
$toSet = @('PAYPAL_CLIENT_ID','PAYPAL_CLIENT_SECRET','BINANCE_API_KEY','BINANCE_API_SECRET')

function ApiPost($uri,$body) {
  try {
    return Invoke-RestMethod -Uri $uri -Method Post -Headers @{ Authorization = "Bearer $ApiKey"; 'Content-Type' = 'application/json' } -Body ($body | ConvertTo-Json -Depth 5) -ErrorAction Stop
  } catch {
    Write-Host "POST $uri failed: $($_.Exception.Message)"
    if ($_.Exception.Response) { try { $resp = $_.Exception.Response.Content.ReadAsStringAsync().Result; Write-Host $resp } catch {} }
    return $null
  }
}

foreach ($k in $toSet) {
  if ($envs.ContainsKey($k)) {
    Write-Host "Setting $k on service $ServiceId"
    $body = @{ key = $k; value = $envs[$k]; secure = $true }
    $uri = "https://api.render.com/v1/services/$ServiceId/env-vars"
    $res = ApiPost $uri $body
    if ($res) { Write-Host "-> OK: $($res | ConvertTo-Json -Depth 3)" } else { Write-Host "-> Failed to set $k" }
  } else {
    Write-Host "Env $k not found in env.render; skipping"
  }
}
