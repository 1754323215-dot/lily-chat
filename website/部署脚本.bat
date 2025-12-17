@echo off
chcp 65001 >nul
echo ========================================
echo    Lily 网站部署脚本
echo ========================================
echo.

cd /d "%~dp0"

echo 部署配置:
echo   服务器: 139.129.194.84
echo   端口: 8084
echo.

set /p confirm="确认开始部署? (y/n): "
if /i not "%confirm%"=="y" (
    echo 部署已取消
    pause
    exit /b
)

echo.
echo 正在检查文件...

if not exist "server.js" (
    echo 错误: 找不到 server.js
    pause
    exit /b 1
)

if not exist "package.json" (
    echo 错误: 找不到 package.json
    pause
    exit /b 1
)

if not exist "public" (
    echo 错误: 找不到 public 目录
    pause
    exit /b 1
)

echo ✓ 所有必要文件存在
echo.

echo 请选择部署方式:
echo [1] 使用 PowerShell 脚本 (推荐)
echo [2] 手动部署说明
echo.

set /p choice="请选择 (1/2): "

if "%choice%"=="1" (
    echo.
    echo 正在运行 PowerShell 部署脚本...
    powershell -ExecutionPolicy Bypass -File "部署脚本.ps1"
) else if "%choice%"=="2" (
    echo.
    echo ========================================
    echo   手动部署说明
    echo ========================================
    echo.
    echo 1. 使用 WinSCP 或 FileZilla 连接到服务器:
    echo    服务器: 139.129.194.84
    echo    用户名: (您的服务器用户名)
    echo.
    echo 2. 上传以下文件到服务器 /var/www/lily-website/:
    echo    - server.js
    echo    - package.json
    echo    - public/ 目录 (包含所有文件)
    echo.
    echo 3. 在服务器上执行:
    echo    cd /var/www/lily-website
    echo    npm install
    echo    node server.js
    echo.
    echo 或使用 PM2:
    echo    pm2 start server.js --name lily-website
    echo.
    echo 4. 访问: http://139.129.194.84:8084
    echo.
    echo 详细说明请查看: 部署说明.md
    echo.
) else (
    echo 无效选择
)

echo.
pause
