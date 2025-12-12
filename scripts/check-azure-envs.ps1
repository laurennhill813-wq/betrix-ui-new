$envs = @('AZURE_OPENAI_ENDPOINT','AZURE_OPENAI_KEY','AZURE_OPENAI_DEPLOYMENT','AZURE_EMBEDDINGS_DEPLOYMENT','AZURE_OPENAI_API_VERSION')
foreach ($e in $envs) {
  $v = [Environment]::GetEnvironmentVariable($e)
  if (-not $v) {
    Write-Output "$e=<NOT SET>"
  } else {
    if ($v.Length -gt 12) { $masked = $v.Substring(0,6) + '...' + $v.Substring($v.Length-4) } else { $masked = $v }
    Write-Output "$e=$masked"
  }
}
