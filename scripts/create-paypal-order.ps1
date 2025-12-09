$client='AUB94Ew_zYvgl3BzlrOcnYE8PpYorPq8QUTiTCI2I43lx0rGyv_4eYmXAw2_H7BV2mTbMondB106IgXt'
$secret='EDqpXaaqX0Ix8d2kZMcvkhZjTG2uyEep-m0qFS6Ro45OF8eJ9M0w9nV2pqYOapRf5I3xHxMPBB_xH9JU'
$b64=[Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("$client`:$secret"))
try {
  $token = Invoke-RestMethod -Uri 'https://api-m.paypal.com/v1/oauth2/token' -Method Post -Headers @{ Authorization = "Basic $b64" } -Body @{ grant_type = 'client_credentials' } -ContentType 'application/x-www-form-urlencoded'
} catch {
  Write-Error "Failed to obtain token: $($_.Exception.Message)"
  exit 1
}
Write-Host "Obtained token (masked):" ($token.access_token.Substring(0,8) + '...')
$orderBody = @{
  intent = 'CAPTURE'
  purchase_units = @(@{ amount = @{ currency_code = 'USD'; value = '10.00' } })
  application_context = @{ return_url='https://betrix.app/pay/complete'; cancel_url='https://betrix.app/pay/cancel' }
}
try {
  $order = Invoke-RestMethod -Uri 'https://api-m.paypal.com/v2/checkout/orders' -Method Post -Headers @{ Authorization = "Bearer $($token.access_token)"; 'Content-Type' = 'application/json' } -Body ($orderBody | ConvertTo-Json -Depth 6)
} catch {
  Write-Error "Failed to create order: $($_.Exception.Message)"
  if ($_.Exception.Response) { try { $b=($_.Exception.Response | ConvertTo-Json -Depth 5); Write-Host $b } catch {} }
  exit 1
}
Write-Host "Order created. ID: $($order.id)"
$approval = $order.links | Where-Object { $_.rel -match 'approve' } | Select-Object -First 1
Write-Host "Approval link: $($approval.href)"
Write-Host "Full response:"
$order | ConvertTo-Json -Depth 6 | Write-Output
