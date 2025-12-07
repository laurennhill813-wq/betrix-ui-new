# Starts background jobs to tail Render service logs into ./logs and calls the /health/azure-ai probe
# Requires: $env:RENDER_API_KEY set in the current PowerShell session

if (-not (Test-Path .\logs)) { New-Item -ItemType Directory -Path .\logs | Out-Null }

if (-not $env:RENDER_API_KEY) {
  Write-Error 'RENDER_API_KEY not set in environment. Set $env:RENDER_API_KEY before running.'
  exit 2
}

$ids = @(
  'srv-d4qna3ur433s738bjmi0',
  'srv-d4pih78gjchc7383520g',
  'srv-d4oq6ls9c44c73fma36g',
  'red-d4op3l49c44c73flgmbg',
  'dpg-d4op2oqdbo4c73f9c3j0-a'
)

foreach ($id in $ids) {
  $out = Join-Path (Get-Location) "logs\$id.log"
  Write-Host "Starting log tail job for $id -> $out"
  Start-Job -ScriptBlock {
    param($id,$apikey,$out)
    while ($true) {
      try {
        $hdr = "Authorization: Bearer $apikey"
        curl -H $hdr "https://api.render.com/v1/services/$id/logs?tail=true" | Out-File -FilePath $out -Encoding utf8 -Append
      } catch {
        Start-Sleep -Seconds 2
      }
    }
  } -ArgumentList $id,$env:RENDER_API_KEY,$out | Out-Null
}

Start-Sleep -Seconds 1

# Attempt to read the web service public URL
try {
  $webResp = curl -H ("Authorization: Bearer $env:RENDER_API_KEY") "https://api.render.com/v1/services/srv-d4pih78gjchc7383520g" | ConvertFrom-Json
  $url = $null
  if ($webResp -and $webResp.serviceDetails -and $webResp.serviceDetails.publicUrl) { $url = $webResp.serviceDetails.publicUrl }
  if (-not $url -and $webResp -and $webResp.url) { $url = $webResp.url }
  Write-Host "Detected web url: $url"
} catch {
  Write-Warning "Could not fetch service info: $_"
}

if ($url) {
  try {
    Write-Host "Calling probe endpoint: $($url.TrimEnd('/'))/health/azure-ai"
    $probe = curl ($url.TrimEnd('/') + '/health/azure-ai') -Method Get -UseBasicParsing
    Write-Host 'Probe response:'
    $probe | ConvertTo-Json -Depth 5 | Write-Host
  } catch {
    Write-Warning "Probe request failed: $_"
  }
} else {
  Write-Warning 'Could not detect web URL; call probe manually.'
}

Write-Host 'Started background tail jobs. Logs are written to ./logs/*.log'