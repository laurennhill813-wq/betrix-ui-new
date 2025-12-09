Write-Host "Fetching /admin/outgoing-events"
Invoke-RestMethod -Headers @{ 'x-health-secret'='94ah7349882h5420g33423o98kg32662l' } -Uri 'https://betrix-ui-new.onrender.com/admin/outgoing-events?n=200' -Method GET | ConvertTo-Json -Depth 5 | Out-File -Encoding utf8 .\tmp_outgoing_events.json
Get-Content .\tmp_outgoing_events.json

Write-Host "Fetching /admin/webhook-fallback"
Invoke-RestMethod -Uri 'https://betrix-ui-new.onrender.com/admin/webhook-fallback?n=20' -Method GET | ConvertTo-Json -Depth 5 | Out-File -Encoding utf8 .\tmp_webhook_fallback.json
Get-Content .\tmp_webhook_fallback.json
