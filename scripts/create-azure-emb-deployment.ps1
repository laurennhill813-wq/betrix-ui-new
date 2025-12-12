$sub='ff1b5919-caa3-4f96-af01-df24d4c38391'
$rg='rg-sefusignal65-1759_ai'
$account='ai-sefusignal659506ai592573928608'
$deployment='text-embedding-3-large'
$api='2024-12-01'

$uri = "https://management.azure.com/subscriptions/$sub/resourceGroups/$rg/providers/Microsoft.CognitiveServices/accounts/$account/deployments/$deployment?api-version=$api"
Write-Host "URI: $uri"

$token = az account get-access-token --resource https://management.azure.com/ --query accessToken -o tsv
if (-not $token) { Write-Error "Failed to get access token from az"; exit 2 }

$jsonObj = @{ properties = @{ model = 'text-embedding-3-large'; scaleSettings = @{ scaleType = 'Standard' } } }
$json = $jsonObj | ConvertTo-Json -Depth 6


















}  exit 3  }    } catch {}      Write-Host $body      Write-Host "Response body:"      $body = $sr.ReadToEnd(); $sr.Close()      $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())    try {  if ($_.Exception.Response) {  Write-Host "Create failed: $($_.Exception.Message)"} catch {  $resp | ConvertTo-Json -Depth 5 | Write-Host  Write-Host "Create response:"  $resp = Invoke-RestMethod -Uri $uri -Method Put -Headers @{ Authorization = "Bearer $token" } -Body $json -ContentType 'application/json' -Verbosetry {nWrite-Host "Calling REST API to create deployment..."