# TitanChain 部署文档 - 最终版

## 1. 部署概述

TitanChain支持多种部署方式，包括开发环境、测试环境和生产环境部署。本文档详细介绍了各种部署场景的配置和操作步骤，确保系统能够稳定、高效地运行。

### 1.1 部署架构

```mermaid
graph TB
    A[负载均衡器] --> B[前端服务集群]
    A --> C[API网关集群]
    C --> D[区块链节点集群]
    C --> E[业务服务集群]
    
    D --> F[PostgreSQL主从集群]
    E --> F
    D --> G[Redis集群]
    E --> G
    
    H[监控系统] --> D
    H --> E
    H --> F
    H --> G
    
    subgraph "前端层"
        B1[前端服务1]
        B2[前端服务2]
        B3[前端服务N]
    end
    
    subgraph "API层"
        C1[API网关1]
        C2[API网关2]
        C3[API网关N]
    end
    
    subgraph "区块链层"
        D1[验证节点1]
        D2[验证节点2]
        D3[验证节点108]
    end
    
    subgraph "业务层"
        E1[交易服务]
        E2[保证金服务]
        E3[安全服务]
    end
    
    subgraph "数据层"
        F1[PostgreSQL主库]
        F2[PostgreSQL从库1]
        F3[PostgreSQL从库N]
        G1[Redis主节点]
        G2[Redis从节点]
    end
```

### 1.2 部署环境

- **开发环境**: 单机部署，用于开发和调试
- **测试环境**: 多节点部署，用于功能和性能测试
- **生产环境**: 高可用集群部署，支持大规模用户访问

## 2. 环境要求

### 2.1 硬件要求

**最小配置（开发环境）**
- CPU: 4核心
- 内存: 8GB RAM
- 存储: 100GB SSD
- 网络: 100Mbps

**推荐配置（测试环境）**
- CPU: 8核心
- 内存: 16GB RAM
- 存储: 500GB SSD
- 网络: 1Gbps

**生产配置（单节点）**
- CPU: 16核心
- 内存: 64GB RAM
- 存储: 2TB NVMe SSD
- 网络: 10Gbps

### 2.2 软件要求

**操作系统**
- Ubuntu 20.04 LTS 或更高版本
- CentOS 8 或更高版本
- macOS 12 或更高版本（仅开发环境）

**运行时环境**
- Node.js v18.0.0+
- npm v8.0.0+
- Docker v20.0.0+
- Docker Compose v2.0.0+

**数据库**
- PostgreSQL v14.0+
- Redis v6.0+

**其他工具**
- Git v2.30+
- Nginx v1.20+（生产环境）
- PM2 v5.0+（进程管理）

## 3. 开发环境部署

### 3.1 快速开始

```bash
# 1. 克隆项目 / Clone project
git clone https://github.com/your-org/titanchain.git
cd titanchain

# 2. 安装依赖 / Install dependencies
npm install

# 3. 环境配置 / Environment configuration
cp .env.example .env
# 编辑.env文件，配置必要参数

# 4. 启动数据库服务 / Start database services
docker-compose up -d postgres redis

# 5. 数据库初始化 / Initialize database
npm run db:migrate
npm run db:seed

# 6. 启动开发服务 / Start development services
npm run dev:full
```

### 3.2 环境变量配置

创建`.env`文件并配置以下参数：

```bash
# 基础配置 / Basic Configuration
NODE_ENV=development
PORT=3000
API_PORT=8080
BLOCKCHAIN_PORT=8545

# 数据库配置 / Database Configuration
DATABASE_URL=postgresql://titanchain:password@localhost:5432/titanchain_dev
REDIS_URL=redis://localhost:6379

# 区块链配置 / Blockchain Configuration
CHAIN_ID=7777
NETWORK_NAME=TitanChain
GENESIS_BLOCK_HASH=0x0000000000000000000000000000000000000000000000000000000000000000

# 安全配置 / Security Configuration
JWT_SECRET=your-jwt-secret-key
API_KEY_SECRET=your-api-key-secret
ENCRYPTION_KEY=your-encryption-key

# 性能配置 / Performance Configuration
MAX_TPS=50000
TARGET_LATENCY=100
BATCH_SIZE=1000
CACHE_TTL=300

# 监控配置 / Monitoring Configuration
ENABLE_METRICS=true
METRICS_PORT=9090
LOG_LEVEL=debug
```

### 3.3 开发服务启动

```bash
# 启动所有服务 / Start all services
npm run dev:full

# 或者分别启动各个服务 / Or start services separately
npm run client:dev      # 前端开发服务 (http://localhost:5173)
npm run server:dev      # API服务 (http://localhost:8080)
npm run blockchain:dev  # 区块链节点 (http://localhost:8545)
npm run gateway:dev     # API网关 (http://localhost:3000)
```

## 4. Docker部署

### 4.1 Docker Compose配置

`docker-compose.yml`文件配置：

```yaml
version: '3.8'

services:
  # 前端服务 / Frontend Service
  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - VITE_API_URL=http://api:8080
    depends_on:
      - api
    networks:
      - titanchain

  # API服务 / API Service
  api:
    build:
      context: .
      dockerfile: Dockerfile.api
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://titanchain:${DB_PASSWORD}@postgres:5432/titanchain
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    networks:
      - titanchain
    volumes:
      - ./logs:/app/logs

  # 区块链节点 / Blockchain Node
  blockchain:
    build:
      context: .
      dockerfile: Dockerfile.blockchain
    ports:
      - "8545:8545"
      - "30303:30303"
    environment:
      - NODE_ENV=production
      - CHAIN_ID=7777
      - DATABASE_URL=postgresql://titanchain:${DB_PASSWORD}@postgres:5432/titanchain
    depends_on:
      - postgres
      - redis
    networks:
      - titanchain
    volumes:
      - blockchain_data:/app/data
      - ./logs:/app/logs

  # PostgreSQL数据库 / PostgreSQL Database
  postgres:
    image: postgres:14
    environment:
      - POSTGRES_DB=titanchain
      - POSTGRES_USER=titanchain
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    ports:
      - "5432:5432"
    networks:
      - titanchain
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init.sql:/docker-entrypoint-initdb.d/init.sql

  # Redis缓存 / Redis Cache
  redis:
    image: redis:6-alpine
    ports:
      - "6379:6379"
    networks:
      - titanchain
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

  # Nginx负载均衡 / Nginx Load Balancer
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - frontend
      - api
    networks:
      - titanchain

networks:
  titanchain:
    driver: bridge

volumes:
  postgres_data:
  redis_data:
  blockchain_data:
```

### 4.2 Dockerfile配置

**前端Dockerfile** (`Dockerfile.frontend`)
```dockerfile
# 构建阶段 / Build stage
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

# 生产阶段 / Production stage
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.frontend.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
```

**API服务Dockerfile** (`Dockerfile.api`)
```dockerfile
FROM node:18-alpine

WORKDIR /app

# 安装依赖 / Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# 复制源码 / Copy source code
COPY . .

# 构建TypeScript / Build TypeScript
RUN npm run build:api

# 创建非root用户 / Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S titanchain -u 1001

# 设置权限 / Set permissions
RUN chown -R titanchain:nodejs /app
USER titanchain

EXPOSE 8080

CMD ["node", "api/dist/server.js"]
```

### 4.3 Docker部署命令

```bash
# 构建镜像 / Build images
docker-compose build

# 启动服务 / Start services
docker-compose up -d

# 查看服务状态 / Check service status
docker-compose ps

# 查看日志 / View logs
docker-compose logs -f

# 停止服务 / Stop services
docker-compose down

# 清理数据 / Clean up data
docker-compose down -v
```

## 5. 生产环境部署

### 5.1 服务器准备

**系统优化**
```bash
# 更新系统 / Update system
sudo apt update && sudo apt upgrade -y

# 安装必要软件 / Install required software
sudo apt install -y curl wget git vim htop

# 优化内核参数 / Optimize kernel parameters
echo 'net.core.somaxconn = 65535' | sudo tee -a /etc/sysctl.conf
echo 'net.ipv4.tcp_max_syn_backlog = 65535' | sudo tee -a /etc/sysctl.conf
echo 'fs.file-max = 1000000' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# 优化文件描述符限制 / Optimize file descriptor limits
echo '* soft nofile 1000000' | sudo tee -a /etc/security/limits.conf
echo '* hard nofile 1000000' | sudo tee -a /etc/security/limits.conf
```

**安装Docker**
```bash
# 安装Docker / Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 安装Docker Compose / Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 启动Docker服务 / Start Docker service
sudo systemctl enable docker
sudo systemctl start docker
```

### 5.2 SSL证书配置

**使用Let's Encrypt获取免费SSL证书**
```bash
# 安装Certbot / Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# 获取SSL证书 / Obtain SSL certificate
sudo certbot --nginx -d your-domain.com -d api.your-domain.com

# 设置自动续期 / Set up auto-renewal
sudo crontab -e
# 添加以下行 / Add the following line:
# 0 12 * * * /usr/bin/certbot renew --quiet
```

### 5.3 Nginx配置

`nginx.conf`配置文件：

```nginx
events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # 日志格式 / Log format
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    # 性能优化 / Performance optimization
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 100M;

    # Gzip压缩 / Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # 限流配置 / Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=100r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/s;

    # 前端服务 / Frontend service
    upstream frontend {
        server frontend:3000;
    }

    # API服务 / API service
    upstream api {
        server api:8080;
    }

    # 区块链RPC服务 / Blockchain RPC service
    upstream blockchain {
        server blockchain:8545;
    }

    # 主站配置 / Main site configuration
    server {
        listen 80;
        server_name your-domain.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name your-domain.com;

        # SSL配置 / SSL configuration
        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;

        # 安全头 / Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

        # 前端静态文件 / Frontend static files
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # API接口 / API endpoints
        location /api/ {
            limit_req zone=api burst=200 nodelay;
            proxy_pass http://api;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_timeout 30s;
        }

        # 区块链RPC接口 / Blockchain RPC endpoints
        location /rpc/ {
            limit_req zone=api burst=100 nodelay;
            proxy_pass http://blockchain/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_timeout 60s;
        }

        # WebSocket支持 / WebSocket support
        location /ws/ {
            proxy_pass http://api;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

### 5.4 数据库集群配置

**PostgreSQL主从配置**

主库配置 (`postgresql.conf`)：
```conf
# 连接配置 / Connection configuration
listen_addresses = '*'
port = 5432
max_connections = 1000

# 内存配置 / Memory configuration
shared_buffers = 8GB
effective_cache_size = 24GB
work_mem = 256MB
maintenance_work_mem = 2GB

# WAL配置 / WAL configuration
wal_level = replica
max_wal_senders = 10
max_replication_slots = 10
wal_keep_segments = 64

# 检查点配置 / Checkpoint configuration
checkpoint_completion_target = 0.9
checkpoint_timeout = 15min
max_wal_size = 4GB
min_wal_size = 1GB

# 日志配置 / Logging configuration
log_destination = 'stderr'
logging_collector = on
log_directory = 'pg_log'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_min_duration_statement = 1000
```

从库配置 (`recovery.conf`)：
```conf
standby_mode = 'on'
primary_conninfo = 'host=postgres-master port=5432 user=replicator password=replica_password'
trigger_file = '/tmp/postgresql.trigger'
```

**Redis集群配置**

Redis主节点配置：
```conf
# 基础配置 / Basic configuration
port 6379
bind 0.0.0.0
protected-mode yes
requirepass your-redis-password

# 内存配置 / Memory configuration
maxmemory 4gb
maxmemory-policy allkeys-lru

# 持久化配置 / Persistence configuration
save 900 1
save 300 10
save 60 10000
appendonly yes
appendfsync everysec

# 主从复制配置 / Master-slave replication
repl-diskless-sync yes
repl-diskless-sync-delay 5
```

### 5.5 监控和日志

**Prometheus监控配置**

`prometheus.yml`：
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "titanchain_rules.yml"

scrape_configs:
  - job_name: 'titanchain-api'
    static_configs:
      - targets: ['api:8080']
    metrics_path: '/metrics'
    scrape_interval: 5s

  - job_name: 'titanchain-blockchain'
    static_configs:
      - targets: ['blockchain:9090']
    metrics_path: '/metrics'
    scrape_interval: 5s

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

**告警规则配置**

`titanchain_rules.yml`：
```yaml
groups:
  - name: titanchain
    rules:
      - alert: HighLatency
        expr: titan_latency_p99 > 1000
        for: 30s
        labels:
          severity: critical
        annotations:
          summary: "TitanChain high latency detected"
          description: "P99 latency is {{ $value }}ms"

      - alert: LowTPS
        expr: titan_tps < 10000
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "TitanChain low TPS detected"
          description: "Current TPS is {{ $value }}"

      - alert: DatabaseConnectionHigh
        expr: pg_stat_activity_count > 800
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High database connections"
          description: "Database connections: {{ $value }}"

      - alert: RedisMemoryHigh
        expr: redis_memory_used_bytes / redis_memory_max_bytes > 0.9
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Redis memory usage high"
          description: "Redis memory usage: {{ $value | humanizePercentage }}"
```

## 6. 性能调优

### 6.1 应用层优化

**Node.js性能调优**
```bash
# 设置Node.js环境变量 / Set Node.js environment variables
export NODE_ENV=production
export NODE_OPTIONS="--max-old-space-size=8192 --optimize-for-size"

# PM2进程管理配置 / PM2 process management configuration
# ecosystem.config.js
module.exports = {
  apps: [{
    name: 'titanchain-api',
    script: './api/dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 8080
    },
    max_memory_restart: '2G',
    node_args: '--max-old-space-size=2048'
  }, {
    name: 'titanchain-blockchain',
    script: './blockchain/start-node.js',
    instances: 1,
    env: {
      NODE_ENV: 'production',
      PORT: 8545
    },
    max_memory_restart: '4G',
    node_args: '--max-old-space-size=4096'
  }]
};
```

**数据库连接池优化**
```typescript
// 数据库连接池配置 / Database connection pool configuration
const poolConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  
  // 连接池配置 / Connection pool configuration
  min: 10,                    // 最小连接数 / Minimum connections
  max: 100,                   // 最大连接数 / Maximum connections
  acquireTimeoutMillis: 30000, // 获取连接超时 / Acquire timeout
  idleTimeoutMillis: 30000,   // 空闲超时 / Idle timeout
  
  // 性能优化 / Performance optimization
  ssl: process.env.NODE_ENV === 'production',
  statement_timeout: 30000,   // 语句超时 / Statement timeout
  query_timeout: 30000,       // 查询超时 / Query timeout
  connectionTimeoutMillis: 5000, // 连接超时 / Connection timeout
};
```

### 6.2 数据库优化

**PostgreSQL性能调优**
```sql
-- 创建必要索引 / Create necessary indexes
CREATE INDEX CONCURRENTLY idx_transactions_block_number ON transactions(block_number);
CREATE INDEX CONCURRENTLY idx_transactions_from_address ON transactions(from_address);
CREATE INDEX CONCURRENTLY idx_transactions_to_address ON transactions(to_address);
CREATE INDEX CONCURRENTLY idx_transactions_timestamp ON transactions(timestamp DESC);

CREATE INDEX CONCURRENTLY idx_blocks_timestamp ON blocks(timestamp DESC);
CREATE INDEX CONCURRENTLY idx_blocks_validator ON blocks(validator);

CREATE INDEX CONCURRENTLY idx_positions_user_active ON positions(user_address, is_active);
CREATE INDEX CONCURRENTLY idx_orders_user_status ON orders(user_address, status);

-- 分区表配置 / Partition table configuration
CREATE TABLE transactions_2024 PARTITION OF transactions
FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

-- 定期维护 / Regular maintenance
-- 每日执行 / Execute daily
VACUUM ANALYZE;
REINDEX DATABASE titanchain;
```

**Redis性能调优**
```conf
# 内存优化 / Memory optimization
maxmemory-policy allkeys-lru
hash-max-ziplist-entries 512
hash-max-ziplist-value 64
list-max-ziplist-size -2
set-max-intset-entries 512
zset-max-ziplist-entries 128
zset-max-ziplist-value 64

# 网络优化 / Network optimization
tcp-keepalive 300
timeout 0
tcp-backlog 511

# 持久化优化 / Persistence optimization
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error no
rdbcompression yes
rdbchecksum yes
```

### 6.3 网络优化

**Nginx性能调优**
```nginx
# 工作进程配置 / Worker process configuration
worker_processes auto;
worker_rlimit_nofile 100000;

events {
    worker_connections 4000;
    use epoll;
    multi_accept on;
}

http {
    # 缓冲区优化 / Buffer optimization
    client_body_buffer_size 128k;
    client_max_body_size 100m;
    client_header_buffer_size 1k;
    large_client_header_buffers 4 4k;
    output_buffers 1 32k;
    postpone_output 1460;

    # 超时配置 / Timeout configuration
    client_header_timeout 3m;
    client_body_timeout 3m;
    send_timeout 3m;
    keepalive_timeout 65;
    keepalive_requests 100000;

    # 压缩优化 / Compression optimization
    gzip on;
    gzip_min_length 1000;
    gzip_buffers 4 4k;
    gzip_comp_level 5;
    gzip_types
        application/atom+xml
        application/javascript
        application/json
        application/rss+xml
        application/vnd.ms-fontobject
        application/x-font-ttf
        application/x-web-app-manifest+json
        application/xhtml+xml
        application/xml
        font/opentype
        image/svg+xml
        image/x-icon
        text/css
        text/plain
        text/x-component;

    # 缓存配置 / Cache configuration
    open_file_cache max=200000 inactive=20s;
    open_file_cache_valid 30s;
    open_file_cache_min_uses 2;
    open_file_cache_errors on;
}
```

## 7. 监控和运维

### 7.1 系统监控

**关键指标监控**
- **性能指标**: TPS、延迟、吞吐量
- **系统指标**: CPU、内存、磁盘、网络
- **业务指标**: 活跃用户、交易量、错误率
- **安全指标**: 攻击检测、异常行为、威胁等级

**监控工具配置**
```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - ./monitoring/rules:/etc/prometheus/rules
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=200h'
      - '--web.enable-lifecycle'

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./monitoring/grafana/datasources:/etc/grafana/provisioning/datasources

  alertmanager:
    image: prom/alertmanager:latest
    ports:
      - "9093:9093"
    volumes:
      - ./monitoring/alertmanager.yml:/etc/alertmanager/alertmanager.yml

volumes:
  grafana_data:
```

### 7.2 日志管理

**日志配置**
```typescript
// 日志配置 / Logging configuration
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'titanchain' },
  transports: [
    // 错误日志 / Error logs
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 100 * 1024 * 1024, // 100MB
      maxFiles: 10
    }),
    
    // 综合日志 / Combined logs
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 100 * 1024 * 1024, // 100MB
      maxFiles: 10
    }),
    
    // 控制台输出 / Console output
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});
```

**日志轮转配置**
```bash
# /etc/logrotate.d/titanchain
/app/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 titanchain titanchain
    postrotate
        systemctl reload titanchain
    endscript
}
```

### 7.3 备份策略

**数据库备份**
```bash
#!/bin/bash
# backup.sh - 数据库备份脚本 / Database backup script

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/postgresql"
DB_NAME="titanchain"

# 创建备份目录 / Create backup directory
mkdir -p $BACKUP_DIR

# 执行备份 / Execute backup
pg_dump -h localhost -U titanchain -d $DB_NAME | gzip > $BACKUP_DIR/titanchain_$DATE.sql.gz

# 删除7天前的备份 / Delete backups older than 7 days
find $BACKUP_DIR -name "titanchain_*.sql.gz" -mtime +7 -delete

# 上传到云存储 / Upload to cloud storage
aws s3 cp $BACKUP_DIR/titanchain_$DATE.sql.gz s3://titanchain-backups/postgresql/

echo "Backup completed: titanchain_$DATE.sql.gz"
```

**区块链数据备份**
```bash
#!/bin/bash
# blockchain-backup.sh - 区块链数据备份脚本 / Blockchain data backup script

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/blockchain"
DATA_DIR="/app/blockchain/data"

# 创建备份目录 / Create backup directory
mkdir -p $BACKUP_DIR

# 压缩区块链数据 / Compress blockchain data
tar -czf $BACKUP_DIR/blockchain_data_$DATE.tar.gz -C $DATA_DIR .

# 删除30天前的备份 / Delete backups older than 30 days
find $BACKUP_DIR -name "blockchain_data_*.tar.gz" -mtime +30 -delete

# 上传到云存储 / Upload to cloud storage
aws s3 cp $BACKUP_DIR/blockchain_data_$DATE.tar.gz s3://titanchain-backups/blockchain/

echo "Blockchain backup completed: blockchain_data_$DATE.tar.gz"
```

## 8. 故障排除

### 8.1 常见问题

**服务启动失败**
```bash
# 检查端口占用 / Check port usage
netstat -tulpn | grep :8080

# 检查服务状态 / Check service status
docker-compose ps
docker-compose logs api

# 检查系统资源 / Check system resources
htop
df -h
free -h
```

**数据库连接问题**
```bash
# 检查数据库状态 / Check database status
docker-compose exec postgres pg_isready

# 检查连接数 / Check connection count
docker-compose exec postgres psql -U titanchain -d titanchain -c "SELECT count(*) FROM pg_stat_activity;"

# 检查慢查询 / Check slow queries
docker-compose exec postgres psql -U titanchain -d titanchain -c "SELECT query, query_start, state FROM pg_stat_activity WHERE state != 'idle';"
```

**性能问题诊断**
```bash
# 检查系统负载 / Check system load
uptime
iostat -x 1

# 检查内存使用 / Check memory usage
free -h
cat /proc/meminfo

# 检查磁盘IO / Check disk IO
iotop -o

# 检查网络连接 / Check network connections
ss -tuln
```

### 8.2 应急处理

**服务重启**
```bash
# 重启单个服务 / Restart single service
docker-compose restart api

# 重启所有服务 / Restart all services
docker-compose restart

# 强制重建服务 / Force rebuild service
docker-compose up -d --force-recreate api
```

**数据恢复**
```bash
# 从备份恢复数据库 / Restore database from backup
gunzip -c /backup/postgresql/titanchain_20241231_120000.sql.gz | psql -h localhost -U titanchain -d titanchain

# 恢复区块链数据 / Restore blockchain data
tar -xzf /backup/blockchain/blockchain_data_20241231_120000.tar.gz -C /app/blockchain/data/
```

**紧急维护模式**
```bash
# 启用维护模式 / Enable maintenance mode
docker-compose exec nginx nginx -s reload -c /etc/nginx/maintenance.conf

# 禁用维护模式 / Disable maintenance mode
docker-compose exec nginx nginx -s reload -c /etc/nginx/nginx.conf
```

## 9. 安全配置

### 9.1 网络安全

**防火墙配置**
```bash
# 安装ufw / Install ufw
sudo apt install ufw

# 默认策略 / Default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 允许SSH / Allow SSH
sudo ufw allow ssh

# 允许HTTP/HTTPS / Allow HTTP/HTTPS
sudo ufw allow 80
sudo ufw allow 443

# 允许API端口 / Allow API ports
sudo ufw allow 8080
sudo ufw allow 8545

# 启用防火墙 / Enable firewall
sudo ufw enable
```

**SSL/TLS配置**
```nginx
# SSL配置最佳实践 / SSL configuration best practices
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-CHACHA20-POLY1305;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
ssl_stapling on;
ssl_stapling_verify on;

# HSTS配置 / HSTS configuration
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
```

### 9.2 应用安全

**环境变量安全**
```bash
# 使用Docker secrets管理敏感信息 / Use Docker secrets for sensitive information
echo "your-jwt-secret" | docker secret create jwt_secret -
echo "your-db-password" | docker secret create db_password -
```

**API安全配置**
```typescript
// API安全中间件 / API security middleware
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

// 安全头 / Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// 限流配置 / Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟 / 15 minutes
  max: 1000, // 限制每个IP 1000次请求 / Limit each IP to 1000 requests
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);
```

## 10. 升级和维护

### 10.1 版本升级

**滚动升级流程**
```bash
# 1. 备份数据 / Backup data
./scripts/backup.sh

# 2. 拉取新版本 / Pull new version
git pull origin main

# 3. 构建新镜像 / Build new image
docker-compose build

# 4. 逐个升级服务 / Upgrade services one by one
docker-compose up -d --no-deps api
sleep 30
docker-compose up -d --no-deps frontend
sleep 30
docker-compose up -d --no-deps blockchain

# 5. 验证服务状态 / Verify service status
docker-compose ps
curl -f http://localhost:8080/health
```

**数据库迁移**
```bash
# 运行数据库迁移 / Run database migration
npm run db:migrate

# 验证迁移结果 / Verify migration result
npm run db:status
```

### 10.2 定期维护

**每日维护任务**
```bash
#!/bin/bash
# daily-maintenance.sh - 每日维护脚本 / Daily maintenance script

# 清理日志 / Clean logs
find /app/logs -name "*.log" -mtime +7 -delete

# 数据库维护 / Database maintenance
docker-compose exec postgres psql -U titanchain -d titanchain -c "VACUUM ANALYZE;"

# 清理Docker镜像 / Clean Docker images
docker image prune -f

# 检查磁盘空间 / Check disk space
df -h | awk '$5 > 80 {print "Warning: " $0}'

echo "Daily maintenance completed at $(date)"
```

**每周维护任务**
```bash
#!/bin/bash
# weekly-maintenance.sh - 每周维护脚本 / Weekly maintenance script

# 重建数据库索引 / Rebuild database indexes
docker-compose exec postgres psql -U titanchain -d titanchain -c "REINDEX DATABASE titanchain;"

# 清理Redis内存 / Clean Redis memory
docker-compose exec redis redis-cli FLUSHDB

# 更新系统包 / Update system packages
sudo apt update && sudo apt upgrade -y

# 重启服务 / Restart services
docker-compose restart

echo "Weekly maintenance completed at $(date)"
```

这份部署文档涵盖了TitanChain项目从开发环境到生产环境的完整部署流程，包括性能调优、监控运维、安全配置等关键环节，确保系统能够稳定、高效、安全地运行。