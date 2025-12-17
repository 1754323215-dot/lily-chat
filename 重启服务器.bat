@echo off
echo 正在清除缓存并重启服务器...
cd /d F:\A\mobile-app
rmdir /s /q .expo 2>nul
rmdir /s /q node_modules\.cache 2>nul
echo 缓存已清除
echo 正在启动 tunnel 模式...
npm run start:tunnel
pause

