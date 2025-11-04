# TitanChain P2P区块同步部署指南 / TitanChain P2P Block Synchronization Deployment Guide

## 概述 / Overview

TitanChain现已支持P2P区块同步功能，可以在多台服务器上部署主链和验证节点，实现真正的去中心化区块链网络。

TitanChain now supports P2P block synchronization, enabling deployment of main chain and validator nodes across multiple servers for a truly decentralized blockchain network.

## 核心功能 / Core Features

✅ **区块同步协议** / Block Synchronization Protocol
- 批量区块同步 / Batch block synchronization
- 区块验证和冲突解决 / Block validation and conflict resolution
- 最长链规则 / Longest chain rule
- 分叉检测和处理 / Fork detection and handling

✅ **增强P2P网络层** / Enhanced P2P Network Layer
- 区块广播和同步 / Block broadcasting and synchronization
- 节点发现和连接管理 / Node discovery and connection management
- 网络分区处理和重连 / Network partition handling and reconnection
- 智能路由和负载均衡 / Smart routing and load balancing

✅ **区块链状态管理** / Blockchain State Management
- 统一的状态管理 / Unified state management
- 状态同步 / State synchronization
- 创世区块检查 / Genesis block verification
- 链重组和分叉处理 / Chain reorganization and fork handling

✅ **优化的节点启动流程** / Optimized Node Startup Process
- 自动检测现有网络 / Automatic existing network detection
- 从现有网络同步或创建创世区块 / Sync from existing network or create genesis block
- 优雅的节点加入流程 / Graceful node joining process

## 部署架构 / Deployment Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Server 1      │    │   Server 2      │    │   Server 3      │
│  (Bootstrap)    │    │  (Validator)    │    │  (Validator)    │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ TitanChain Node │◄──►│ TitanChain Node │◄──►│ TitanChain Node │
│ Port: 4003      │    │ Port: 4003      │    │ Port: 4003      │
│ API: 3001       │    │ API: 3002       │    │ API: 3003       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 部署步骤 / Deployment Steps

### 1. 环境准备 / Environment Setup

在每台服务器上安装必要的依赖：
Install required dependencies on each server:

```bash
# 安装 Node.js 18+ / Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装 PostgreSQL / Install PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib

# 克隆项目 / Clone project
git clone <your-titanchain-repo>
cd TitanChain
npm install
```

### 2. 数据库配置 / Database Configuration

在每台服务器上配置PostgreSQL：
Configure PostgreSQL on each server:

```bash
# 创建数据库用户和数据库 / Create database user and database
sudo -u postgres createuser titanchain
sudo -u postgres createdb titanchain_db
sudo -u postgres psql -c "ALTER USER titanchain WITH PASSWORD 'your_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE titanchain_db TO titanchain;"

# 初始化数据库 / Initialize database
psql -U titanchain -d titanchain_db -f database/init.sql
```

### 3. 环境变量配置 / Environment Variables Configuration

为每台服务器创建 `.env` 文件：
Create `.env` file for each server:

#### 服务器1 (Bootstrap节点) / Server 1 (Bootstrap Node)
```env
# 数据库配置 / Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=titanchain_db
DB_USER=titanchain
DB_PASSWORD=your_password

# 网络配置 / Network Configuration
P2P_PORT=4003
API_PORT=3001
HOST=0.0.0.0

# 节点配置 / Node Configuration
NODE_TYPE=bootstrap
ENABLE_BLOCK_PRODUCTION=true
ENABLE_P2P_SYNC=true

# P2P配置 / P2P Configuration
MAX_PEERS=50
ENABLE_PEER_DISCOVERY=true
ENABLE_AUTO_SYNC=true
SYNC_INTERVAL=5000

# 验证节点配置 / Validator Configuration
VALIDATOR_ADDRESS=0x1234567890123456789012345678901234567890
VALIDATOR_PRIVATE_KEY=your_private_key_1
```

#### 服务器2 (验证节点) / Server 2 (Validator Node)
```env
# 数据库配置 / Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=titanchain_db
DB_USER=titanchain
DB_PASSWORD=your_password

# 网络配置 / Network Configuration
P2P_PORT=4003
API_PORT=3002
HOST=0.0.0.0

# 节点配置 / Node Configuration
NODE_TYPE=validator
ENABLE_BLOCK_PRODUCTION=true
ENABLE_P2P_SYNC=true

# P2P配置 / P2P Configuration
MAX_PEERS=50
ENABLE_PEER_DISCOVERY=true
ENABLE_AUTO_SYNC=true
SYNC_INTERVAL=5000
BOOTSTRAP_NODES=http://server1_ip:4003

# 验证节点配置 / Validator Configuration
VALIDATOR_ADDRESS=0x2345678901234567890123456789012345678901
VALIDATOR_PRIVATE_KEY=your_private_key_2
```

#### 服务器3 (验证节点) / Server 3 (Validator Node)
```env
# 数据库配置 / Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=titanchain_db
DB_USER=titanchain
DB_PASSWORD=your_password

# 网络配置 / Network Configuration
P2P_PORT=4003
API_PORT=3003
HOST=0.0.0.0

# 节点配置 / Node Configuration
NODE_TYPE=validator
ENABLE_BLOCK_PRODUCTION=true
ENABLE_P2P_SYNC=true

# P2P配置 / P2P Configuration
MAX_PEERS=50
ENABLE_PEER_DISCOVERY=true
ENABLE_AUTO_SYNC=true
SYNC_INTERVAL=5000
BOOTSTRAP_NODES=http://server1_ip:4003,http://server2_ip:4003

# 验证节点配置 / Validator Configuration
VALIDATOR_ADDRESS=0x3456789012345678901234567890123456789012
VALIDATOR_PRIVATE_KEY=your_private_key_3
```

### 4. 防火墙配置 / Firewall Configuration

在每台服务器上开放必要的端口：
Open necessary ports on each server:

```bash
# 开放P2P端口 / Open P2P port
sudo ufw allow 4003

# 开放API端口 / Open API port
sudo ufw allow 3001  # 根据服务器调整端口 / Adjust port per server
sudo ufw allow 3002
sudo ufw allow 3003

# 启用防火墙 / Enable firewall
sudo ufw enable
```

### 5. 启动节点 / Start Nodes

#### 方法1：使用增强节点启动器 / Method 1: Using Enhanced Node Starter
```bash
# 启动增强TitanChain节点 / Start enhanced TitanChain node
npx tsx blockchain/start-node-enhanced.ts
```

#### 方法2：使用集成启动器 / Method 2: Using Integrated Starter
```bash
# 同时启动区块链节点和API服务器 / Start both blockchain node and API server
npx tsx start-integrated.ts
```

#### 方法3：使用PM2进程管理 / Method 3: Using PM2 Process Management
```bash
# 安装PM2 / Install PM2
npm install -g pm2

# 启动节点 / Start node
pm2 start blockchain/start-node-enhanced.ts --name titanchain-node

# 查看日志 / View logs
pm2 logs titanchain-node

# 设置开机自启 / Set auto-start on boot
pm2 startup
pm2 save
```

### 6. 验证部署 / Verify Deployment

#### 检查节点状态 / Check Node Status
```bash
# 检查P2P连接 / Check P2P connections
curl http://localhost:3001/api/network/peers

# 检查区块链状态 / Check blockchain status
curl http://localhost:3001/api/blockchain/status

# 检查同步状态 / Check sync status
curl http://localhost:3001/api/sync/status
```

#### 验证区块同步 / Verify Block Synchronization
```bash
# 运行同步验证脚本 / Run sync verification script
npx tsx verify-p2p-sync.ts

# 运行多节点测试 / Run multi-node test
npx tsx test-multi-node-sync.ts --nodes 3 --port 6000
```

## 监控和维护 / Monitoring and Maintenance

### 1. 日志监控 / Log Monitoring
```bash
# 查看节点日志 / View node logs
pm2 logs titanchain-node

# 查看系统资源使用 / View system resource usage
pm2 monit
```

### 2. 性能监控 / Performance Monitoring
```bash
# 检查网络统计 / Check network statistics
curl http://localhost:3001/api/network/stats

# 检查验证节点状态 / Check validator status
curl http://localhost:3001/api/validators/stats
```

### 3. 故障排除 / Troubleshooting

#### 常见问题 / Common Issues

**节点无法连接** / Node Cannot Connect
- 检查防火墙设置 / Check firewall settings
- 验证网络配置 / Verify network configuration
- 确认引导节点地址正确 / Confirm bootstrap node address is correct

**同步失败** / Sync Failure
- 检查数据库连接 / Check database connection
- 验证区块链数据完整性 / Verify blockchain data integrity
- 重启节点服务 / Restart node service

**性能问题** / Performance Issues
- 检查系统资源使用 / Check system resource usage
- 优化数据库配置 / Optimize database configuration
- 调整P2P连接数 / Adjust P2P connection count

## 安全建议 / Security Recommendations

1. **私钥管理** / Private Key Management
   - 使用硬件安全模块(HSM) / Use Hardware Security Module (HSM)
   - 定期轮换私钥 / Regularly rotate private keys
   - 实施多重签名 / Implement multi-signature

2. **网络安全** / Network Security
   - 使用VPN连接节点 / Use VPN to connect nodes
   - 实施DDoS防护 / Implement DDoS protection
   - 定期更新系统补丁 / Regularly update system patches

3. **访问控制** / Access Control
   - 限制API访问 / Restrict API access
   - 使用强密码策略 / Use strong password policy
   - 启用双因素认证 / Enable two-factor authentication

## 扩展和升级 / Scaling and Upgrades

### 添加新节点 / Adding New Nodes
1. 按照部署步骤配置新服务器 / Configure new server following deployment steps
2. 设置引导节点为现有节点 / Set bootstrap nodes to existing nodes
3. 启动节点并等待同步完成 / Start node and wait for sync completion

### 升级现有节点 / Upgrading Existing Nodes
1. 停止节点服务 / Stop node service
2. 备份区块链数据 / Backup blockchain data
3. 更新代码并重启服务 / Update code and restart service

## 支持和联系 / Support and Contact

如有问题或需要技术支持，请联系：
For questions or technical support, please contact:

- 技术文档 / Technical Documentation: [链接]
- 社区论坛 / Community Forum: [链接]
- 技术支持 / Technical Support: [邮箱]

---

**注意** / **Note**: 本指南基于TitanChain的P2P区块同步功能实现。在生产环境部署前，请充分测试所有功能。

This guide is based on TitanChain's P2P block synchronization implementation. Please thoroughly test all features before production deployment.