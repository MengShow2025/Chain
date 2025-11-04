#!/bin/bash

# TitanChain Health Check Script
# TitanChain 健康检查脚本

set -e

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

# 检查服务状态 / Check service status
check_service_status() {
    log_info "Checking Docker services status..."
    log_info "检查 Docker 服务状态..."
    
    if docker-compose ps | grep -q "Up"; then
        log_success "Docker services are running."
        log_success "Docker 服务正在运行。"
        docker-compose ps
    else
        log_error "Some Docker services are not running."
        log_error "某些 Docker 服务未运行。"
        docker-compose ps
        return 1
    fi
}

# 检查前端服务 / Check frontend service
check_frontend() {
    log_info "Checking frontend service..."
    log_info "检查前端服务..."
    
    if curl -f -s http://localhost:3000 > /dev/null; then
        log_success "Frontend service is accessible."
        log_success "前端服务可访问。"
    else
        log_error "Frontend service is not accessible."
        log_error "前端服务不可访问。"
        return 1
    fi
}

# 检查API服务 / Check API service
check_api() {
    log_info "Checking API service..."
    log_info "检查 API 服务..."
    
    # 检查健康端点 / Check health endpoint
    if curl -f -s http://localhost:8080/api/health > /dev/null; then
        log_success "API service health endpoint is accessible."
        log_success "API 服务健康端点可访问。"
    else
        log_warning "API health endpoint not accessible, checking basic connectivity..."
        log_warning "API 健康端点不可访问，检查基本连接..."
        
        if curl -f -s http://localhost:8080/api/blockchain/stats > /dev/null; then
            log_success "API service is accessible."
            log_success "API 服务可访问。"
        else
            log_error "API service is not accessible."
            log_error "API 服务不可访问。"
            return 1
        fi
    fi
}

# 检查区块链服务 / Check blockchain service
check_blockchain() {
    log_info "Checking blockchain service..."
    log_info "检查区块链服务..."
    
    # 检查区块链统计 / Check blockchain stats
    if curl -f -s http://localhost:8080/api/blockchain/stats | jq -e '.success == true' > /dev/null 2>&1; then
        log_success "Blockchain service is responding correctly."
        log_success "区块链服务响应正常。"
    else
        log_warning "Blockchain service may have issues."
        log_warning "区块链服务可能有问题。"
    fi
}

# 检查数据库连接 / Check database connection
check_database() {
    log_info "Checking database connection..."
    log_info "检查数据库连接..."
    
    if docker-compose exec -T postgres pg_isready -U titanchain > /dev/null 2>&1; then
        log_success "Database connection is healthy."
        log_success "数据库连接健康。"
    else
        log_error "Database connection failed."
        log_error "数据库连接失败。"
        return 1
    fi
}

# 检查Redis连接 / Check Redis connection
check_redis() {
    log_info "Checking Redis connection..."
    log_info "检查 Redis 连接..."
    
    if docker-compose exec -T redis redis-cli ping | grep -q "PONG"; then
        log_success "Redis connection is healthy."
        log_success "Redis 连接健康。"
    else
        log_error "Redis connection failed."
        log_error "Redis 连接失败。"
        return 1
    fi
}

# 检查系统资源 / Check system resources
check_system_resources() {
    log_info "Checking system resources..."
    log_info "检查系统资源..."
    
    # 检查磁盘空间 / Check disk space
    disk_usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$disk_usage" -gt 80 ]; then
        log_warning "Disk usage is high: ${disk_usage}%"
        log_warning "磁盘使用率较高: ${disk_usage}%"
    else
        log_success "Disk usage is normal: ${disk_usage}%"
        log_success "磁盘使用率正常: ${disk_usage}%"
    fi
    
    # 检查内存使用 / Check memory usage
    if command -v free &> /dev/null; then
        memory_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
        if [ "$memory_usage" -gt 80 ]; then
            log_warning "Memory usage is high: ${memory_usage}%"
            log_warning "内存使用率较高: ${memory_usage}%"
        else
            log_success "Memory usage is normal: ${memory_usage}%"
            log_success "内存使用率正常: ${memory_usage}%"
        fi
    fi
}

# 检查日志错误 / Check log errors
check_logs() {
    log_info "Checking recent logs for errors..."
    log_info "检查最近的错误日志..."
    
    # 检查最近5分钟的错误日志 / Check error logs from last 5 minutes
    error_count=$(docker-compose logs --since=5m 2>&1 | grep -i error | wc -l)
    
    if [ "$error_count" -gt 10 ]; then
        log_warning "Found $error_count errors in recent logs."
        log_warning "在最近的日志中发现 $error_count 个错误。"
        log_info "Recent errors:"
        log_info "最近的错误:"
        docker-compose logs --since=5m 2>&1 | grep -i error | tail -5
    else
        log_success "No significant errors found in recent logs."
        log_success "最近的日志中未发现重大错误。"
    fi
}

# 性能测试 / Performance test
check_performance() {
    log_info "Running basic performance test..."
    log_info "运行基本性能测试..."
    
    # 测试API响应时间 / Test API response time
    start_time=$(date +%s%N)
    if curl -f -s http://localhost:8080/api/blockchain/stats > /dev/null; then
        end_time=$(date +%s%N)
        response_time=$(( (end_time - start_time) / 1000000 ))
        
        if [ "$response_time" -lt 1000 ]; then
            log_success "API response time is good: ${response_time}ms"
            log_success "API 响应时间良好: ${response_time}ms"
        else
            log_warning "API response time is slow: ${response_time}ms"
            log_warning "API 响应时间较慢: ${response_time}ms"
        fi
    else
        log_error "Performance test failed - API not accessible."
        log_error "性能测试失败 - API 不可访问。"
    fi
}

# 生成健康报告 / Generate health report
generate_report() {
    log_info "Generating health report..."
    log_info "生成健康报告..."
    
    report_file="health-report-$(date +%Y%m%d-%H%M%S).txt"
    
    {
        echo "TitanChain Health Check Report"
        echo "TitanChain 健康检查报告"
        echo "Generated at: $(date)"
        echo "生成时间: $(date)"
        echo ""
        echo "=== Service Status / 服务状态 ==="
        docker-compose ps
        echo ""
        echo "=== System Resources / 系统资源 ==="
        df -h /
        if command -v free &> /dev/null; then
            free -h
        fi
        echo ""
        echo "=== Recent Logs / 最近日志 ==="
        docker-compose logs --tail=20
    } > "$report_file"
    
    log_success "Health report generated: $report_file"
    log_success "健康报告已生成: $report_file"
}

# 主健康检查函数 / Main health check function
main() {
    log_info "🏥 Starting TitanChain health check..."
    log_info "🏥 开始 TitanChain 健康检查..."
    
    failed_checks=0
    
    check_service_status || ((failed_checks++))
    check_frontend || ((failed_checks++))
    check_api || ((failed_checks++))
    check_blockchain || ((failed_checks++))
    check_database || ((failed_checks++))
    check_redis || ((failed_checks++))
    check_system_resources
    check_logs
    check_performance
    
    echo ""
    if [ "$failed_checks" -eq 0 ]; then
        log_success "🎉 All health checks passed!"
        log_success "🎉 所有健康检查都通过了！"
        
        if [ "$1" = "--report" ]; then
            generate_report
        fi
        
        exit 0
    else
        log_error "❌ $failed_checks health check(s) failed."
        log_error "❌ $failed_checks 个健康检查失败。"
        
        if [ "$1" = "--report" ]; then
            generate_report
        fi
        
        exit 1
    fi
}

# 显示帮助信息 / Show help information
show_help() {
    echo "TitanChain Health Check Script"
    echo "TitanChain 健康检查脚本"
    echo ""
    echo "Usage / 用法:"
    echo "  $0                 Run health check / 运行健康检查"
    echo "  $0 --report        Run health check and generate report / 运行健康检查并生成报告"
    echo "  $0 --help          Show this help message / 显示此帮助信息"
    echo ""
}

# 处理命令行参数 / Handle command line arguments
case "$1" in
    --help|-h)
        show_help
        exit 0
        ;;
    --report|-r)
        main --report
        ;;
    *)
        main
        ;;
esac