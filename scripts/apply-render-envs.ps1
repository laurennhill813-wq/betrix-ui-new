param(
  [Parameter(Mandatory=$false)] [string] $ApiKey,
  [Parameter(Mandatory=$false)] [string] $ServiceId
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
    # Trim surrounding quotes (single or double) safely
    $v = $line.Substring($idx+1).Trim()
    if ($v.StartsWith('"') -and $v.EndsWith('"')) { $v = $v.Trim('"') }
    if ($v.StartsWith("'") -and $v.EndsWith("'")) { $v = $v.Trim("'") }
    $env[$k] = $v
  }
  return $env
}

if (-not $ApiKey) {
  Write-Host "Provide your Render API key via -ApiKey parameter or set RENDER_API env var."
  if ($env:RENDER_API) { $ApiKey = $env:RENDER_API }
}
if (-not $ApiKey) { Write-Error "RENDER API key missing. Abort."; exit 1 }

$envFile = Join-Path (Get-Location) 'env.render'
$envs = Load-EnvFile $envFile

$toSet = @('PAYPAL_CLIENT_ID','PAYPAL_CLIENT_SECRET','BINANCE_API_KEY','BINANCE_API_SECRET')
$payload = @()
foreach ($k in $toSet) {
  if ($envs.ContainsKey($k)) {
    $payload += @{ key = $k; value = $envs[$k]; secure = $true }
  } else {
    Write-Warning "Env $k not found in env.render; skipping"
  }
}

if ($payload.Count -eq 0) { Write-Error "No payment env vars found to set. Ensure env.render contains required keys."; exit 1 }

function ApiGet($uri) {
  try {
    return Invoke-RestMethod -Uri $uri -Headers @{ Authorization = "Bearer $ApiKey" } -ErrorAction Stop
  } catch {
    Write-Error "GET $uri failed: $($_.Exception.Message)"
    if ($_.Exception.Response) { $body = $_.Exception.Response.GetResponseStream() | %{ new-object System.IO.StreamReader($_) } | %{ $_.ReadToEnd() }; Write-Host $body }
    exit 1
  }
}

function ApiPost($uri,$body) {
  try {
    return Invoke-RestMethod -Uri $uri -Method Post -Headers @{ Authorization = "Bearer $ApiKey"; 'Content-Type' = 'application/json' } -Body ($body | ConvertTo-Json -Depth 5) -ErrorAction Stop
  } catch {
    Write-Error "POST $uri failed: $($_.Exception.Message)"
    if ($_.Exception.Response) { $body = $_.Exception.Response.GetResponseStream() | %{ new-object System.IO.StreamReader($_) } | %{ $_.ReadToEnd() }; Write-Host $body }
    exit 1
  }
}

if (-not $ServiceId) {
  Write-Host "Listing Render services to help you choose the correct service..."
  $services = ApiGet 'https://api.render.com/v1/services'
  $i = 0
  $choices = @{}
  foreach ($s in $services) {
    $i++
    $line = "[$i] id=$($s.id) name=$($s.name) defaultDomain=$($s.defaultDomain)"
    Write-Host $line
    $choices[$i] = $s.id
  }
  if ($choices.Count -eq 0) { Write-Error "No services returned from Render API."; exit 1 }
  $sel = Read-Host "Enter the number of the service to update (or paste service id)"
  if ($sel -match '^[0-9]+$' -and $choices.ContainsKey([int]$sel)) { $ServiceId = $choices[[int]$sel] } else { $ServiceId = $sel }
}

Write-Host "Applying ${($payload.Count)} env vars to service id $ServiceId"

foreach ($entry in $payload) {
  Write-Host "Setting $($entry.key) ..."
  $body = @{ key = $entry.key; value = $entry.value; secure = $entry.secure }
  $uri = "https://api.render.com/v1/services/$ServiceId/env-vars"
  $res = ApiPost $uri $body
  Write-Host "-> Response:" ($res | ConvertTo-Json -Depth 3)
}

Write-Host "Done. Review service env vars in the Render dashboard and redeploy if required."
