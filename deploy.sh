#!/bin/bash

# TitanChain部署脚本
set -e

echo "🚀 开始部署TitanChain..."

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ Docker未安装，请先安装Docker"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose未安装，请先安装Docker Compose"
    exit 1
fi

# 设置环境变量
export NODE_ENV=production

echo "📦 构建Docker镜像..."
docker build -t titanchain:latest .

echo "🔧 启动服务..."
docker-compose up -d

echo "⏳ 等待服务启动..."
sleep 30

# 检查服务状态
echo "🔍 检查服务状态..."
docker-compose ps

# 健康检查
echo "🏥 执行健康检查..."
if curl -f http://localhost/health > /dev/null 2>&1; then
    echo "✅ 前端服务健康"
else
    echo "❌ 前端服务异常"
fi

if curl -f http://localhost/api/health > /dev/null 2>&1; then
    echo "✅ 后端API服务健康"
else
    echo "❌ 后端API服务异常"
fi

echo "📊 服务访问地址："
echo "  - 前端应用: http://localhost"
echo "  - API接口: http://localhost/api"
echo "  - 监控面板: http://localhost:3001 (admin/titanchain_admin)"
echo "  - Prometheus: http://localhost:9090"

echo "📝 查看日志命令："
echo "  docker-compose logs -f"

echo "🛑 停止服务命令："
echo "  docker-compose down"

echo "🎉 TitanChain部署完成！"