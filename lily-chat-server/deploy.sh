#!/bin/bash

# Lily Chat 后端服务器部署脚本
# 用于从 GitHub 拉取最新代码并部署到服务器

set -e  # 遇到错误立即退出

echo "🚀 开始部署 Lily Chat 后端服务器..."

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

echo -e "${GREEN}✅ 依赖更新完成${NC}"

# 重启 PM2 服务
echo -e "${YELLOW}🔄 重启 PM2 服务...${NC}"

if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "lilychat-server"; then
        echo -e "${YELLOW}重启 PM2 服务: lilychat-server${NC}"
        pm2 restart lilychat-server
        echo -e "${GREEN}✅ 服务重启成功${NC}"
    else
        echo -e "${YELLOW}启动 PM2 服务: lilychat-server${NC}"
        pm2 start server.js --name lilychat-server
        pm2 save
        echo -e "${GREEN}✅ 服务启动成功${NC}"
    fi
else
    echo -e "${RED}❌ PM2 未安装，请手动重启服务${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 部署完成！${NC}"

# 显示服务状态
echo ""
echo "PM2 服务状态："
pm2 status lilychat-server

echo ""
echo "最新日志（最后10行）："
pm2 logs lilychat-server --lines 10 --nostream

