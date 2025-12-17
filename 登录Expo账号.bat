@echo off
chcp 65001 >nul
echo ========================================
echo   Expo 账号登录
echo ========================================
echo.
echo 正在登录 Expo 账号...
echo.
echo 提示：
echo 1. 如果没有账号，请访问 https://expo.dev 注册（免费）
echo 2. 输入您的邮箱或用户名
echo 3. 输入密码
echo.
cd /d "%~dp0"
call npx expo login
echo.
echo 登录完成！
echo.
pause

