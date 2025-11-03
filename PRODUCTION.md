# TitanChain 生产环境部署指南

## 📊 当前系统状态

**最新更新**: 2024年12月
**系统集成测试通过率**: 75% (6/8)
**生产就绪状态**: 部分就绪 ⚠️

### ✅ 已验证的生产组件
- **API服务器** (端口3001) - 生产就绪 ✅
- **API网关** (端口8889) - 负载均衡功能正常 ✅
- **P2P网络** (端口4003) - 网络通信正常 ✅
- **区块链核心** - 节点启动和基础功能正常 ✅
- **健康检查系统** - 监控端点完全可用 ✅
- **TypeScript编译** - 代码质量保证 ✅

### ⚠️ 待完成的生产组件
- **智能分片系统** - 需要实现核心模块
- **MPC多方计算** - 需要实现安全计算功能

### 🌐 生产环境服务端点
- **主API**: `https://your-domain.com/api`
- **API网关**: `https://your-domain.com`
- **API文档**: `https://your-domain.com/api/docs`
- **健康检查**: `https://your-domain.com/health`
- **系统统计**: `https://your-domain.com/stats`

## 🚀 快速部署

### 前置要求

- Docker 20.0.0+
- Docker Compose 2.0.0+
- Node.js 18.0.0+
- 至少 8GB RAM
- 至少 100GB 可用磁盘空间

### 一键部署

```bash
# 1. 克隆项目
git clone https://github.com/your-org/titanchain.git
cd titanchain

# 2. 配置环境变量
cp .env.production.example .env.production
# 编辑 .env.production 文件，设置必要的密钥和密码

# 3. 运行部署脚本
npm run deploy:prod
```

## 📋 详细部署步骤

### 1. 环境准备

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 启动 Docker 服务
sudo systemctl enable docker
sudo systemctl start docker
```

### 2. 项目配置

```bash
# 克隆项目
git clone https://github.com/your-org/titanchain.git
cd titanchain

# 复制环境配置文件
cp .env.production.example .env.production
```

### 3. 环境变量配置

编辑 `.env.production` 文件，设置以下关键变量：

```bash
# 数据库密码（必须设置强密码）
DB_PASSWORD=your_strong_database_password

# JWT 密钥（使用 openssl rand -hex 32 生成）
JWT_SECRET=your_jwt_secret_key_64_chars_minimum

# API 密钥
API_KEY_SECRET=your_api_key_secret_64_chars_minimum

# 加密密钥
ENCRYPTION_KEY=your_encryption_key_64_chars_minimum

# 域名配置（生产环境）
DOMAIN=your-domain.com
API_DOMAIN=api.your-domain.com
```

### 4. SSL 证书配置

```bash
# 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 获取 SSL 证书
sudo certbot --nginx -d your-domain.com -d api.your-domain.com

# 设置自动续期
sudo crontab -e
# 添加：0 12 * * * /usr/bin/certbot renew --quiet
```

### 5. 部署应用

```bash
# 使用部署脚本
npm run deploy:prod

# 或手动部署
npm run build:prod
npm run docker:build
npm run docker:run
```

## 🏥 健康检查和监控

### 健康检查

```bash
# 基本健康检查
npm run health:check

# 生成详细报告
npm run health:report
```

### 监控服务

```bash
# 启动监控服务
npm run monitor:start

# 访问监控面板
# Grafana: http://your-domain:3001 (admin/titanchain_admin)
# Prometheus: http://your-domain:9090
```

### 日志查看

```bash
# 查看所有服务日志
npm run docker:logs

# 查看特定服务日志
npm run logs:api      # API 服务日志
npm run logs:db       # 数据库日志
npm run logs:redis    # Redis 日志
```

## 🔧 运维操作

### 服务管理

```bash
# 重启服务
npm run docker:restart

# 停止服务
npm run docker:stop

# 清理系统（谨慎使用）
npm run docker:clean
```

### 数据库备份

```bash
# 创建数据库备份
npm run backup:db

# 恢复数据库（从备份文件）
cat backup-20231201-120000.sql | npm run restore:db
```

### 性能优化

#### 系统优化

```bash
# 优化内核参数
echo 'net.core.somaxconn = 65535' | sudo tee -a /etc/sysctl.conf
echo 'net.ipv4.tcp_max_syn_backlog = 65535' | sudo tee -a /etc/sysctl.conf
echo 'fs.file-max = 1000000' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# 优化文件描述符限制
echo '* soft nofile 1000000' | sudo tee -a /etc/security/limits.conf
echo '* hard nofile 1000000' | sudo tee -a /etc/security/limits.conf
```

#### 数据库优化

```bash
# 进入数据库容器
docker-compose exec postgres psql -U titanchain -d titanchain

# 创建索引（根据需要）
CREATE INDEX CONCURRENTLY idx_transactions_timestamp ON transactions(timestamp);
CREATE INDEX CONCURRENTLY idx_blocks_number ON blocks(number);
```

## 🔒 安全配置

### 防火墙设置

```bash
# 安装 UFW
sudo apt install ufw

# 配置防火墙规则
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### SSL 安全配置

确保 `nginx.conf` 中包含以下安全配置：

```nginx
# 安全头
add_header X-Frame-Options DENY;
add_header X-Content-Type-Options nosniff;
add_header X-XSS-Protection "1; mode=block";
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

# SSL 配置
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
ssl_prefer_server_ciphers off;
```

## 📊 性能指标

### 关键指标

- **TPS**: 目标 500,000 TPS
- **延迟**: 目标 < 100ms
- **可用性**: 目标 99.9%
- **内存使用**: < 80%
- **磁盘使用**: < 80%

### 监控告警

在 Grafana 中设置以下告警：

1. API 响应时间 > 1000ms
2. 内存使用率 > 80%
3. 磁盘使用率 > 80%
4. 错误率 > 1%
5. 服务不可用

## 🚨 故障排除

### 常见问题

#### 1. 服务启动失败

```bash
# 检查日志
npm run docker:logs

# 检查端口占用
sudo netstat -tlnp | grep :3000
sudo netstat -tlnp | grep :8080

# 重启服务
npm run docker:restart
```

#### 2. 数据库连接失败

```bash
# 检查数据库状态
docker-compose exec postgres pg_isready -U titanchain

# 重启数据库
docker-compose restart postgres

# 检查数据库日志
npm run logs:db
```

#### 3. 内存不足

```bash
# 检查内存使用
free -h
docker stats

# 清理 Docker 缓存
docker system prune -f

# 重启服务
npm run docker:restart
```

#### 4. SSL 证书问题

```bash
# 检查证书状态
sudo certbot certificates

# 手动续期证书
sudo certbot renew

# 重启 Nginx
docker-compose restart nginx
```

### 紧急恢复

#### 数据恢复

```bash
# 从最新备份恢复
cat backup-latest.sql | npm run restore:db

# 重启所有服务
npm run docker:restart
```

#### 回滚部署

```bash
# 停止当前服务
npm run docker:stop

# 切换到上一个版本
git checkout previous-stable-tag

# 重新部署
npm run deploy:prod
```

## 📞 支持联系

- **技术支持**: tech-support@titanchain.com
- **紧急联系**: emergency@titanchain.com
- **文档**: https://docs.titanchain.com

## 📝 更新日志

### v1.0.0 (2024-01-01)
- 初始生产环境部署
- 基础监控和告警
- 自动化部署脚本

### 维护计划

- **每日**: 自动备份数据库
- **每周**: 系统健康检查
- **每月**: 安全更新和补丁
- **每季度**: 性能优化和容量规划