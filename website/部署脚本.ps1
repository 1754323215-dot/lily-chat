# Lily 网站部署脚本
# 使用方法：.\部署脚本.ps1

param(
    [string]$ServerIP = "139.129.194.84",
    [string]$ServerUser = "root",
    [string]$ServerPath = "/var/www/lily-website",
    [string]$Port = "8084"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Lily 网站部署脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查当前目录
$currentDir = Get-Location
if (-not (Test-Path "server.js")) {
    Write-Host "错误: 请在 website 目录下运行此脚本" -ForegroundColor Red
    Write-Host "当前目录: $currentDir" -ForegroundColor Yellow
    exit 1
}

Write-Host "部署配置:" -ForegroundColor Green
Write-Host "  服务器: $ServerUser@$ServerIP" -ForegroundColor Yellow
Write-Host "  目标路径: $ServerPath" -ForegroundColor Yellow
Write-Host "  端口: $Port" -ForegroundColor Yellow
Write-Host ""

# 确认部署
$confirm = Read-Host "确认开始部署? (y/n)"
if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "部署已取消" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "步骤 1: 检查文件..." -ForegroundColor Cyan

# 检查必要文件
$requiredFiles = @("server.js", "package.json", "public")
$missingFiles = @()

foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
        $missingFiles += $file
    }
}

if ($missingFiles.Count -gt 0) {
    Write-Host "错误: 缺少以下文件:" -ForegroundColor Red
    foreach ($file in $missingFiles) {
        Write-Host "  - $file" -ForegroundColor Red
    }
    exit 1
}

Write-Host "✓ 所有必要文件存在" -ForegroundColor Green
Write-Host ""

# 检查 SSH/SCP 是否可用
Write-Host "步骤 2: 检查连接..." -ForegroundColor Cyan
$scpAvailable = $false

try {
    $scpTest = Get-Command scp -ErrorAction Stop
    $scpAvailable = $true
    Write-Host "✓ SCP 可用" -ForegroundColor Green
} catch {
    Write-Host "⚠ SCP 不可用，将使用替代方法" -ForegroundColor Yellow
}

Write-Host ""

if ($scpAvailable) {
    Write-Host "步骤 3: 上传文件到服务器..." -ForegroundColor Cyan
    Write-Host "  这可能需要一些时间，请耐心等待..." -ForegroundColor Yellow
    
    try {
        # 创建远程目录
        Write-Host "  创建远程目录..." -ForegroundColor Yellow
        ssh "$ServerUser@$ServerIP" "mkdir -p $ServerPath/public"
        
        # 上传文件
        Write-Host "  上传 server.js..." -ForegroundColor Yellow
        scp server.js "${ServerUser}@${ServerIP}:${ServerPath}/"
        
        Write-Host "  上传 package.json..." -ForegroundColor Yellow
        scp package.json "${ServerUser}@${ServerIP}:${ServerPath}/"
        
        Write-Host "  上传 public 目录..." -ForegroundColor Yellow
        scp -r public/* "${ServerUser}@${ServerIP}:${ServerPath}/public/"
        
        Write-Host "✓ 文件上传完成" -ForegroundColor Green
        Write-Host ""
        
        Write-Host "步骤 4: 在服务器上安装依赖..." -ForegroundColor Cyan
        ssh "$ServerUser@$ServerIP" "cd $ServerPath && npm install"
        Write-Host "✓ 依赖安装完成" -ForegroundColor Green
        Write-Host ""
        
        Write-Host "步骤 5: 启动服务..." -ForegroundColor Cyan
        Write-Host ""
        Write-Host "请选择启动方式:" -ForegroundColor Yellow
        Write-Host "  [1] 直接运行 (测试用)" -ForegroundColor Cyan
        Write-Host "  [2] 使用 PM2 (推荐)" -ForegroundColor Cyan
        Write-Host "  [3] 仅上传文件，不启动" -ForegroundColor Cyan
        Write-Host ""
        
        $startChoice = Read-Host "请选择 (1/2/3)"
        
        switch ($startChoice) {
            "1" {
                Write-Host "  启动服务器..." -ForegroundColor Yellow
                Write-Host "  注意: 这将在前台运行，按 Ctrl+C 停止" -ForegroundColor Yellow
                ssh "$ServerUser@$ServerIP" "cd $ServerPath && node server.js"
            }
            "2" {
                Write-Host "  使用 PM2 启动..." -ForegroundColor Yellow
                ssh "$ServerUser@$ServerIP" "cd $ServerPath && pm2 start server.js --name lily-website || pm2 restart lily-website"
                Write-Host "✓ 服务已启动" -ForegroundColor Green
                Write-Host ""
                Write-Host "查看状态: ssh $ServerUser@$ServerIP 'pm2 status'" -ForegroundColor Cyan
            }
            "3" {
                Write-Host "  文件已上传，请手动启动服务" -ForegroundColor Yellow
            }
        }
        
    } catch {
        Write-Host "错误: 上传失败" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "步骤 3: 准备部署包..." -ForegroundColor Cyan
    
    # 创建部署包
    $deployDir = "deploy-package"
    if (Test-Path $deployDir) {
        Remove-Item -Recurse -Force $deployDir
    }
    New-Item -ItemType Directory -Path $deployDir | Out-Null
    
    Copy-Item server.js $deployDir
    Copy-Item package.json $deployDir
    Copy-Item -Recurse public $deployDir
    
    Write-Host "✓ 部署包已创建: $deployDir" -ForegroundColor Green
    Write-Host ""
    Write-Host "请手动上传以下目录到服务器:" -ForegroundColor Yellow
    Write-Host "  目标路径: $ServerPath" -ForegroundColor Cyan
    Write-Host "  上传方式: WinSCP, FileZilla 或其他 FTP 工具" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "上传后，在服务器上执行:" -ForegroundColor Yellow
    Write-Host "  cd $ServerPath" -ForegroundColor Cyan
    Write-Host "  npm install" -ForegroundColor Cyan
    Write-Host "  node server.js" -ForegroundColor Cyan
    Write-Host "  或使用 PM2: pm2 start server.js --name lily-website" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  部署完成!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "访问地址: http://${ServerIP}:${Port}" -ForegroundColor Green
Write-Host ""
