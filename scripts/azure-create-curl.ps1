$sub='ff1b5919-caa3-4f96-af01-df24d4c38391'
$rg='rg-sefusignal65-1759_ai'
$account='ai-sefusignal659506ai592573928608'
$deployment='text-embedding-3-large'
$api='2024-12-01'
$uri='https://management.azure.com/subscriptions/' + $sub + '/resourceGroups/' + $rg + '/providers/Microsoft.CognitiveServices/accounts/' + $account + '/deployments/' + $deployment + '?api-version=' + $api
Write-Host "URI: $uri"
$token = az account get-access-token --resource https://management.azure.com/ --query accessToken -o tsv
if(-not $token){ Write-Error 'Failed to get access token'; exit 2 }
$json = '{"properties":{"model":"text-embedding-3-large","scaleSettings":{"scaleType":"Standard"}}}'
Write-Host 'Calling curl to PUT deployment...'
$cmd = "curl -s -S -X PUT -H \"Authorization: Bearer $token\" -H \"Content-Type: application/json\" -d '$json' \"$uri\" -w \"\nHTTP_STATUS:%{http_code}\n\" -o response.txt"
Write-Host "Running: $cmd"
Invoke-Expression $cmd
Write-Host "Response body:"
Get-Content response.txt -Raw | Write-Host
Remove-Item response.txt -Force
