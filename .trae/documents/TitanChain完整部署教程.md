# TitanChain 完整部署教程

## 目录
1. [区块链部署教程](#1-区块链部署教程)
2. [节点安装教程](#2-节点安装教程)
3. [合约部署教程](#3-合约部署教程)

---

## 1. 区块链部署教程

### 1.1 环境准备和依赖安装

#### 系统要求
- **操作系统**: Ubuntu 20.04+ / CentOS 8+ / macOS 12+
- **内存**: 最低 8GB RAM，推荐 16GB+
- **存储**: 最低 100GB SSD，推荐 500GB+
- **网络**: 稳定的互联网连接，带宽 100Mbps+
- **CPU**: 4核心以上，推荐 8核心+

#### 安装Node.js和包管理器

```bash
# 安装Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证安装
node --version  # 应该显示 v18.x.x 或更高版本
npm --version

# 安装pnpm（推荐）
npm install -g pnpm

# 或者安装yarn
npm install -g yarn
```

#### 安装系统依赖

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y build-essential python3 git curl wget

# CentOS/RHEL
sudo yum groupinstall -y "Development Tools"
sudo yum install -y python3 git curl wget

# macOS
xcode-select --install
brew install git curl wget
```

### 1.2 克隆和配置TitanChain

#### 克隆项目

```bash
# 克隆TitanChain仓库
git clone https://github.com/your-org/TitanChain.git
cd TitanChain

# 安装依赖
pnpm install
# 或者使用npm
npm install
```

#### 环境配置

创建环境配置文件：

```bash
# 复制环境配置模板
cp .env.example .env

# 编辑配置文件
nano .env
```

`.env` 配置示例：

```env
# 网络配置
NETWORK_ID=1001
CHAIN_ID=1001
NETWORK_NAME=TitanChain

# 节点配置
NODE_ENV=production
PORT=8545
WS_PORT=8546
API_PORT=3000

# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=titanchain
DB_USER=titanchain
DB_PASSWORD=your_secure_password

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# 共识配置
BLOCK_TIME=3
ELECTION_INTERVAL=300
MIN_VALIDATORS=4
MAX_VALIDATORS=21

# 性能配置
MAX_TPS=10000
MAX_GAS_LIMIT=30000000
MAX_TRANSACTIONS_PER_BLOCK=5000

# 安全配置
JWT_SECRET=your_jwt_secret_key
ENCRYPTION_KEY=your_encryption_key
```

### 1.3 创世区块配置

创建创世区块配置文件 `genesis.json`：

```json
{
  "config": {
    "chainId": 1001,
    "homesteadBlock": 0,
    "eip150Block": 0,
    "eip155Block": 0,
    "eip158Block": 0,
    "byzantiumBlock": 0,
    "constantinopleBlock": 0,
    "petersburgBlock": 0,
    "istanbulBlock": 0,
    "berlinBlock": 0,
    "londonBlock": 0,
    "pos": {
      "period": 3,
      "epoch": 30000
    }
  },
  "difficulty": "0x1",
  "gasLimit": "0x1c9c380",
  "alloc": {
    "0x742d35Cc6634C0532925a3b8D4C9db96c4b4df93": {
      "balance": "1000000000000000000000000"
    }
  },
  "validators": [
    {
      "address": "0x742d35Cc6634C0532925a3b8D4C9db96c4b4df93",
      "stake": "1000000000000000000000",
      "publicKey": "0x04...",
      "name": "Genesis Validator 1"
    }
  ]
}
```

### 1.4 数据库初始化

#### 安装PostgreSQL

```bash
# Ubuntu/Debian
sudo apt-get install -y postgresql postgresql-contrib

# CentOS/RHEL
sudo yum install -y postgresql-server postgresql-contrib
sudo postgresql-setup initdb

# 启动PostgreSQL服务
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### 创建数据库和用户

```bash
# 切换到postgres用户
sudo -u postgres psql

# 在PostgreSQL命令行中执行
CREATE DATABASE titanchain;
CREATE USER titanchain WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE titanchain TO titanchain;
\q
```

#### 初始化数据库表

```bash
# 运行数据库迁移脚本
npm run db:migrate

# 或者手动执行SQL脚本
psql -h localhost -U titanchain -d titanchain -f scripts/init-db.sql
```

### 1.5 Redis安装和配置

```bash
# Ubuntu/Debian
sudo apt-get install -y redis-server

# CentOS/RHEL
sudo yum install -y redis

# 配置Redis
sudo nano /etc/redis/redis.conf

# 修改以下配置
bind 127.0.0.1
port 6379
requirepass your_redis_password
maxmemory 2gb
maxmemory-policy allkeys-lru

# 启动Redis服务
sudo systemctl start redis
sudo systemctl enable redis
```

### 1.6 区块链网络启动

#### 编译项目

```bash
# 编译TypeScript代码
npm run build

# 检查编译结果
npm run check
```

#### 启动区块链节点

```bash
# 启动完整节点（包含前端和后端）
npm run dev

# 或者分别启动
npm run server:dev  # 启动区块链后端
npm run client:dev  # 启动前端界面
```

#### 验证启动状态

```bash
# 检查节点状态
curl http://localhost:3000/api/status

# 检查区块链信息
curl http://localhost:3000/api/blockchain/info

# 检查验证者列表
curl http://localhost:3000/api/validators
```

### 1.7 网络监控和维护

#### 监控脚本

创建监控脚本 `scripts/monitor.sh`：

```bash
#!/bin/bash

# 检查节点健康状态
check_node_health() {
    response=$(curl -s http://localhost:3000/api/health)
    if [[ $response == *"healthy"* ]]; then
        echo "✅ Node is healthy"
    else
        echo "❌ Node health check failed"
        return 1
    fi
}

# 检查区块生产
check_block_production() {
    latest_block=$(curl -s http://localhost:3000/api/blockchain/latest)
    echo "📦 Latest block: $latest_block"
}

# 检查验证者状态
check_validators() {
    validators=$(curl -s http://localhost:3000/api/validators/active)
    echo "👥 Active validators: $validators"
}

# 主监控循环
while true; do
    echo "🔍 Monitoring TitanChain node..."
    check_node_health
    check_block_production
    check_validators
    echo "---"
    sleep 30
done
```

#### 日志管理

```bash
# 查看实时日志
tail -f logs/titanchain.log

# 日志轮转配置
sudo nano /etc/logrotate.d/titanchain

# 添加以下内容
/path/to/TitanChain/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 titanchain titanchain
}
```

---

## 2. 节点安装教程

### 2.1 系统要求和硬件配置

#### 最低配置要求

| 组件 | 最低要求 | 推荐配置 |
|------|----------|----------|
| CPU | 4核心 2.0GHz | 8核心 3.0GHz+ |
| 内存 | 8GB RAM | 32GB RAM |
| 存储 | 100GB SSD | 1TB NVMe SSD |
| 网络 | 100Mbps | 1Gbps |
| 操作系统 | Ubuntu 20.04+ | Ubuntu 22.04 LTS |

#### 网络端口配置

```bash
# 开放必要端口
sudo ufw allow 8545  # JSON-RPC
sudo ufw allow 8546  # WebSocket
sudo ufw allow 30303 # P2P网络
sudo ufw allow 3000  # API服务
sudo ufw enable
```

### 2.2 节点软件安装

#### 快速安装脚本

创建安装脚本 `install-node.sh`：

```bash
#!/bin/bash

set -e

echo "🚀 Installing TitanChain Node..."

# 检查系统要求
check_requirements() {
    echo "📋 Checking system requirements..."
    
    # 检查内存
    total_mem=$(free -g | awk '/^Mem:/{print $2}')
    if [ $total_mem -lt 8 ]; then
        echo "❌ Insufficient memory. Required: 8GB, Available: ${total_mem}GB"
        exit 1
    fi
    
    # 检查磁盘空间
    available_space=$(df -BG / | awk 'NR==2{print $4}' | sed 's/G//')
    if [ $available_space -lt 100 ]; then
        echo "❌ Insufficient disk space. Required: 100GB, Available: ${available_space}GB"
        exit 1
    fi
    
    echo "✅ System requirements met"
}

# 安装依赖
install_dependencies() {
    echo "📦 Installing dependencies..."
    
    # 更新包管理器
    sudo apt-get update
    
    # 安装基础依赖
    sudo apt-get install -y \
        curl \
        wget \
        git \
        build-essential \
        python3 \
        python3-pip \
        software-properties-common \
        apt-transport-https \
        ca-certificates \
        gnupg \
        lsb-release
    
    # 安装Node.js
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
    
    # 安装pnpm
    npm install -g pnpm
    
    echo "✅ Dependencies installed"
}

# 创建用户和目录
setup_user() {
    echo "👤 Setting up titanchain user..."
    
    # 创建系统用户
    sudo useradd -r -m -s /bin/bash titanchain
    
    # 创建必要目录
    sudo mkdir -p /opt/titanchain
    sudo mkdir -p /var/log/titanchain
    sudo mkdir -p /var/lib/titanchain
    
    # 设置权限
    sudo chown -R titanchain:titanchain /opt/titanchain
    sudo chown -R titanchain:titanchain /var/log/titanchain
    sudo chown -R titanchain:titanchain /var/lib/titanchain
    
    echo "✅ User setup complete"
}

# 下载和安装TitanChain
install_titanchain() {
    echo "⬇️ Downloading TitanChain..."
    
    cd /opt/titanchain
    sudo -u titanchain git clone https://github.com/your-org/TitanChain.git .
    
    echo "📦 Installing TitanChain dependencies..."
    sudo -u titanchain pnpm install
    
    echo "🔨 Building TitanChain..."
    sudo -u titanchain npm run build
    
    echo "✅ TitanChain installed"
}

# 配置系统服务
setup_service() {
    echo "⚙️ Setting up systemd service..."
    
    sudo tee /etc/systemd/system/titanchain.service > /dev/null <<EOF
[Unit]
Description=TitanChain Node
After=network.target
Wants=network.target

[Service]
Type=simple
User=titanchain
Group=titanchain
WorkingDirectory=/opt/titanchain
ExecStart=/usr/bin/node api/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=titanchain
KillMode=mixed
KillSignal=SIGINT
TimeoutStopSec=30

Environment=NODE_ENV=production
Environment=LOG_LEVEL=info

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable titanchain
    
    echo "✅ Service configured"
}

# 主安装流程
main() {
    check_requirements
    install_dependencies
    setup_user
    install_titanchain
    setup_service
    
    echo "🎉 TitanChain node installation complete!"
    echo "📝 Next steps:"
    echo "   1. Configure /opt/titanchain/.env"
    echo "   2. Run: sudo systemctl start titanchain"
    echo "   3. Check status: sudo systemctl status titanchain"
}

main "$@"
```

运行安装脚本：

```bash
chmod +x install-node.sh
sudo ./install-node.sh
```

### 2.3 节点配置文件设置

#### 主配置文件

编辑 `/opt/titanchain/.env`：

```env
# 节点类型配置
NODE_TYPE=validator  # validator, full, light
NODE_NAME=TitanChain-Node-01

# 网络配置
NETWORK_ID=1001
CHAIN_ID=1001
BOOTNODES=enode://node1@ip1:30303,enode://node2@ip2:30303

# P2P网络配置
P2P_PORT=30303
P2P_MAX_PEERS=50
P2P_NAT=any

# RPC配置
RPC_ENABLED=true
RPC_HOST=0.0.0.0
RPC_PORT=8545
RPC_CORS_DOMAIN=*
RPC_VHOSTS=*

# WebSocket配置
WS_ENABLED=true
WS_HOST=0.0.0.0
WS_PORT=8546
WS_ORIGINS=*

# 验证者配置（仅验证者节点需要）
VALIDATOR_ENABLED=true
VALIDATOR_ADDRESS=0x742d35Cc6634C0532925a3b8D4C9db96c4b4df93
VALIDATOR_PRIVATE_KEY=your_validator_private_key
VALIDATOR_STAKE=1000000000000000000000

# 数据目录
DATA_DIR=/var/lib/titanchain
LOG_DIR=/var/log/titanchain

# 性能配置
CACHE_SIZE=1024
GC_MODE=archive
SYNC_MODE=fast
```

#### 网络配置文件

创建 `/opt/titanchain/config/network.json`：

```json
{
  "networkId": 1001,
  "chainId": 1001,
  "consensus": "pos",
  "blockTime": 3,
  "epochLength": 30000,
  "bootnodes": [
    "enode://node1-pubkey@node1-ip:30303",
    "enode://node2-pubkey@node2-ip:30303"
  ],
  "staticNodes": [
    "enode://trusted-node1@ip1:30303",
    "enode://trusted-node2@ip2:30303"
  ],
  "trustedNodes": [
    "enode://validator1@ip1:30303",
    "enode://validator2@ip2:30303"
  ]
}
```

### 2.4 节点同步和连接

#### 启动节点

```bash
# 启动TitanChain节点服务
sudo systemctl start titanchain

# 检查服务状态
sudo systemctl status titanchain

# 查看实时日志
sudo journalctl -u titanchain -f
```

#### 检查同步状态

```bash
# 检查节点连接状态
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"net_peerCount","params":[],"id":1}' \
  http://localhost:8545

# 检查同步进度
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_syncing","params":[],"id":1}' \
  http://localhost:8545

# 获取最新区块号
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  http://localhost:8545
```

#### 连接到网络

创建连接脚本 `scripts/connect-network.sh`：

```bash
#!/bin/bash

# 添加对等节点
add_peer() {
    local enode=$1
    curl -X POST -H "Content-Type: application/json" \
      --data "{\"jsonrpc\":\"2.0\",\"method\":\"admin_addPeer\",\"params\":[\"$enode\"],\"id\":1}" \
      http://localhost:8545
}

# 连接到引导节点
echo "🔗 Connecting to bootstrap nodes..."
add_peer "enode://node1-pubkey@node1-ip:30303"
add_peer "enode://node2-pubkey@node2-ip:30303"

# 检查连接状态
echo "📊 Checking peer connections..."
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"admin_peers","params":[],"id":1}' \
  http://localhost:8545
```

### 2.5 验证者节点设置

#### 生成验证者密钥

```bash
# 创建验证者密钥生成脚本
cat > scripts/generate-validator-keys.js << 'EOF'
const crypto = require('crypto');
const { ethers } = require('ethers');

// 生成新的验证者密钥对
function generateValidatorKeys() {
    const wallet = ethers.Wallet.createRandom();
    
    return {
        address: wallet.address,
        privateKey: wallet.privateKey,
        publicKey: wallet.publicKey,
        mnemonic: wallet.mnemonic.phrase
    };
}

// 生成密钥
const keys = generateValidatorKeys();

console.log('🔑 Validator Keys Generated:');
console.log('Address:', keys.address);
console.log('Private Key:', keys.privateKey);
console.log('Public Key:', keys.publicKey);
console.log('Mnemonic:', keys.mnemonic);

// 保存到文件
const fs = require('fs');
fs.writeFileSync('validator-keys.json', JSON.stringify(keys, null, 2));
console.log('✅ Keys saved to validator-keys.json');
EOF

# 运行密钥生成脚本
node scripts/generate-validator-keys.js
```

#### 注册验证者

```bash
# 创建验证者注册脚本
cat > scripts/register-validator.js << 'EOF'
const { ethers } = require('ethers');

async function registerValidator() {
    // 连接到TitanChain网络
    const provider = new ethers.JsonRpcProvider('http://localhost:8545');
    
    // 加载验证者密钥
    const keys = require('../validator-keys.json');
    const wallet = new ethers.Wallet(keys.privateKey, provider);
    
    // 验证者注册参数
    const validatorInfo = {
        address: keys.address,
        publicKey: keys.publicKey,
        stake: ethers.parseEther('1000'), // 1000 TTC
        commission: 500, // 5%
        name: 'My Validator Node',
        website: 'https://myvalidator.com',
        details: 'Professional validator node'
    };
    
    console.log('📝 Registering validator:', validatorInfo);
    
    // 这里需要调用验证者注册合约
    // 具体实现取决于合约接口
    
    console.log('✅ Validator registration submitted');
}

registerValidator().catch(console.error);
EOF

# 运行验证者注册
node scripts/register-validator.js
```

### 2.6 节点运维和故障排除

#### 常用运维命令

```bash
# 查看节点状态
sudo systemctl status titanchain

# 重启节点
sudo systemctl restart titanchain

# 停止节点
sudo systemctl stop titanchain

# 查看日志
sudo journalctl -u titanchain -n 100

# 查看实时日志
sudo journalctl -u titanchain -f

# 检查配置文件
sudo -u titanchain cat /opt/titanchain/.env
```

#### 性能监控脚本

创建 `scripts/monitor-performance.sh`：

```bash
#!/bin/bash

# 监控节点性能
monitor_performance() {
    echo "📊 TitanChain Node Performance Monitor"
    echo "======================================"
    
    # CPU使用率
    cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}')
    echo "🖥️  CPU Usage: ${cpu_usage}%"
    
    # 内存使用率
    mem_info=$(free | grep Mem)
    mem_total=$(echo $mem_info | awk '{print $2}')
    mem_used=$(echo $mem_info | awk '{print $3}')
    mem_usage=$((mem_used * 100 / mem_total))
    echo "💾 Memory Usage: ${mem_usage}%"
    
    # 磁盘使用率
    disk_usage=$(df -h /var/lib/titanchain | awk 'NR==2{print $5}')
    echo "💿 Disk Usage: ${disk_usage}"
    
    # 网络连接数
    peer_count=$(curl -s -X POST -H "Content-Type: application/json" \
      --data '{"jsonrpc":"2.0","method":"net_peerCount","params":[],"id":1}' \
      http://localhost:8545 | jq -r '.result')
    echo "🌐 Connected Peers: $((peer_count))"
    
    # 最新区块
    latest_block=$(curl -s -X POST -H "Content-Type: application/json" \
      --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
      http://localhost:8545 | jq -r '.result')
    echo "📦 Latest Block: $((latest_block))"
    
    echo "======================================"
}

# 每30秒监控一次
while true; do
    monitor_performance
    sleep 30
done
```

#### 故障排除指南

**常见问题及解决方案：**

1. **节点无法启动**
```bash
# 检查配置文件
sudo -u titanchain cat /opt/titanchain/.env

# 检查端口占用
sudo netstat -tlnp | grep :8545

# 检查权限
sudo ls -la /opt/titanchain
sudo ls -la /var/lib/titanchain
```

2. **同步缓慢或停止**
```bash
# 检查网络连接
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"net_peerCount","params":[],"id":1}' \
  http://localhost:8545

# 重新连接引导节点
bash scripts/connect-network.sh

# 清理数据重新同步（谨慎使用）
sudo systemctl stop titanchain
sudo rm -rf /var/lib/titanchain/chaindata
sudo systemctl start titanchain
```

3. **内存不足**
```bash
# 调整缓存大小
sudo nano /opt/titanchain/.env
# 修改 CACHE_SIZE=512

# 重启节点
sudo systemctl restart titanchain
```

---

## 3. 合约部署教程

### 3.1 开发环境搭建

#### 安装开发工具

```bash
# 安装Hardhat开发框架
npm install -g hardhat

# 创建合约开发目录
mkdir titanchain-contracts
cd titanchain-contracts

# 初始化Hardhat项目
npx hardhat init

# 安装必要依赖
npm install --save-dev \
  @nomiclabs/hardhat-ethers \
  @nomiclabs/hardhat-waffle \
  ethereum-waffle \
  chai \
  ethers \
  @openzeppelin/contracts \
  @openzeppelin/hardhat-upgrades
```

#### 配置Hardhat

编辑 `hardhat.config.js`：

```javascript
require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");
require("@openzeppelin/hardhat-upgrades");

const PRIVATE_KEY = process.env.PRIVATE_KEY || "your_private_key_here";
const TITANCHAIN_RPC_URL = process.env.TITANCHAIN_RPC_URL || "http://localhost:8545";

module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      chainId: 31337
    },
    titanchain: {
      url: TITANCHAIN_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: 1001,
      gasPrice: 20000000000, // 20 gwei
      gas: 8000000
    },
    titanchain_testnet: {
      url: "https://testnet-rpc.titanchain.io",
      accounts: [PRIVATE_KEY],
      chainId: 1002,
      gasPrice: 10000000000, // 10 gwei
      gas: 8000000
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};
```

#### 环境变量配置

创建 `.env` 文件：

```env
# 部署者私钥
PRIVATE_KEY=your_private_key_here

# 网络RPC地址
TITANCHAIN_RPC_URL=http://localhost:8545
TITANCHAIN_TESTNET_RPC_URL=https://testnet-rpc.titanchain.io

# 区块浏览器API密钥（用于合约验证）
ETHERSCAN_API_KEY=your_etherscan_api_key

# 其他配置
GAS_PRICE=20000000000
GAS_LIMIT=8000000
```

### 3.2 智能合约编写和编译

#### 示例ERC20代币合约

创建 `contracts/TitanToken.sol`：

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TitanToken
 * @dev TitanChain生态系统的原生代币
 */
contract TitanToken is ERC20, ERC20Burnable, Pausable, Ownable {
    uint256 public constant MAX_SUPPLY = 1000000000 * 10**18; // 10亿代币
    
    mapping(address => bool) public minters;
    
    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);
    
    modifier onlyMinter() {
        require(minters[msg.sender], "TitanToken: caller is not a minter");
        _;
    }
    
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) ERC20(name, symbol) {
        require(initialSupply <= MAX_SUPPLY, "TitanToken: initial supply exceeds max supply");
        _mint(msg.sender, initialSupply);
        minters[msg.sender] = true;
    }
    
    /**
     * @dev 铸造新代币
     */
    function mint(address to, uint256 amount) public onlyMinter whenNotPaused {
        require(totalSupply() + amount <= MAX_SUPPLY, "TitanToken: exceeds max supply");
        _mint(to, amount);
    }
    
    /**
     * @dev 批量铸造
     */
    function batchMint(address[] calldata recipients, uint256[] calldata amounts) 
        external onlyMinter whenNotPaused {
        require(recipients.length == amounts.length, "TitanToken: arrays length mismatch");
        
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }
        
        require(totalSupply() + totalAmount <= MAX_SUPPLY, "TitanToken: exceeds max supply");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            _mint(recipients[i], amounts[i]);
        }
    }
    
    /**
     * @dev 添加铸造者
     */
    function addMinter(address minter) external onlyOwner {
        require(!minters[minter], "TitanToken: already a minter");
        minters[minter] = true;
        emit MinterAdded(minter);
    }
    
    /**
     * @dev 移除铸造者
     */
    function removeMinter(address minter) external onlyOwner {
        require(minters[minter], "TitanToken: not a minter");
        minters[minter] = false;
        emit MinterRemoved(minter);
    }
    
    /**
     * @dev 暂停合约
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev 恢复合约
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev 重写转账函数以支持暂停功能
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override whenNotPaused {
        super._beforeTokenTransfer(from, to, amount);
    }
}
```

#### 质押合约示例

创建 `contracts/TitanStaking.sol`：

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title TitanStaking
 * @dev TitanChain质押合约
 */
contract TitanStaking is ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;
    
    IERC20 public immutable stakingToken;
    IERC20 public immutable rewardToken;
    
    uint256 public rewardRate = 100; // 每秒奖励率
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;
    mapping(address => uint256) public balances;
    
    uint256 private _totalSupply;
    
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event RewardRateUpdated(uint256 newRate);
    
    constructor(
        address _stakingToken,
        address _rewardToken,
        uint256 _rewardRate
    ) {
        stakingToken = IERC20(_stakingToken);
        rewardToken = IERC20(_rewardToken);
        rewardRate = _rewardRate;
        lastUpdateTime = block.timestamp;
    }
    
    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = block.timestamp;
        
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }
    
    /**
     * @dev 获取总质押量
     */
    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }
    
    /**
     * @dev 获取用户质押余额
     */
    function balanceOf(address account) external view returns (uint256) {
        return balances[account];
    }
    
    /**
     * @dev 计算每个代币的奖励
     */
    function rewardPerToken() public view returns (uint256) {
        if (_totalSupply == 0) {
            return rewardPerTokenStored;
        }
        
        return rewardPerTokenStored + 
            (((block.timestamp - lastUpdateTime) * rewardRate * 1e18) / _totalSupply);
    }
    
    /**
     * @dev 计算用户已赚取的奖励
     */
    function earned(address account) public view returns (uint256) {
        return (balances[account] * 
            (rewardPerToken() - userRewardPerTokenPaid[account])) / 1e18 + 
            rewards[account];
    }
    
    /**
     * @dev 质押代币
     */
    function stake(uint256 amount) 
        external 
        nonReentrant 
        whenNotPaused 
        updateReward(msg.sender) 
    {
        require(amount > 0, "TitanStaking: cannot stake 0");
        
        _totalSupply += amount;
        balances[msg.sender] += amount;
        
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }
    
    /**
     * @dev 提取质押代币
     */
    function withdraw(uint256 amount) 
        external 
        nonReentrant 
        updateReward(msg.sender) 
    {
        require(amount > 0, "TitanStaking: cannot withdraw 0");
        require(balances[msg.sender] >= amount, "TitanStaking: insufficient balance");
        
        _totalSupply -= amount;
        balances[msg.sender] -= amount;
        
        stakingToken.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }
    
    /**
     * @dev 领取奖励
     */
    function getReward() external nonReentrant updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            rewardToken.safeTransfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }
    
    /**
     * @dev 退出质押（提取所有代币并领取奖励）
     */
    function exit() external {
        withdraw(balances[msg.sender]);
        getReward();
    }
    
    /**
     * @dev 更新奖励率（仅所有者）
     */
    function setRewardRate(uint256 _rewardRate) 
        external 
        onlyOwner 
        updateReward(address(0)) 
    {
        rewardRate = _rewardRate;
        emit RewardRateUpdated(_rewardRate);
    }
    
    /**
     * @dev 暂停合约
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev 恢复合约
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev 紧急提取（仅所有者）
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
}
```

#### 编译合约

```bash
# 编译所有合约
npx hardhat compile

# 检查编译结果
ls artifacts/contracts/

# 清理并重新编译
npx hardhat clean
npx hardhat compile
```

### 3.3 合约部署流程

#### 部署脚本

创建 `scripts/deploy.js`：

```javascript
const { ethers, upgrades } = require("hardhat");

async function main() {
    console.log("🚀 Starting TitanChain contract deployment...");
    
    // 获取部署者账户
    const [deployer] = await ethers.getSigners();
    console.log("📝 Deploying contracts with account:", deployer.address);
    
    // 检查账户余额
    const balance = await deployer.getBalance();
    console.log("💰 Account balance:", ethers.utils.formatEther(balance), "ETH");
    
    // 部署TitanToken
    console.log("\n📦 Deploying TitanToken...");
    const TitanToken = await ethers.getContractFactory("TitanToken");
    const titanToken = await TitanToken.deploy(
        "Titan Token",
        "TTC",
        ethers.utils.parseEther("100000000") // 1亿初始供应量
    );
    await titanToken.deployed();
    console.log("✅ TitanToken deployed to:", titanToken.address);
    
    // 部署TitanStaking
    console.log("\n📦 Deploying TitanStaking...");
    const TitanStaking = await ethers.getContractFactory("TitanStaking");
    const titanStaking = await TitanStaking.deploy(
        titanToken.address, // 质押代币
        titanToken.address, // 奖励代币
        ethers.utils.parseEther("0.1") // 奖励率：每秒0.1代币
    );
    await titanStaking.deployed();
    console.log("✅ TitanStaking deployed to:", titanStaking.address);
    
    // 配置权限
    console.log("\n⚙️ Configuring permissions...");
    
    // 添加质押合约为铸造者
    await titanToken.addMinter(titanStaking.address);
    console.log("✅ Added staking contract as minter");
    
    // 转移一些代币到质押合约作为奖励池
    const rewardAmount = ethers.utils.parseEther("10000000"); // 1000万代币
    await titanToken.transfer(titanStaking.address, rewardAmount);
    console.log("✅ Transferred reward tokens to staking contract");
    
    // 保存部署信息
    const deploymentInfo = {
        network: hre.network.name,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        contracts: {
            TitanToken: {
                address: titanToken.address,
                constructorArgs: [
                    "Titan Token",
                    "TTC",
                    ethers.utils.parseEther("100000000").toString()
                ]
            },
            TitanStaking: {
                address: titanStaking.address,
                constructorArgs: [
                    titanToken.address,
                    titanToken.address,
                    ethers.utils.parseEther("0.1").toString()
                ]
            }
        }
    };
    
    // 写入部署信息文件
    const fs = require('fs');
    fs.writeFileSync(
        `deployments/${hre.network.name}.json`,
        JSON.stringify(deploymentInfo, null, 2)
    );
    
    console.log("\n🎉 Deployment completed successfully!");
    console.log("📄 Deployment info saved to:", `deployments/${hre.network.name}.json`);
    
    // 验证合约（如果在测试网或主网）
    if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
        console.log("\n🔍 Verifying contracts...");
        await verifyContracts(deploymentInfo);
    }
}

async function verifyContracts(deploymentInfo) {
    try {
        // 验证TitanToken
        await hre.run("verify:verify", {
            address: deploymentInfo.contracts.TitanToken.address,
            constructorArguments: deploymentInfo.contracts.TitanToken.constructorArgs
        });
        console.log("✅ TitanToken verified");
        
        // 验证TitanStaking
        await hre.run("verify:verify", {
            address: deploymentInfo.contracts.TitanStaking.address,
            constructorArguments: deploymentInfo.contracts.TitanStaking.constructorArgs
        });
        console.log("✅ TitanStaking verified");
        
    } catch (error) {
        console.log("❌ Verification failed:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });
```

#### 执行部署

```bash
# 创建部署目录
mkdir deployments

# 部署到本地网络
npx hardhat run scripts/deploy.js --network localhost

# 部署到TitanChain测试网
npx hardhat run scripts/deploy.js --network titanchain_testnet

# 部署到TitanChain主网
npx hardhat run scripts/deploy.js --network titanchain
```

### 3.4 合约验证和测试

#### 单元测试

创建 `test/TitanToken.test.js`：

```javascript
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TitanToken", function () {
    let TitanToken, titanToken, owner, addr1, addr2;
    
    beforeEach(async function () {
        TitanToken = await ethers.getContractFactory("TitanToken");
        [owner, addr1, addr2] = await ethers.getSigners();
        
        titanToken = await TitanToken.deploy(
            "Titan Token",
            "TTC",
            ethers.utils.parseEther("1000000")
        );
        await titanToken.deployed();
    });
    
    describe("Deployment", function () {
        it("Should set the right owner", async function () {
            expect(await titanToken.owner()).to.equal(owner.address);
        });
        
        it("Should assign the total supply to the owner", async function () {
            const ownerBalance = await titanToken.balanceOf(owner.address);
            expect(await titanToken.totalSupply()).to.equal(ownerBalance);
        });
        
        it("Should set the correct name and symbol", async function () {
            expect(await titanToken.name()).to.equal("Titan Token");
            expect(await titanToken.symbol()).to.equal("TTC");
        });
    });
    
    describe("Minting", function () {
        it("Should allow owner to mint tokens", async function () {
            const mintAmount = ethers.utils.parseEther("1000");
            await titanToken.mint(addr1.address, mintAmount);
            
            expect(await titanToken.balanceOf(addr1.address)).to.equal(mintAmount);
        });
        
        it("Should not allow non-minters to mint", async function () {
            const mintAmount = ethers.utils.parseEther("1000");
            
            await expect(
                titanToken.connect(addr1).mint(addr2.address, mintAmount)
            ).to.be.revertedWith("TitanToken: caller is not a minter");
        });
        
        it("Should not exceed max supply", async function () {
            const maxSupply = await titanToken.MAX_SUPPLY();
            const currentSupply = await titanToken.totalSupply();
            const excessAmount = maxSupply.sub(currentSupply).add(1);
            
            await expect(
                titanToken.mint(addr1.address, excessAmount)
            ).to.be.revertedWith("TitanToken: exceeds max supply");
        });
    });
    
    describe("Batch Minting", function () {
        it("Should allow batch minting to multiple addresses", async function () {
            const recipients = [addr1.address, addr2.address];
            const amounts = [
                ethers.utils.parseEther("100"),
                ethers.utils.parseEther("200")
            ];
            
            await titanToken.batchMint(recipients, amounts);
            
            expect(await titanToken.balanceOf(addr1.address)).to.equal(amounts[0]);
            expect(await titanToken.balanceOf(addr2.address)).to.equal(amounts[1]);
        });
        
        it("Should revert if arrays length mismatch", async function () {
            const recipients = [addr1.address, addr2.address];
            const amounts = [ethers.utils.parseEther("100")];
            
            await expect(
                titanToken.batchMint(recipients, amounts)
            ).to.be.revertedWith("TitanToken: arrays length mismatch");
        });
    });
    
    describe("Pausing", function () {
        it("Should pause and unpause transfers", async function () {
            // 转移一些代币给addr1
            await titanToken.transfer(addr1.address, ethers.utils.parseEther("100"));
            
            // 暂停合约
            await titanToken.pause();
            
            // 尝试转账应该失败
            await expect(
                titanToken.connect(addr1).transfer(addr2.address, ethers.utils.parseEther("50"))
            ).to.be.revertedWith("Pausable: paused");
            
            // 恢复合约
            await titanToken.unpause();
            
            // 现在转账应该成功
            await titanToken.connect(addr1).transfer(addr2.address, ethers.utils.parseEther("50"));
            expect(await titanToken.balanceOf(addr2.address)).to.equal(ethers.utils.parseEther("50"));
        });
    });
});
```

#### 运行测试

```bash
# 运行所有测试
npx hardhat test

# 运行特定测试文件
npx hardhat test test/TitanToken.test.js

# 运行测试并显示gas使用情况
npx hardhat test --gas-reporter

# 运行测试并生成覆盖率报告
npx hardhat coverage
```

#### 合约交互脚本

创建 `scripts/interact.js`：

```javascript
const { ethers } = require("hardhat");

async function main() {
    // 加载部署信息
    const deploymentInfo = require(`../deployments/${hre.network.name}.json`);
    
    // 获取合约实例
    const titanToken = await ethers.getContractAt(
        "TitanToken",
        deploymentInfo.contracts.TitanToken.address
    );
    
    const titanStaking = await ethers.getContractAt(
        "TitanStaking",
        deploymentInfo.contracts.TitanStaking.address
    );
    
    // 获取账户
    const [deployer, user1] = await ethers.getSigners();
    
    console.log("🔍 Contract Interaction Demo");
    console.log("============================");
    
    // 查询代币信息
    console.log("\n📊 Token Information:");
    console.log("Name:", await titanToken.name());
    console.log("Symbol:", await titanToken.symbol());
    console.log("Total Supply:", ethers.utils.formatEther(await titanToken.totalSupply()));
    console.log("Deployer Balance:", ethers.utils.formatEther(await titanToken.balanceOf(deployer.address)));
    
    // 转移代币给用户
    console.log("\n💸 Transferring tokens to user...");
    const transferAmount = ethers.utils.parseEther("1000");
    await titanToken.transfer(user1.address, transferAmount);
    console.log("User1 Balance:", ethers.utils.formatEther(await titanToken.balanceOf(user1.address)));
    
    // 用户授权质押合约
    console.log("\n✅ Approving staking contract...");
    await titanToken.connect(user1).approve(titanStaking.address, transferAmount);
    
    // 用户质押代币
    console.log("\n🔒 Staking tokens...");
    const stakeAmount = ethers.utils.parseEther("500");
    await titanStaking.connect(user1).stake(stakeAmount);
    
    console.log("Staked Amount:", ethers.utils.formatEther(await titanStaking.balanceOf(user1.address)));
    console.log("Total Staked:", ethers.utils.formatEther(await titanStaking.totalSupply()));
    
    // 等待一段时间以累积奖励
    console.log("\n⏰ Waiting for rewards to accumulate...");
    await new Promise(resolve => setTimeout(resolve, 5000)); // 等待5秒
    
    // 查询奖励
    console.log("Earned Rewards:", ethers.utils.formatEther(await titanStaking.earned(user1.address)));
    
    // 领取奖励
    console.log("\n🎁 Claiming rewards...");
    await titanStaking.connect(user1).getReward();
    
    console.log("User1 Balance After Reward:", ethers.utils.formatEther(await titanToken.balanceOf(user1.address)));
    
    console.log("\n✅ Interaction demo completed!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
```

### 3.5 合约升级和管理

#### 可升级合约部署

创建 `scripts/deploy-upgradeable.js`：

```javascript
const { ethers, upgrades } = require("hardhat");

async function main() {
    console.log("🚀 Deploying upgradeable contracts...");
    
    // 部署可升级的TitanToken
    const TitanTokenV1 = await ethers.getContractFactory("TitanTokenV1");
    const titanToken = await upgrades.deployProxy(
        TitanTokenV1,
        ["Titan Token", "TTC", ethers.utils.parseEther("100000000")],
        { initializer: 'initialize' }
    );
    await titanToken.deployed();
    
    console.log("✅ TitanTokenV1 deployed to:", titanToken.address);
    
    // 保存代理地址
    const proxyAddress = titanToken.address;
    const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    
    console.log("📋 Proxy address:", proxyAddress);
    console.log("📋 Implementation address:", implementationAddress);
    
    // 保存升级信息
    const upgradeInfo = {
        proxy: proxyAddress,
        implementation: implementationAddress,
        version: "v1",
        timestamp: new Date().toISOString()
    };
    
    const fs = require('fs');
    fs.writeFileSync(
        `deployments/${hre.network.name}-upgradeable.json`,
        JSON.stringify(upgradeInfo, null, 2)
    );
}

main().catch(console.error);
```

#### 合约升级脚本

创建 `scripts/upgrade.js`：

```javascript
const { ethers, upgrades } = require("hardhat");

async function main() {
    console.log("🔄 Upgrading contract...");
    
    // 加载现有部署信息
    const upgradeInfo = require(`../deployments/${hre.network.name}-upgradeable.json`);
    const proxyAddress = upgradeInfo.proxy;
    
    // 部署新版本
    const TitanTokenV2 = await ethers.getContractFactory("TitanTokenV2");
    const upgraded = await upgrades.upgradeProxy(proxyAddress, TitanTokenV2);
    
    console.log("✅ Contract upgraded successfully");
    console.log("📋 Proxy address (unchanged):", upgraded.address);
    
    // 获取新的实现地址
    const newImplementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    console.log("📋 New implementation address:", newImplementationAddress);
    
    // 更新升级信息
    upgradeInfo.implementation = newImplementationAddress;
    upgradeInfo.version = "v2";
    upgradeInfo.upgradeTimestamp = new Date().toISOString();
    
    const fs = require('fs');
    fs.writeFileSync(
        `deployments/${hre.network.name}-upgradeable.json`,
        JSON.stringify(upgradeInfo, null, 2)
    );
    
    console.log("📄 Upgrade info updated");
}

main().catch(console.error);
```

### 3.6 最佳实践和安全建议

#### 安全检查清单

**部署前检查：**

1. **代码审计**
```bash
# 使用Slither进行静态分析
pip install slither-analyzer
slither contracts/

# 使用MythX进行安全分析
npm install -g mythx-cli
mythx analyze contracts/TitanToken.sol
```

2. **测试覆盖率**
```bash
# 确保测试覆盖率达到90%以上
npx hardhat coverage
```

3. **Gas优化**
```bash
# 分析gas使用情况
npx hardhat test --gas-reporter
```

#### 部署安全实践

创建 `scripts/security-check.js`：

```javascript
const { ethers } = require("hardhat");

async function securityCheck() {
    console.log("🔒 Running security checks...");
    
    const [deployer] = await ethers.getSigners();
    
    // 检查1: 验证部署者余额
    const balance = await deployer.getBalance();
    const minBalance = ethers.utils.parseEther("0.1");
    
    if (balance.lt(minBalance)) {
        throw new Error(`Insufficient balance: ${ethers.utils.formatEther(balance)} ETH`);
    }
    console.log("✅ Deployer balance sufficient");
    
    // 检查2: 验证网络配置
    const network = await ethers.provider.getNetwork();
    console.log("📡 Network:", network.name, "Chain ID:", network.chainId);
    
    // 检查3: 验证gas价格
    const gasPrice = await ethers.provider.getGasPrice();
    console.log("⛽ Current gas price:", ethers.utils.formatUnits(gasPrice, "gwei"), "gwei");
    
    // 检查4: 验证合约字节码大小
    const TitanToken = await ethers.getContractFactory("TitanToken");
    const bytecode = TitanToken.bytecode;
    const size = bytecode.length / 2 - 1; // 减去0x前缀
    
    if (size > 24576) { // 24KB限制
        throw new Error(`Contract too large: ${size} bytes`);
    }
    console.log("✅ Contract size OK:", size, "bytes");
    
    console.log("🎉 All security checks passed!");
}

securityCheck().catch(console.error);
```

#### 多签钱包管理

创建多签钱包管理脚本 `scripts/multisig-setup.js`：

```javascript
const { ethers } = require("hardhat");

async function setupMultisig() {
    console.log("🔐 Setting up multisig wallet...");
    
    // 部署Gnosis Safe多签钱包
    const GnosisSafe = await ethers.getContractFactory("GnosisSafe");
    
    const owners = [
        "0x742d35Cc6634C0532925a3b8D4C9db96c4b4df93", // Owner 1
        "0x8ba1f109551bD432803012645Hac136c22C501e5", // Owner 2
        "0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db"  // Owner 3
    ];
    
    const threshold = 2; // 需要2个签名
    
    const multisig = await GnosisSafe.deploy();
    await multisig.deployed();
    
    // 初始化多签钱包
    await multisig.setup(
        owners,
        threshold,
        ethers.constants.AddressZero,
        "0x",
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
        0,
        ethers.constants.AddressZero
    );
    
    console.log("✅ Multisig wallet deployed:", multisig.address);
    console.log("👥 Owners:", owners);
    console.log("🔢 Threshold:", threshold);
    
    return multisig.address;
}

setupMultisig().catch(console.error);
```

#### 监控和告警

创建监控脚本 `scripts/monitor-contracts.js`：

```javascript
const { ethers } = require("hardhat");

async function monitorContracts() {
    console.log("👀 Starting contract monitoring...");
    
    // 加载合约地址
    const deploymentInfo = require(`../deployments/${hre.network.name}.json`);
    
    const titanToken = await ethers.getContractAt(
        "TitanToken",
        deploymentInfo.contracts.TitanToken.address
    );
    
    // 监听事件
    titanToken.on("Transfer", (from, to, amount, event) => {
        console.log(`💸 Transfer: ${from} -> ${to}, Amount: ${ethers.utils.formatEther(amount)}`);
        
        // 检查大额转账
        const largeAmount = ethers.utils.parseEther("10000");
        if (amount.gt(largeAmount)) {
            console.log("🚨 ALERT: Large transfer detected!");
            // 发送告警通知
            sendAlert(`Large transfer: ${ethers.utils.formatEther(amount)} TTC`);
        }
    });
    
    titanToken.on("Paused", (event) => {
        console.log("⏸️ Contract paused");
        sendAlert("TitanToken contract has been paused");
    });
    
    titanToken.on("Unpaused", (event) => {
        console.log("▶️ Contract unpaused");
        sendAlert("TitanToken contract has been unpaused");
    });
    
    console.log("✅ Event listeners set up");
}

async function sendAlert(message) {
    // 这里可以集成Slack、Discord、邮件等通知服务
    console.log(`🚨 ALERT: ${message}`);
    
    // 示例：发送到Webhook
    // const webhook = process.env.SLACK_WEBHOOK_URL;
    // if (webhook) {
    //     await fetch(webhook, {
    //         method: 'POST',
    //         headers: { 'Content-Type': 'application/json' },
    //         body: JSON.stringify({ text: message })
    //     });
    // }
}

monitorContracts().catch(console.error);
```

## 常见问题解决方案

### 部署问题

**Q: 合约部署失败，提示gas不足**
```bash
# 解决方案：增加gas限制
npx hardhat run scripts/deploy.js --network titanchain --gas-limit 8000000
```

**Q: 网络连接超时**
```bash
# 检查网络配置
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
  http://localhost:8545

# 修改hardhat.config.js中的timeout设置
networks: {
  titanchain: {
    url: "http://localhost:8545",
    timeout: 60000, // 60秒超时
    accounts: [PRIVATE_KEY]
  }
}
```

**Q: 合约验证失败**
```bash
# 手动验证合约
npx hardhat verify --network titanchain CONTRACT_ADDRESS "Constructor" "Args"

# 检查构造函数参数格式
npx hardhat verify --network titanchain \
  0x742d35Cc6634C0532925a3b8D4C9db96c4b4df93 \
  "Titan Token" "TTC" "100000000000000000000000000"
```

### 节点问题

**Q: 节点同步缓慢**
```bash
# 检查对等节点连接
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"net_peerCount","params":[],"id":1}' \
  http://localhost:8545

# 手动添加对等节点
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"admin_addPeer","params":["enode://..."],"id":1}' \
  http://localhost:8545
```

**Q: 内存使用过高**
```bash
# 调整缓存设置
echo "CACHE_SIZE=512" >> /opt/titanchain/.env
sudo systemctl restart titanchain

# 启用垃圾回收
echo "GC_MODE=full" >> /opt/titanchain/.env
```

### 合约问题

**Q: 交易失败，gas估算错误**
```javascript
// 手动设置gas限制
const tx = await contract.someFunction({
    gasLimit: 500000,
    gasPrice: ethers.utils.parseUnits('20', 'gwei')
});
```

**Q: 合约调用返回错误数据**
```javascript
// 检查合约ABI和地址
const contract = await ethers.getContractAt("TitanToken", contractAddress);
console.log("Contract address:", contract.address);
console.log("Contract functions:", Object.keys(contract.functions));
```

## 性能优化建议

### 区块链性能优化

1. **数据库优化**
```sql
-- 创建索引优化查询性能
CREATE INDEX idx_blocks_height ON blocks(height);
CREATE INDEX idx_transactions_hash ON transactions(hash);
CREATE INDEX idx_transactions_block_height ON transactions(block_height);
```

2. **缓存配置**
```bash
# Redis缓存配置
redis-cli config set maxmemory 4gb
redis-cli config set maxmemory-policy allkeys-lru
```

3. **网络优化**
```bash
# 调整网络参数
echo "P2P_MAX_PEERS=100" >> .env
echo "MAX_PENDING_PEERS=50" >> .env
```

### 合约性能优化

1. **Gas优化技巧**
```solidity
// 使用packed structs
struct OptimizedStruct {
    uint128 value1;  // 16 bytes
    uint128 value2;  // 16 bytes
    // 总共32 bytes，一个存储槽
}

// 批量操作
function batchTransfer(address[] calldata recipients, uint256[] calldata amounts) 
    external {
    for (uint256 i = 0; i < recipients.length; i++) {
        _transfer(msg.sender, recipients[i], amounts[i]);
    }
}
```

2. **存储优化**
```solidity
// 使用mapping代替数组（适当情况下）
mapping(address => uint256) public balances;

// 使用events记录历史数据
event Transfer(address indexed from, address indexed to, uint256 value);
```

## 安全注意事项

### 私钥管理

1. **硬件钱包**
```bash
# 使用Ledger硬件钱包
npm install @ledgerhq/hw-app-eth
```

2. **环境变量**
```bash
# 永远不要在代码中硬编码私钥
export PRIVATE_KEY="your_private_key_here"
export MNEMONIC="your twelve word mnemonic phrase here"
```

3. **多签钱包**
```javascript
// 使用Gnosis Safe进行重要操作
const multisigTx = await gnosisSafe.execTransaction(
    targetContract.address,
    0,
    data,
    0, // CALL operation
    0, 0, 0,
    ethers.constants.AddressZero,
    ethers.constants.AddressZero,
    signatures
);
```

### 合约安全

1. **访问控制**
```solidity
// 使用OpenZeppelin的访问控制
import "@openzeppelin/contracts/access/AccessControl.sol";

contract SecureContract is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, msg.sender), "Not admin");
        _;
    }
}
```

2. **重入攻击防护**
```solidity
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract SafeContract is ReentrancyGuard {
    function withdraw() external nonReentrant {
        // 安全的提取逻辑
    }
}
```

3. **整数溢出防护**
```solidity
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

// 或者使用Solidity 0.8+的内置溢出检查
```

---

## 总结

本教程涵盖了TitanChain的完整部署流程，包括：

1. **区块链部署**：从环境准备到网络启动的完整流程
2. **节点安装**：详细的节点安装、配置和运维指南  
3. **合约部署**：智能合约开发、测试、部署和管理的最佳实践

通过遵循本教程，您可以：
- ✅ 成功部署TitanChain区块链网络
- ✅ 安装和运行稳定的验证者节点
- ✅ 开发和部署安全的智能合约
- ✅ 实施有效的监控和安全措施

**重要提醒**：
- 在生产环境中部署前，请务必在测试网络中充分测试
- 定期备份重要数据和私钥
- 保持软件版本更新以获得最新的安全补丁
- 遵循最佳安全实践，使用多签钱包管理重要资产

如有问题，请参考[TitanChain官方文档](https://docs.titanchain.io)或联系技术支持团队。