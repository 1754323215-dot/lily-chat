# 通过 SSH 在服务器上拉代码、构建 lily-chat-web、重启 PM2；失败或超时可多次重试（供本机/Cursor 调用）
$ErrorActionPreference = "Continue"
$PemPath = "G:\a3292003647.pem"
$SshTarget = "root@139.129.194.84"
$RemoteCmd = @'
cd /var/www/lily-chat && git fetch origin main && git reset --hard origin/main && cd lily-chat-web && npm run build && (pm2 delete lily-chat-web 2>/dev/null || true) && pm2 start server.js --name lily-chat-web && pm2 save && echo DEPLOY_OK
'@
$MaxAttempts = 5
$DelaySec = 10

for ($i = 1; $i -le $MaxAttempts; $i++) {
  Write-Host "=== lily-chat-web deploy attempt $i / $MaxAttempts ===" -ForegroundColor Cyan
  ssh -i $PemPath -o BatchMode=yes -o ConnectTimeout=30 $SshTarget $RemoteCmd
  if ($LASTEXITCODE -eq 0) {
    Write-Host "Deploy finished successfully." -ForegroundColor Green
    exit 0
  }
  Write-Host "Attempt $i failed (exit $LASTEXITCODE). Retrying in ${DelaySec}s..." -ForegroundColor Yellow
  if ($i -lt $MaxAttempts) { Start-Sleep -Seconds $DelaySec }
}

Write-Host "Deploy failed after $MaxAttempts attempts." -ForegroundColor Red
exit 1
