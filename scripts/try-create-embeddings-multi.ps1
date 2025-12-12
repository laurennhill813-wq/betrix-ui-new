# Try multiple API versions and payload shapes to create an embeddings deployment
$ErrorActionPreference = 'Continue'

$sub = 'ff1b5919-caa3-4f96-af01-df24d4c38391'
$rg = 'rg-sefusignal65-1759_ai'
$account = 'ai-sefusignal659506ai592573928608'
$deployment = 'text-embedding-3-large'

$apiVersions = @(
  '2025-10-01-preview',
  '2025-09-01',
  '2025-07-01-preview',
  '2025-04-01-preview',
  '2024-10-01',
  '2024-06-01-preview'
)

$payloads = @()
# payload variant 1 (simple)
$payloads += '{"properties":{"model":"text-embedding-3-large","scaleSettings":{"scaleType":"Standard"}}}'
# variant 2 (include modelVersion)
$payloads += '{"properties":{"model":"text-embedding-3-large","modelVersion":"2025-10-03","scaleSettings":{"scaleType":"Standard"}}}'
# variant 3 (include deploymentType)
$payloads += '{"properties":{"model":"text-embedding-3-large","deploymentType":"Managed","scaleSettings":{"scaleType":"Standard"}}}'
# variant 4 (alternative shape)
$payloads += '{"properties":{"model":"text-embedding-3-large","scaleSettings":{"scaleType":"Standard"},"kind":"Embeddings"}}'

$token = az account get-access-token --resource https://management.azure.com/ --query accessToken -o tsv
if (-not $token) { Write-Error 'Failed to get az access token; ensure az is logged in'; exit 2 }

foreach ($api in $apiVersions) {
  foreach ($payload in $payloads) {
    $uri = "https://management.azure.com/subscriptions/$sub/resourceGroups/$rg/providers/Microsoft.CognitiveServices/accounts/$account/deployments/$deployment?api-version=$api"
    Write-Host "Attempt API=$api payloadLength=$($payload.Length)"
    try {
      $resp = Invoke-RestMethod -Uri $uri -Method Put -Headers @{ Authorization = "Bearer $token" } -Body $payload -ContentType 'application/json' -ErrorAction Stop
      Write-Host "SUCCESS api=$api payloadLen=$($payload.Length) -> status OK"
      $resp | ConvertTo-Json -Depth 5 | Out-File -FilePath .\tmp-create-success.json -Encoding utf8
      Write-Host "Saved response to .\tmp-create-success.json"
      exit 0
    } catch {
      $err = $_
      $msg = $_.Exception.Message
      Write-Host "FAILED api=$api payloadLen=$($payload.Length) -> $msg"
      if ($_.Exception.Response) {
        try {
          $sr = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
          $body = $sr.ReadToEnd(); $sr.Close()
          Write-Host "Response body:"; Write-Host $body
        } catch {
          Write-Host "(no body available)"
        }
      }
    }
    Start-Sleep -Seconds 1
  }
}
Write-Host 'All attempts completed'; exit 3
