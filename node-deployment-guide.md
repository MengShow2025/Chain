# TitanChain 多节点部署指南 / Multi-Node Deployment Guide

## 概述 / Overview

本指南详细介绍如何在多台服务器上部署TitanChain节点，确保P2P区块同步功能正常工作。

This guide provides detailed instructions for deploying TitanChain nodes across multiple servers with proper P2P block synchronization.

## 核心问题解决方案 / Core Problem Solutions

### 问题 / Problems
- 每个节点启动时都创建自己的创世区块 / Each node creates its own genesis block
- 节点间不会同步已有的区块链数据 / Nodes don't sync existing blockchain data
- 缺少区块链网络一致性机制 / Missing blockchain network consistency mechanism

### 解决方案 / Solutions
- 智能节点启动器 / Smart Node Launcher
- 网络发现服务 / Network Discovery Service
- 自动化部署脚本 / Automated Deployment Scripts
- 实时同步测试 / Real-time Sync Testing

## 系统要求 / System Requirements

### 硬件要求 / Hardware Requirements
- **CPU**: 最少2核，推荐4核+ / Minimum 2 cores, recommended 4+ cores
- **内存**: 最少4GB，推荐8GB+ / Minimum 4GB RAM, recommended 8GB+
- **存储**: 最少50GB SSD / Minimum 50GB SSD storage
- **网络**: 稳定的互联网连接，最少10Mbps / Stable internet, minimum 10Mbps

### 软件要求 / Software Requirements
- **操作系统**: Ubuntu 20.04+, CentOS 8+, macOS 12+ / Operating System
- **Node.js**: v18.0+ / Node.js version
- **npm/yarn**: 最新版本 / Latest version
- **Git**: 用于代码部署 / For code deployment

## 网络配置 / Network Configuration

### 端口配置 / Port Configuration
```bash
# 默认端口配置 / Default port configuration
P2P_PORT=6000          # P2P通信端口 / P2P communication port
API_PORT=3000          # API服务端口 / API service port
WEBSOCKET_PORT=8080    # WebSocket端口 / WebSocket port
DISCOVERY_PORT=7000    # 网络发现端口 / Network discovery port
```

### 防火墙设置 / Firewall Settings
```bash
# Ubuntu/Debian
sudo ufw allow 6000/tcp    # P2P端口 / P2P port
sudo ufw allow 3000/tcp    # API端口 / API port
sudo ufw allow 8080/tcp    # WebSocket端口 / WebSocket port
sudo ufw allow 7000/tcp    # 发现端口 / Discovery port

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=6000/tcp
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --permanent --add-port=7000/tcp
sudo firewall-cmd --reload
```

## 部署步骤 / Deployment Steps

### 1. 环境准备 / Environment Preparation

#### 在每台服务器上 / On each server:
```bash
# 安装Node.js / Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 克隆项目 / Clone project
git clone <your-titanchain-repo>
cd TitanChain

# 安装依赖 / Install dependencies
npm install

# 创建数据目录 / Create data directory
mkdir -p data/node-{1..4}
```

#### 环境变量配置 / Environment Variables
```bash
# 创建.env文件 / Create .env file
cat > .env << EOF
# 网络配置 / Network Configuration
NETWORK_ID=titanchain-mainnet
CHAIN_ID=1001

# 节点配置 / Node Configuration
NODE_ENV=production
LOG_LEVEL=info

# P2P配置 / P2P Configuration
P2P_ENABLED=true
P2P_PORT=6000
MAX_PEERS=50

# API配置 / API Configuration
API_ENABLED=true
API_PORT=3000
API_HOST=0.0.0.0

# 数据库配置 / Database Configuration
DB_TYPE=sqlite
DB_PATH=./data/blockchain.db

# 挖矿配置 / Mining Configuration
MINING_ENABLED=true
MINING_REWARD=50
BLOCK_TIME=10000

# 安全配置 / Security Configuration
CORS_ENABLED=true
RATE_LIMIT_ENABLED=true
EOF
```

### 2. 引导节点部署 / Bootstrap Node Deployment

#### 第一台服务器（引导节点）/ First Server (Bootstrap Node):
```bash
# 使用智能启动器启动第一个节点 / Start first node with smart launcher
npx tsx smart-node-launcher.ts \
  --mode=bootstrap \
  --port=6000 \
  --api-port=3000 \
  --data-dir=./data/node-1 \
  --network-id=titanchain-mainnet

# 或使用部署脚本 / Or use deployment script
./deploy-multi-node.sh start bootstrap 192.168.1.100:6000
```

#### 验证引导节点 / Verify Bootstrap Node:
```bash
# 检查节点状态 / Check node status
curl http://localhost:3000/api/status

# 检查区块链状态 / Check blockchain status
curl http://localhost:3000/api/blockchain/status

# 检查P2P连接 / Check P2P connections
curl http://localhost:3000/api/p2p/peers
```

### 3. 后续节点部署 / Subsequent Node Deployment

#### 第二台及后续服务器 / Second and subsequent servers:
```bash
# 配置引导节点地址 / Configure bootstrap node address
export BOOTSTRAP_NODES="192.168.1.100:6000"

# 启动后续节点 / Start subsequent node
npx tsx smart-node-launcher.ts \
  --mode=join \
  --port=6001 \
  --api-port=3001 \
  --data-dir=./data/node-2 \
  --bootstrap-nodes=$BOOTSTRAP_NODES \
  --network-id=titanchain-mainnet

# 或使用部署脚本 / Or use deployment script
./deploy-multi-node.sh start node 192.168.1.101:6001 192.168.1.100:6000
```

### 4. 批量部署 / Batch Deployment

#### 使用部署脚本批量部署 / Batch deployment with script:
```bash
# 配置服务器列表 / Configure server list
cat > servers.conf << EOF
192.168.1.100:6000:bootstrap
192.168.1.101:6001:node
192.168.1.102:6002:node
192.168.1.103:6003:node
EOF

# 批量部署 / Batch deploy
./deploy-multi-node.sh deploy-all servers.conf
```

## 监控和维护 / Monitoring and Maintenance

### 1. 节点状态监控 / Node Status Monitoring

#### 健康检查脚本 / Health Check Script:
```bash
#!/bin/bash
# health-check.sh

NODES=(
  "192.168.1.100:3000"
  "192.168.1.101:3001"
  "192.168.1.102:3002"
  "192.168.1.103:3003"
)

for node in "${NODES[@]}"; do
  echo "Checking node: $node"
  
  # 检查API响应 / Check API response
  if curl -s "http://$node/api/status" > /dev/null; then
    echo "✅ Node $node is healthy"
  else
    echo "❌ Node $node is not responding"
  fi
  
  # 检查区块高度 / Check block height
  height=$(curl -s "http://$node/api/blockchain/height" | jq -r '.height')
  echo "📊 Block height: $height"
  
  # 检查P2P连接 / Check P2P connections
  peers=$(curl -s "http://$node/api/p2p/peers" | jq -r '.count')
  echo "🔗 Connected peers: $peers"
  
  echo "---"
done
```

### 2. 同步状态检查 / Sync Status Check

#### 同步验证脚本 / Sync Verification Script:
```bash
#!/bin/bash
# sync-check.sh

echo "🔍 Checking blockchain synchronization..."

# 获取所有节点的区块高度 / Get block heights from all nodes
heights=()
for node in "${NODES[@]}"; do
  height=$(curl -s "http://$node/api/blockchain/height" | jq -r '.height')
  heights+=($height)
  echo "Node $node: Block height $height"
done

# 检查高度一致性 / Check height consistency
max_height=$(printf '%s\n' "${heights[@]}" | sort -n | tail -1)
min_height=$(printf '%s\n' "${heights[@]}" | sort -n | head -1)
diff=$((max_height - min_height))

if [ $diff -le 1 ]; then
  echo "✅ All nodes are synchronized (height difference: $diff)"
else
  echo "⚠️  Nodes are not synchronized (height difference: $diff)"
fi
```

### 3. 日志监控 / Log Monitoring

#### 日志聚合 / Log Aggregation:
```bash
# 查看所有节点日志 / View all node logs
./deploy-multi-node.sh logs all

# 查看特定节点日志 / View specific node logs
./deploy-multi-node.sh logs 192.168.1.100:6000

# 实时监控日志 / Real-time log monitoring
tail -f data/node-*/logs/titanchain.log
```

## 性能优化 / Performance Optimization

### 1. 网络优化 / Network Optimization

#### TCP优化 / TCP Optimization:
```bash
# 在/etc/sysctl.conf中添加 / Add to /etc/sysctl.conf
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.ipv4.tcp_rmem = 4096 87380 16777216
net.ipv4.tcp_wmem = 4096 65536 16777216
net.core.netdev_max_backlog = 5000

# 应用设置 / Apply settings
sudo sysctl -p
```

### 2. 数据库优化 / Database Optimization

#### SQLite优化 / SQLite Optimization:
```javascript
// 在数据库配置中 / In database configuration
const dbConfig = {
  pragma: {
    journal_mode: 'WAL',
    synchronous: 'NORMAL',
    cache_size: -64000,
    temp_store: 'MEMORY',
    mmap_size: 268435456
  }
};
```

### 3. 内存优化 / Memory Optimization

#### Node.js内存设置 / Node.js Memory Settings:
```bash
# 增加Node.js内存限制 / Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# 启动节点 / Start node
npx tsx smart-node-launcher.ts --mode=join ...
```

## 故障排除 / Troubleshooting

### 常见问题 / Common Issues

#### 1. 节点无法连接 / Node Connection Issues
```bash
# 检查网络连接 / Check network connectivity
telnet 192.168.1.100 6000

# 检查防火墙 / Check firewall
sudo ufw status
sudo iptables -L

# 检查端口占用 / Check port usage
netstat -tulpn | grep :6000
```

#### 2. 同步失败 / Sync Failure
```bash
# 重启节点 / Restart node
./deploy-multi-node.sh restart 192.168.1.101:6001

# 清除数据重新同步 / Clear data and resync
./deploy-multi-node.sh clean 192.168.1.101:6001
./deploy-multi-node.sh start node 192.168.1.101:6001 192.168.1.100:6000
```

#### 3. 性能问题 / Performance Issues
```bash
# 检查系统资源 / Check system resources
htop
iotop
nethogs

# 检查数据库大小 / Check database size
du -sh data/node-*/blockchain.db

# 优化数据库 / Optimize database
sqlite3 data/node-1/blockchain.db "VACUUM;"
```

### 错误代码 / Error Codes

| 错误代码 | 描述 | 解决方案 |
|---------|------|---------|
| SYNC_001 | 网络发现失败 | 检查网络连接和防火墙 |
| SYNC_002 | 创世区块不匹配 | 清除数据重新同步 |
| SYNC_003 | P2P连接超时 | 检查网络延迟和带宽 |
| SYNC_004 | 区块验证失败 | 检查区块链数据完整性 |

## 安全考虑 / Security Considerations

### 1. 网络安全 / Network Security
- 使用VPN或私有网络连接节点 / Use VPN or private network
- 配置SSL/TLS加密 / Configure SSL/TLS encryption
- 限制API访问权限 / Restrict API access permissions

### 2. 数据安全 / Data Security
- 定期备份区块链数据 / Regular blockchain data backup
- 使用加密存储 / Use encrypted storage
- 实施访问控制 / Implement access control

### 3. 运维安全 / Operational Security
- 定期更新系统和依赖 / Regular system and dependency updates
- 监控异常活动 / Monitor abnormal activities
- 实施日志审计 / Implement log auditing

## 测试验证 / Testing and Validation

### 1. 功能测试 / Functional Testing
```bash
# 运行完整测试套件 / Run complete test suite
npx tsx test-real-sync.ts --nodes=4 --duration=300

# 运行快速测试 / Run quick test
npx tsx test-p2p-quick.ts
```

### 2. 压力测试 / Stress Testing
```bash
# 高负载测试 / High load testing
npx tsx test-multi-node-p2p-sync.ts --nodes=10 --duration=3600

# 网络分区测试 / Network partition testing
npx tsx test-real-sync.ts --enable-partition-test
```

### 3. 持续监控 / Continuous Monitoring
```bash
# 设置监控脚本 / Setup monitoring script
crontab -e
# 添加: */5 * * * * /path/to/health-check.sh
```

## 升级和维护 / Upgrades and Maintenance

### 1. 滚动升级 / Rolling Upgrade
```bash
# 逐个升级节点 / Upgrade nodes one by one
for node in "${NODES[@]}"; do
  ./deploy-multi-node.sh stop $node
  # 更新代码 / Update code
  git pull origin main
  npm install
  ./deploy-multi-node.sh start $node
  sleep 30  # 等待节点稳定 / Wait for node stability
done
```

### 2. 数据备份 / Data Backup
```bash
# 创建备份脚本 / Create backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
tar -czf "backup_${DATE}.tar.gz" data/
aws s3 cp "backup_${DATE}.tar.gz" s3://titanchain-backups/
```

## 支持和联系 / Support and Contact

如有问题，请联系技术支持团队或查看项目文档。

For issues, please contact the technical support team or refer to the project documentation.

---

**版本**: 1.0.0  
**最后更新**: 2024年12月  
**维护者**: TitanChain开发团队