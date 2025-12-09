$env:USE_MOCK_REDIS = '0'
$env:REDIS_URL = 'rediss://red-d4op3l49c44c73flgmbg:cMlkyQUtLGZOtW5RNz2XaG5zhCbHge2h@frankfurt-keyvalue.render.com:6379'

Write-Host "Using REDIS_URL=$env:REDIS_URL (USE_MOCK_REDIS=$env:USE_MOCK_REDIS)"

node .\scripts\force-activate.mjs TXN1765202976351OY19X5
Write-Host "---"
node .\scripts\force-activate.mjs TXN1765195908263Z07JK8
Write-Host "--- outgoing events ---"
Invoke-RestMethod -Headers @{ 'x-health-secret'='94ah7349882h5420g33423o98kg32662l' } -Uri 'https://betrix-ui-new.onrender.com/admin/outgoing-events?n=200' -Method GET | ConvertTo-Json -Depth 5 | Out-File -Encoding utf8 .\tmp_outgoing_events.json
Get-Content .\tmp_outgoing_events.json
Write-Host "--- webhook fallback ---"
Invoke-RestMethod -Uri 'https://betrix-ui-new.onrender.com/admin/webhook-fallback?n=20' -Method GET | ConvertTo-Json -Depth 5 | Out-File -Encoding utf8 .\tmp_webhook_fallback.json
Get-Content .\tmp_webhook_fallback.json
