param(
  [Parameter(Mandatory=$true)] [string] $ApiKey
)
try {
  $services = Invoke-RestMethod -Uri 'https://api.render.com/v1/services' -Headers @{ Authorization = "Bearer $ApiKey" } -ErrorAction Stop
} catch { Write-Host "Failed to list services: $($_.Exception.Message)"; exit 1 }

Write-Host "Found $($services.Count) services.\n"
foreach ($s in $services) {
  $name = $s.name -replace "\n",""
  $domain = $s.defaultDomain
  $type = $s.type
  Write-Host "ID: $($s.id)\n  Name: $name\n  DefaultDomain: $domain\n  Type: $type\n"
}
