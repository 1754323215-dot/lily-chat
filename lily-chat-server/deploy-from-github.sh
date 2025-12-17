#!/bin/bash

# Lily Chat 后端服务器部署脚本（从 GitHub 同步）
# 使用方法：bash deploy-from-github.sh

set -e

echo "🚀 开始从 GitHub 部署 Lily Chat 后端服务器..."

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 配置
GITHUB_REPO="https://github.com/1754323215-dot/lily-chat.git"
SERVER_DIR="/var/www/lilychat-server"
TEMP_DIR="/tmp/lily-chat-deploy-$$"

# 创建临时目录
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

echo -e "${YELLOW}📦 从 GitHub 克隆最新代码...${NC}"
git clone --depth 1 "$GITHUB_REPO" .

if [ ! -d "lily-chat-server" ]; then
    echo -e "${RED}❌ 未找到 lily-chat-server 目录${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 代码拉取成功${NC}"

# 备份当前服务器文件
if [ -d "$SERVER_DIR" ]; then
    echo -e "${YELLOW}📦 备份当前服务器文件...${NC}"
    BACKUP_DIR="${SERVER_DIR}-backup-$(date +%Y%m%d-%H%M%S)"
    cp -r "$SERVER_DIR" "$BACKUP_DIR"
    echo -e "${GREEN}✅ 备份完成: $BACKUP_DIR${NC}"
fi

# 复制文件到服务器目录
echo -e "${YELLOW}📦 复制文件到服务器目录...${NC}"
mkdir -p "$SERVER_DIR"
cp -r lily-chat-server/* "$SERVER_DIR/"
cp lily-chat-server/.gitignore "$SERVER_DIR/" 2>/dev/null || true

# 进入服务器目录
cd "$SERVER_DIR"

# 安装依赖
if [ -f "package.json" ]; then
    echo -e "${YELLOW}📦 安装/更新依赖...${NC}"
    npm install
fi

echo -e "${GREEN}✅ 依赖安装完成${NC}"

# 重启 PM2 服务
echo -e "${YELLOW}🔄 重启 PM2 服务...${NC}"

if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "lilychat-server"; then
        pm2 restart lilychat-server
        echo -e "${GREEN}✅ 服务重启成功${NC}"
    else
        pm2 start server.js --name lilychat-server
        pm2 save
        echo -e "${GREEN}✅ 服务启动成功${NC}"
    fi
else
    echo -e "${RED}❌ PM2 未安装，请手动重启服务${NC}"
    exit 1
fi

# 清理临时目录
rm -rf "$TEMP_DIR"

echo -e "${GREEN}✅ 部署完成！${NC}"

# 显示服务状态
echo ""
echo "PM2 服务状态："
pm2 status lilychat-server

echo ""
echo "最新日志（最后10行）："
pm2 logs lilychat-server --lines 10 --nostream

