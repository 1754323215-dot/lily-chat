@echo off
chcp 65001 >nul
echo ========================================
echo   Lily Chat - 快速修复连接问题
echo ========================================
echo.
echo 正在停止旧的服务器进程...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 >nul
echo.
echo 正在启动隧道模式（最稳定）...
echo.
echo 提示：首次使用需要登录 Expo 账号
echo 如果没有账号，请访问 https://expo.dev 注册
echo.
cd /d "%~dp0"
call npm run start:tunnel
pause

