$sub = 'ff1b5919-caa3-4f96-af01-df24d4c38391'
$rg = 'rg-sefusignal65-1759_ai'
$account = 'ai-sefusignal659506ai592573928608'
$deployment = 'text-embedding-3-large'
$api = '2025-10-01-preview'

$uri = 'https://management.azure.com/subscriptions/' + $sub + '/resourceGroups/' + $rg + '/providers/Microsoft.CognitiveServices/accounts/' + $account + '/deployments/' + $deployment + '?api-version=' + $api
Write-Host "URI: $uri"

Write-Host 'Obtaining access token...'
$token = az account get-access-token --resource https://management.azure.com/ --query accessToken -o tsv
if (-not $token) { Write-Error 'Failed to get access token'; exit 2 }

$json = '{"properties":{"model":"text-embedding-3-large","scaleSettings":{"scaleType":"Standard"}}}'

Write-Host 'Sending PUT via HttpClient...'
$handler = New-Object System.Net.Http.HttpClientHandler
$client = New-Object System.Net.Http.HttpClient($handler)
$client.DefaultRequestHeaders.Authorization = New-Object System.Net.Http.Headers.AuthenticationHeaderValue('Bearer', $token)
$content = New-Object System.Net.Http.StringContent($json, [System.Text.Encoding]::UTF8, 'application/json')
$task = $client.PutAsync($uri, $content)
$task.Wait()
$resp = $task.Result
$bodyTask = $resp.Content.ReadAsStringAsync(); $bodyTask.Wait(); $body = $bodyTask.Result
Write-Host "Status: $($resp.StatusCode)"
Write-Host "Body:"
Write-Host $body

if(-not $resp.IsSuccessStatusCode){ exit 3 }
