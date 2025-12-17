@echo off
echo ========================================
echo   启动 Expo Go 隧道模式
echo ========================================
echo.

cd /d "%~dp0"

echo 正在启动隧道模式...
echo.
echo 隧道模式特点:
echo - 不依赖局域网
echo - 手机和电脑可以不在同一 WiFi
echo - 连接更稳定可靠
echo.
echo 首次使用需要登录 Expo 账号
echo 如果没有登录，会提示登录
echo.

npm run start:tunnel

pause

