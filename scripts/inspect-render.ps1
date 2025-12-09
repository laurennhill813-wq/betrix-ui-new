param(
  [Parameter(Mandatory=$true)] [string] $ApiKey
)

function PrintJson($obj) { Write-Host ($obj | ConvertTo-Json -Depth 6) }

try {
  $services = Invoke-RestMethod -Uri 'https://api.render.com/v1/services' -Headers @{ Authorization = "Bearer $ApiKey" } -ErrorAction Stop
} catch {
  Write-Host "Failed to list services: $($_.Exception.Message)"; exit 1
}

$match = $services | Where-Object { ($_.defaultDomain -and $_.defaultDomain -like '*betrix-ui-new*') -or ($_.name -and $_.name -like '*betrix*') }
if (-not $match) {
  Write-Host 'No service matched by domain/name. Showing all services summary:'
  $services | Select-Object id,name,defaultDomain | Format-Table -AutoSize
  exit 0
}

foreach ($s in $match) {
  Write-Host '--- SERVICE ---'
  PrintJson $s
  Write-Host '--- ENV VARS ---'
  try { $envs = Invoke-RestMethod -Uri "https://api.render.com/v1/services/$($s.id)/env-vars" -Headers @{ Authorization = "Bearer $ApiKey" } -ErrorAction Stop; PrintJson $envs } catch { Write-Host "Failed to fetch env vars: $($_.Exception.Message)" }
  Write-Host '--- RECENT DEPLOYS ---'
  try { $deploys = Invoke-RestMethod -Uri "https://api.render.com/v1/services/$($s.id)/deploys?limit=5" -Headers @{ Authorization = "Bearer $ApiKey" } -ErrorAction Stop; PrintJson $deploys } catch { Write-Host "Failed to fetch deploys: $($_.Exception.Message)" }
}
