#!/bin/bash

# TitanChain Production Deployment Script
# TitanChain 生产环境部署脚本

set -e

echo "🚀 Starting TitanChain Production Deployment..."
echo "🚀 开始 TitanChain 生产环境部署..."

# 颜色定义 / Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数 / Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查必要的工具 / Check required tools
check_requirements() {
    log_info "Checking deployment requirements..."
    log_info "检查部署要求..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        log_error "Docker 未安装。请先安装 Docker。"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        log_error "Docker Compose 未安装。请先安装 Docker Compose。"
        exit 1
    fi
    
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js first."
        log_error "Node.js 未安装。请先安装 Node.js。"
        exit 1
    fi
    
    log_success "All requirements satisfied."
    log_success "所有要求都已满足。"
}

# 环境变量检查 / Environment variables check
check_env_vars() {
    log_info "Checking environment variables..."
    log_info "检查环境变量..."
    
    if [ ! -f ".env.production" ]; then
        log_warning ".env.production file not found. Creating from template..."
        log_warning "未找到 .env.production 文件。从模板创建..."
        cp .env.production.example .env.production 2>/dev/null || true
    fi
    
    # 检查关键环境变量 / Check critical environment variables
    required_vars=("DB_PASSWORD" "JWT_SECRET" "API_KEY_SECRET" "ENCRYPTION_KEY")
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            log_error "Environment variable $var is not set."
            log_error "环境变量 $var 未设置。"
            log_error "Please set all required environment variables before deployment."
            log_error "请在部署前设置所有必需的环境变量。"
            exit 1
        fi
    done
    
    log_success "Environment variables check passed."
    log_success "环境变量检查通过。"
}

# 构建应用 / Build application
build_application() {
    log_info "Building TitanChain application..."
    log_info "构建 TitanChain 应用..."
    
    # 安装依赖 / Install dependencies
    log_info "Installing dependencies..."
    log_info "安装依赖..."
    npm ci --production=false
    
    # 构建前端 / Build frontend
    log_info "Building frontend..."
    log_info "构建前端..."
    npm run build
    
    # 构建API / Build API
    log_info "Building API..."
    log_info "构建 API..."
    npm run build:api
    
    log_success "Application build completed."
    log_success "应用构建完成。"
}

# 构建Docker镜像 / Build Docker images
build_docker_images() {
    log_info "Building Docker images..."
    log_info "构建 Docker 镜像..."
    
    # 构建主应用镜像 / Build main application image
    docker build -t titanchain:latest .
    
    log_success "Docker images built successfully."
    log_success "Docker 镜像构建成功。"
}

# 数据库迁移 / Database migration
run_database_migration() {
    log_info "Running database migrations..."
    log_info "运行数据库迁移..."
    
    # 启动数据库服务 / Start database services
    docker-compose up -d postgres redis
    
    # 等待数据库启动 / Wait for database to start
    log_info "Waiting for database to be ready..."
    log_info "等待数据库准备就绪..."
    sleep 10
    
    # 运行迁移脚本 / Run migration scripts
    if [ -f "database/migrate.sql" ]; then
        docker-compose exec -T postgres psql -U titanchain -d titanchain < database/migrate.sql
        log_success "Database migration completed."
        log_success "数据库迁移完成。"
    else
        log_warning "No migration script found."
        log_warning "未找到迁移脚本。"
    fi
}

# 启动服务 / Start services
start_services() {
    log_info "Starting TitanChain services..."
    log_info "启动 TitanChain 服务..."
    
    # 停止现有服务 / Stop existing services
    docker-compose down
    
    # 启动所有服务 / Start all services
    docker-compose up -d
    
    log_success "All services started successfully."
    log_success "所有服务启动成功。"
}

# 健康检查 / Health check
health_check() {
    log_info "Performing health checks..."
    log_info "执行健康检查..."
    
    # 等待服务启动 / Wait for services to start
    sleep 30
    
    # 检查前端服务 / Check frontend service
    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        log_success "Frontend service is healthy."
        log_success "前端服务健康。"
    else
        log_error "Frontend service health check failed."
        log_error "前端服务健康检查失败。"
    fi
    
    # 检查API服务 / Check API service
    if curl -f http://localhost:8080/api/health > /dev/null 2>&1; then
        log_success "API service is healthy."
        log_success "API 服务健康。"
    else
        log_error "API service health check failed."
        log_error "API 服务健康检查失败。"
    fi
    
    # 检查数据库连接 / Check database connection
    if docker-compose exec -T postgres pg_isready -U titanchain > /dev/null 2>&1; then
        log_success "Database connection is healthy."
        log_success "数据库连接健康。"
    else
        log_error "Database connection health check failed."
        log_error "数据库连接健康检查失败。"
    fi
}

# 显示部署信息 / Show deployment information
show_deployment_info() {
    log_success "🎉 TitanChain deployment completed successfully!"
    log_success "🎉 TitanChain 部署成功完成！"
    
    echo ""
    echo "📋 Deployment Information / 部署信息:"
    echo "  Frontend: http://localhost:3000"
    echo "  API: http://localhost:8080"
    echo "  Blockchain RPC: http://localhost:8545"
    echo "  Grafana: http://localhost:3001 (admin/titanchain_admin)"
    echo "  Prometheus: http://localhost:9090"
    echo ""
    echo "📊 Monitoring Commands / 监控命令:"
    echo "  View logs: docker-compose logs -f"
    echo "  Check status: docker-compose ps"
    echo "  Stop services: docker-compose down"
    echo ""
}

# 清理函数 / Cleanup function
cleanup() {
    if [ $? -ne 0 ]; then
        log_error "Deployment failed. Cleaning up..."
        log_error "部署失败。正在清理..."
        docker-compose down
    fi
}

# 设置清理陷阱 / Set cleanup trap
trap cleanup EXIT

# 主部署流程 / Main deployment flow
main() {
    log_info "Starting TitanChain production deployment process..."
    log_info "开始 TitanChain 生产环境部署流程..."
    
    check_requirements
    check_env_vars
    build_application
    build_docker_images
    run_database_migration
    start_services
    health_check
    show_deployment_info
    
    log_success "Deployment process completed successfully!"
    log_success "部署流程成功完成！"
}

# 运行主函数 / Run main function
main "$@"