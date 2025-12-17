#!/bin/bash

# Lily Chat 部署脚本
# 用于从 GitHub 拉取最新代码并部署

set -e  # 遇到错误立即退出

echo "🚀 开始部署 Lily Chat..."

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo -e "${YELLOW}📦 拉取最新代码...${NC}"
git pull origin main

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Git pull 失败，请检查网络连接和权限${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 代码拉取成功${NC}"

# 检查 package.json 是否有更新
if [ -f "package.json" ]; then
    echo -e "${YELLOW}📦 检查依赖更新...${NC}"
    npm install
fi

# 检查 website 目录
if [ -d "website" ]; then
    echo -e "${YELLOW}📦 更新网站依赖...${NC}"
    cd website
    if [ -f "package.json" ]; then
        npm install
    fi
    cd ..
fi

echo -e "${GREEN}✅ 依赖更新完成${NC}"

# 重启服务（根据实际部署方式调整）
echo -e "${YELLOW}🔄 重启服务...${NC}"

# 检查是否使用 PM2
if command -v pm2 &> /dev/null; then
    # 重启 website 服务
    if pm2 list | grep -q "lily-website"; then
        echo -e "${YELLOW}重启 PM2 服务: lily-website${NC}"
        pm2 restart lily-website
    fi
    
    # 如果有其他 PM2 服务，在这里添加
    # pm2 restart lily-api
fi

# 检查是否使用 systemd
if systemctl list-units --type=service | grep -q "lily-website"; then
    echo -e "${YELLOW}重启 systemd 服务: lily-website${NC}"
    sudo systemctl restart lily-website
fi

echo -e "${GREEN}✅ 部署完成！${NC}"
echo -e "${GREEN}📝 请检查服务状态和日志确认部署成功${NC}"

# 显示服务状态
if command -v pm2 &> /dev/null; then
    echo ""
    echo "PM2 服务状态："
    pm2 status
fi

