#!/bin/bash

# TitanChain GitHub推送脚本
# 这个脚本帮助您将TitanChain项目推送到GitHub仓库

set -e

echo "🚀 TitanChain GitHub推送工具"
echo "=================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查Git是否安装
if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ Git未安装，请先安装Git${NC}"
    exit 1
fi

# 检查当前目录是否为Git仓库
if [ ! -d ".git" ]; then
    echo -e "${YELLOW}⚠️  当前目录不是Git仓库，是否初始化？${NC}"
    read -p "初始化Git仓库? (y/n): " init_git
    if [ "$init_git" = "y" ]; then
        git init
        echo -e "${GREEN}✅ Git仓库已初始化${NC}"
    else
        exit 1
    fi
fi

# 获取当前分支
current_branch=$(git branch --show-current)
echo -e "${BLUE}📋 当前分支: ${current_branch}${NC}"

# 检查远程仓库
echo -e "${BLUE}🔍 检查远程仓库配置...${NC}"
git remote -v

# 如果没有远程仓库，提示用户添加
if ! git remote | grep -q origin; then
    echo -e "${YELLOW}⚠️  未检测到远程仓库${NC}"
    echo "请在GitHub上创建新仓库，然后输入仓库URL"
    echo "格式: https://github.com/你的用户名/TitanChain.git"
    read -p "输入GitHub仓库URL: " repo_url
    
    if [ -n "$repo_url" ]; then
        git remote add origin "$repo_url"
        echo -e "${GREEN}✅ 远程仓库已添加${NC}"
    else
        echo -e "${RED}❌ 未提供仓库URL，操作取消${NC}"
        exit 1
    fi
fi

# 检查是否有未提交的更改
echo -e "${BLUE}🔍 检查未提交的更改...${NC}"
if ! git diff-index --quiet HEAD --; then
    echo -e "${YELLOW}⚠️  检测到未提交的更改${NC}"
    git status --short
    
    read -p "是否提交这些更改? (y/n): " commit_changes
    if [ "$commit_changes" = "y" ]; then
        read -p "输入提交信息: " commit_message
        if [ -z "$commit_message" ]; then
            commit_message="更新 TitanChain 项目文件"
        fi
        
        git add .
        git commit -m "$commit_message"
        echo -e "${GREEN}✅ 更改已提交${NC}"
    fi
fi

# 推送到GitHub
echo -e "${BLUE}🚀 推送到GitHub...${NC}"
if git push origin "$current_branch"; then
    echo -e "${GREEN}✅ 推送成功！${NC}"
    echo -e "${GREEN}🎉 TitanChain项目已成功推送到GitHub${NC}"
else
    echo -e "${YELLOW}⚠️  推送失败，可能需要先拉取更新${NC}"
    read -p "是否尝试拉取更新并重新推送? (y/n): " retry_push
    if [ "$retry_push" = "y" ]; then
        git pull origin "$current_branch"
        git push origin "$current_branch"
        echo -e "${GREEN}✅ 推送成功！${NC}"
    else
        echo -e "${RED}❌ 推送操作取消${NC}"
        exit 1
    fi
fi

# 显示仓库信息
echo -e "${BLUE}📊 仓库状态:${NC}"
git remote -v
echo -e "${BLUE}最新提交:${NC}"
git log --oneline -5

echo -e "${GREEN}🎉 操作完成！${NC}"
echo -e "${BLUE}您可以在GitHub上查看您的项目: ${repo_url}${NC}"

# 可选：打开浏览器查看
read -p "是否在浏览器中打开GitHub仓库? (y/n): " open_browser
if [ "$open_browser" = "y" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open "$(git remote get-url origin | sed 's/\.git$//')"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        xdg-open "$(git remote get-url origin | sed 's/\.git$//')"
    fi
fi