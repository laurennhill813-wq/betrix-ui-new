# Create Azure OpenAI embeddings deployment via Management REST API (attempt 2)
$ErrorActionPreference = 'Stop'
$sub = 'ff1b5919-caa3-4f96-af01-df24d4c38391'
$rg = 'rg-sefusignal65-1759_ai'
$account = 'ai-sefusignal659506ai592573928608'
$deployment = 'text-embedding-3-large'
$api = '2024-12-01'

$uri = 'https://management.azure.com/subscriptions/' + $sub + '/resourceGroups/' + $rg + '/providers/Microsoft.CognitiveServices/accounts/' + $account + '/deployments/' + $deployment + '?api-version=' + $api
Write-Host "URI: $uri"

Write-Host 'Obtaining access token from az...'
$token = az account get-access-token --resource https://management.azure.com/ --query accessToken -o tsv
if (-not $token) {
  Write-Error "Failed to get access token from az"
  exit 2
}

$jsonObj = @{ properties = @{ model = 'text-embedding-3-large'; scaleSettings = @{ scaleType = 'Standard' } } }
$json = $jsonObj | ConvertTo-Json -Depth 6

Write-Host "Calling REST API to create deployment..."
try {
  $resp = Invoke-RestMethod -Uri $uri -Method Put -Headers @{ Authorization = "Bearer $token" } -Body $json -ContentType 'application/json' -Verbose
  Write-Host "Create response:"
  $resp | ConvertTo-Json -Depth 5 | Write-Host
} catch {
  Write-Host "Create failed: $($_.Exception.Message)"
  if ($_.Exception.Response) {
    try {
      $sr = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
      $body = $sr.ReadToEnd(); $sr.Close()
      Write-Host "Response body:"
      Write-Host $body
    } catch { }
  }
  exit 3
}
