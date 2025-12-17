# Lily Chat 部署脚本 (PowerShell 版本)
# 用于从 GitHub 拉取最新代码并部署

Write-Host "🚀 开始部署 Lily Chat..." -ForegroundColor Yellow

# 获取脚本所在目录
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# 拉取最新代码
Write-Host "📦 拉取最新代码..." -ForegroundColor Yellow
git pull origin main

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Git pull 失败，请检查网络连接和权限" -ForegroundColor Red
    exit 1
}

Write-Host "✅ 代码拉取成功" -ForegroundColor Green

# 检查 package.json 是否有更新
if (Test-Path "package.json") {
    Write-Host "📦 检查依赖更新..." -ForegroundColor Yellow
    npm install
}

# 检查 website 目录
if (Test-Path "website") {
    Write-Host "📦 更新网站依赖..." -ForegroundColor Yellow
    Set-Location website
    if (Test-Path "package.json") {
        npm install
    }
    Set-Location ..
}

Write-Host "✅ 依赖更新完成" -ForegroundColor Green

# 重启服务提示
Write-Host "🔄 请手动重启服务..." -ForegroundColor Yellow
Write-Host "   - 如果使用 PM2: pm2 restart lily-website" -ForegroundColor Cyan
Write-Host "   - 如果使用 systemd: sudo systemctl restart lily-website" -ForegroundColor Cyan
Write-Host "   - 如果直接运行: 停止旧进程后重新运行 node server.js" -ForegroundColor Cyan

Write-Host "✅ 部署完成！" -ForegroundColor Green
Write-Host "📝 请检查服务状态和日志确认部署成功" -ForegroundColor Green

