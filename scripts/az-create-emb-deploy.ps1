$sub = 'ff1b5919-caa3-4f96-af01-df24d4c38391'
$rg = 'rg-sefusignal65-1759_ai'
$account = 'ai-sefusignal659506ai592573928608'
$deployment = 'text-embedding-3-large'
$api = '2024-12-01'
$json = '{"properties":{"model":"text-embedding-3-large","scaleSettings":{"scaleType":"Standard"}}}'
Set-Content -Path .\\tmp-deploy.json -Value $json -Encoding utf8
$uri = "https://management.azure.com/subscriptions/$sub/resourceGroups/$rg/providers/Microsoft.CognitiveServices/accounts/$account/deployments/$deployment?api-version=$api"
Write-Host "Creating deployment via $uri"
# Pass the JSON body directly to avoid PowerShell interpreting @file syntax
az rest --method put --uri $uri --body \"$json\" -o json
