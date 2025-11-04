#!/bin/bash

# TitanChain GitHub推送脚本 - 简化版
# 一键推送TitanChain到GitHub

set -e

echo "🚀 TitanChain GitHub推送工具"
echo "=================================="

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}步骤1: 检查Git状态${NC}"
git status

echo -e "${BLUE}步骤2: 添加所有更改${NC}"
git add .

echo -e "${BLUE}步骤3: 创建提交${NC}"
read -p "请输入提交信息 (默认: '更新TitanChain项目'): " commit_msg
if [ -z "$commit_msg" ]; then
    commit_msg="更新TitanChain项目"
fi
git commit -m "$commit_msg"

echo -e "${BLUE}步骤4: 检查远程仓库${NC}"
if ! git remote | grep -q origin; then
    echo -e "${YELLOW}未找到远程仓库，请先运行完整版推送脚本${NC}"
    exit 1
fi

echo -e "${BLUE}步骤5: 推送到GitHub${NC}"
current_branch=$(git branch --show-current)
git push origin "$current_branch"

echo -e "${GREEN}✅ 推送完成！${NC}"
echo -e "${BLUE}仓库地址: $(git remote get-url origin)${NC}"