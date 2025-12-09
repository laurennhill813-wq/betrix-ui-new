param(
  [Parameter(Mandatory=$true)] [string] $ApiKey,
  [Parameter(Mandatory=$true)] [string] $ServiceId
)
function PrintJson($obj) { Write-Host ($obj | ConvertTo-Json -Depth 6) }
try {
  $svc = Invoke-RestMethod -Uri "https://api.render.com/v1/services/$ServiceId" -Headers @{ Authorization = "Bearer $ApiKey" } -ErrorAction Stop
  Write-Host '--- SERVICE DETAILS ---'
  PrintJson $svc
} catch { Write-Host "Failed to fetch service details: $($_.Exception.Message)" }

try {
  Write-Host '--- ENV VARS ---'
  $envs = Invoke-RestMethod -Uri "https://api.render.com/v1/services/$ServiceId/env-vars" -Headers @{ Authorization = "Bearer $ApiKey" } -ErrorAction Stop
  PrintJson $envs
} catch { Write-Host "Failed to fetch env vars: $($_.Exception.Message)" }

try {
  Write-Host '--- RECENT DEPLOYS ---'
  $deploys = Invoke-RestMethod -Uri "https://api.render.com/v1/services/$ServiceId/deploys?limit=5" -Headers @{ Authorization = "Bearer $ApiKey" } -ErrorAction Stop
  PrintJson $deploys
} catch { Write-Host "Failed to fetch deploys: $($_.Exception.Message)" }

try {
  Write-Host '--- SERVICE LOGS (stream last lines) ---'
  $logs = Invoke-RestMethod -Uri "https://api.render.com/v1/services/$ServiceId/logs?limit=200" -Headers @{ Authorization = "Bearer $ApiKey" } -ErrorAction Stop
  PrintJson $logs
} catch { Write-Host "Failed to fetch logs: $($_.Exception.Message)" }
