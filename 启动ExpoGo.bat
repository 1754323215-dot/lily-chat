@echo off
echo ========================================
echo   启动 Expo Go 开发服务器
echo ========================================
echo.

cd /d "%~dp0"

echo 选择启动模式:
echo.
echo [1] LAN 模式 (推荐，需要手机和电脑同一 WiFi)
echo [2] 隧道模式 (最稳定，需要 Expo 账号)
echo [3] 清除缓存启动
echo.

set /p choice="请选择 (1/2/3): "

if "%choice%"=="1" (
    echo.
    echo 启动 LAN 模式...
    echo 二维码和连接信息将显示在下方
    echo.
    npm start
) else if "%choice%"=="2" (
    echo.
    echo 启动隧道模式...
    echo 首次使用需要登录 Expo 账号
    echo.
    npm run start:tunnel
) else if "%choice%"=="3" (
    echo.
    echo 清除缓存并启动...
    echo.
    npm run start:clear
) else (
    echo.
    echo 无效选择，使用默认 LAN 模式...
    echo.
    npm start
)

pause

