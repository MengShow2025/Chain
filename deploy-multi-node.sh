#!/bin/bash

# Multi-Node Deployment Script for TitanChain / TitanChain多节点部署脚本
# Supports deployment across multiple servers with automatic configuration
# 支持跨多台服务器部署，自动配置

set -e  # Exit on any error / 遇到错误时退出

# Color codes for output / 输出颜色代码
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration / 配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="TitanChain"
DEFAULT_P2P_PORT=4003
DEFAULT_RPC_PORT=3001
DEFAULT_API_PORT=8080
NETWORK_ID="titanchain-mainnet"

# Default deployment configuration / 默认部署配置
DEFAULT_SERVERS=(
    "192.168.1.100"
    "192.168.1.101" 
    "192.168.1.102"
    "192.168.1.103"
)

# Print colored output / 打印彩色输出
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${PURPLE}$1${NC}"
}

# Show usage / 显示用法
show_usage() {
    cat << EOF
${PROJECT_NAME} Multi-Node Deployment Script / 多节点部署脚本

Usage / 用法:
    $0 [OPTIONS] COMMAND

Commands / 命令:
    deploy          Deploy nodes to multiple servers / 部署节点到多台服务器
    start           Start all deployed nodes / 启动所有已部署的节点
    stop            Stop all deployed nodes / 停止所有已部署的节点
    status          Check status of all nodes / 检查所有节点状态
    logs            Show logs from all nodes / 显示所有节点日志
    clean           Clean up deployment / 清理部署
    test            Test multi-node network / 测试多节点网络

Options / 选项:
    -s, --servers   Comma-separated list of server IPs / 逗号分隔的服务器IP列表
                    Default: ${DEFAULT_SERVERS[*]} / 默认: ${DEFAULT_SERVERS[*]}
    -u, --user      SSH username / SSH用户名 (default: current user / 默认: 当前用户)
    -k, --key       SSH private key file / SSH私钥文件
    -p, --port      Base P2P port / 基础P2P端口 (default: ${DEFAULT_P2P_PORT} / 默认: ${DEFAULT_P2P_PORT})
    -r, --rpc       Base RPC port / 基础RPC端口 (default: ${DEFAULT_RPC_PORT} / 默认: ${DEFAULT_RPC_PORT})
    -a, --api       Base API port / 基础API端口 (default: ${DEFAULT_API_PORT} / 默认: ${DEFAULT_API_PORT})
    -n, --network   Network ID / 网络ID (default: ${NETWORK_ID} / 默认: ${NETWORK_ID})
    -d, --data      Data directory / 数据目录 (default: ./data / 默认: ./data)
    --bootstrap     Bootstrap node mode / 引导节点模式
    --validator     Validator node mode / 验证节点模式
    --dry-run       Show what would be done without executing / 显示将要执行的操作但不实际执行
    -h, --help      Show this help / 显示此帮助

Examples / 示例:
    # Deploy to default servers / 部署到默认服务器
    $0 deploy

    # Deploy to custom servers / 部署到自定义服务器
    $0 -s "10.0.1.10,10.0.1.11,10.0.1.12" deploy

    # Deploy with custom SSH user and key / 使用自定义SSH用户和密钥部署
    $0 -u ubuntu -k ~/.ssh/id_rsa -s "10.0.1.10,10.0.1.11" deploy

    # Start all nodes / 启动所有节点
    $0 start

    # Check status / 检查状态
    $0 status

    # Test network / 测试网络
    $0 test
EOF
}

# Parse command line arguments / 解析命令行参数
parse_args() {
    SERVERS=()
    SSH_USER="${USER}"
    SSH_KEY=""
    P2P_PORT="${DEFAULT_P2P_PORT}"
    RPC_PORT="${DEFAULT_RPC_PORT}"
    API_PORT="${DEFAULT_API_PORT}"
    NETWORK_ID_ARG="${NETWORK_ID}"
    DATA_DIR="./data"
    BOOTSTRAP_MODE=false
    VALIDATOR_MODE=false
    DRY_RUN=false
    COMMAND=""

    while [[ $# -gt 0 ]]; do
        case $1 in
            -s|--servers)
                IFS=',' read -ra SERVERS <<< "$2"
                shift 2
                ;;
            -u|--user)
                SSH_USER="$2"
                shift 2
                ;;
            -k|--key)
                SSH_KEY="$2"
                shift 2
                ;;
            -p|--port)
                P2P_PORT="$2"
                shift 2
                ;;
            -r|--rpc)
                RPC_PORT="$2"
                shift 2
                ;;
            -a|--api)
                API_PORT="$2"
                shift 2
                ;;
            -n|--network)
                NETWORK_ID_ARG="$2"
                shift 2
                ;;
            -d|--data)
                DATA_DIR="$2"
                shift 2
                ;;
            --bootstrap)
                BOOTSTRAP_MODE=true
                shift
                ;;
            --validator)
                VALIDATOR_MODE=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            deploy|start|stop|status|logs|clean|test)
                COMMAND="$1"
                shift
                ;;
            *)
                print_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done

    # Use default servers if none specified / 如果未指定服务器则使用默认服务器
    if [[ ${#SERVERS[@]} -eq 0 ]]; then
        SERVERS=("${DEFAULT_SERVERS[@]}")
    fi

    # Validate command / 验证命令
    if [[ -z "$COMMAND" ]]; then
        print_error "No command specified / 未指定命令"
        show_usage
        exit 1
    fi
}

# Check prerequisites / 检查先决条件
check_prerequisites() {
    print_info "Checking prerequisites / 检查先决条件..."

    # Check if required commands exist / 检查必需的命令是否存在
    local required_commands=("ssh" "scp" "node" "npm")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            print_error "Required command not found: $cmd / 未找到必需的命令: $cmd"
            exit 1
        fi
    done

    # Check if project files exist / 检查项目文件是否存在
    local required_files=(
        "smart-node-launcher.ts"
        "network-discovery.ts"
        "package.json"
    )
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "$SCRIPT_DIR/$file" ]]; then
            print_error "Required file not found: $file / 未找到必需的文件: $file"
            exit 1
        fi
    done

    print_success "Prerequisites check passed / 先决条件检查通过"
}

# Test SSH connectivity / 测试SSH连接
test_ssh_connectivity() {
    print_info "Testing SSH connectivity / 测试SSH连接..."

    local ssh_opts="-o ConnectTimeout=10 -o StrictHostKeyChecking=no"
    if [[ -n "$SSH_KEY" ]]; then
        ssh_opts="$ssh_opts -i $SSH_KEY"
    fi

    for server in "${SERVERS[@]}"; do
        print_info "Testing connection to $server / 测试连接到 $server..."
        
        if $DRY_RUN; then
            print_info "[DRY RUN] Would test SSH to $SSH_USER@$server"
            continue
        fi

        if ssh $ssh_opts "$SSH_USER@$server" "echo 'SSH connection successful'" &> /dev/null; then
            print_success "SSH connection to $server successful / SSH连接到 $server 成功"
        else
            print_error "SSH connection to $server failed / SSH连接到 $server 失败"
            exit 1
        fi
    done
}

# Generate node configuration / 生成节点配置
generate_node_config() {
    local server_ip="$1"
    local node_index="$2"
    local is_bootstrap="$3"

    local node_p2p_port=$((P2P_PORT + node_index))
    local node_rpc_port=$((RPC_PORT + node_index))
    local node_api_port=$((API_PORT + node_index))
    local node_id="titan-node-${node_index}-$(date +%s)"

    # Build bootstrap nodes list / 构建引导节点列表
    local bootstrap_nodes=""
    if [[ "$is_bootstrap" != "true" ]]; then
        # First node is always bootstrap / 第一个节点总是引导节点
        bootstrap_nodes="${SERVERS[0]}:$P2P_PORT"
        
        # Add other nodes as bootstrap peers / 添加其他节点作为引导节点
        for ((i=0; i<node_index; i++)); do
            if [[ $i -ne $node_index ]]; then
                local peer_port=$((P2P_PORT + i))
                if [[ -n "$bootstrap_nodes" ]]; then
                    bootstrap_nodes="$bootstrap_nodes,${SERVERS[$i]}:$peer_port"
                else
                    bootstrap_nodes="${SERVERS[$i]}:$peer_port"
                fi
            fi
        done
    fi

    # Generate .env file / 生成.env文件
    cat > "/tmp/node-${node_index}.env" << EOF
# TitanChain Node Configuration / TitanChain节点配置
# Generated on $(date) / 生成于 $(date)

# Node Identity / 节点身份
NODE_ID=$node_id
NETWORK_ID=$NETWORK_ID_ARG

# Network Configuration / 网络配置
P2P_PORT=$node_p2p_port
RPC_PORT=$node_rpc_port
API_PORT=$node_api_port
HOST=0.0.0.0

# Bootstrap Configuration / 引导配置
IS_BOOTSTRAP_NODE=$is_bootstrap
BOOTSTRAP_NODES=$bootstrap_nodes

# Data Configuration / 数据配置
DATA_DIR=$DATA_DIR/node-$node_index

# Performance Configuration / 性能配置
MAX_PEERS=50
DISCOVERY_INTERVAL=30000
HEALTH_CHECK_INTERVAL=10000
SYNC_TIMEOUT=60000
NETWORK_TIMEOUT=30000

# Feature Flags / 功能标志
ENABLE_BLOCK_PRODUCTION=true
ENABLE_LOCAL_DISCOVERY=true
ENABLE_DNS_DISCOVERY=false
ENABLE_API_GATEWAY=true

# Logging / 日志
LOG_LEVEL=info
LOG_FILE=$DATA_DIR/node-$node_index/logs/node.log
EOF

    print_success "Generated configuration for node $node_index on $server_ip / 为 $server_ip 上的节点 $node_index 生成配置"
}

# Deploy to single server / 部署到单个服务器
deploy_to_server() {
    local server_ip="$1"
    local node_index="$2"
    local is_bootstrap="$3"

    print_info "Deploying to server $server_ip (node $node_index) / 部署到服务器 $server_ip (节点 $node_index)..."

    local ssh_opts="-o StrictHostKeyChecking=no"
    if [[ -n "$SSH_KEY" ]]; then
        ssh_opts="$ssh_opts -i $SSH_KEY"
    fi

    if $DRY_RUN; then
        print_info "[DRY RUN] Would deploy node $node_index to $server_ip"
        return
    fi

    # Create remote directory / 创建远程目录
    ssh $ssh_opts "$SSH_USER@$server_ip" "mkdir -p ~/titanchain"

    # Copy project files / 复制项目文件
    print_info "Copying project files to $server_ip / 复制项目文件到 $server_ip..."
    
    # Create temporary deployment package / 创建临时部署包
    local temp_dir="/tmp/titanchain-deploy-$$"
    mkdir -p "$temp_dir"
    
    # Copy essential files / 复制必要文件
    cp -r "$SCRIPT_DIR"/{*.ts,*.js,*.json,blockchain,network,shared,api} "$temp_dir/" 2>/dev/null || true
    
    # Generate node configuration / 生成节点配置
    generate_node_config "$server_ip" "$node_index" "$is_bootstrap"
    cp "/tmp/node-${node_index}.env" "$temp_dir/.env"
    
    # Copy deployment package / 复制部署包
    scp $ssh_opts -r "$temp_dir"/* "$SSH_USER@$server_ip:~/titanchain/"
    
    # Clean up temporary files / 清理临时文件
    rm -rf "$temp_dir"
    rm -f "/tmp/node-${node_index}.env"

    # Install dependencies on remote server / 在远程服务器上安装依赖
    print_info "Installing dependencies on $server_ip / 在 $server_ip 上安装依赖..."
    ssh $ssh_opts "$SSH_USER@$server_ip" << 'EOF'
cd ~/titanchain
if [[ ! -f package.json ]]; then
    echo "package.json not found, creating basic one..."
    cat > package.json << 'PACKAGE_EOF'
{
  "name": "titanchain-node",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "tsx smart-node-launcher.ts",
    "test": "tsx test-real-sync.ts"
  },
  "dependencies": {
    "tsx": "^4.0.0",
    "dotenv": "^16.0.0"
  }
}
PACKAGE_EOF
fi

# Install Node.js if not present / 如果不存在则安装Node.js
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Install dependencies / 安装依赖
npm install
EOF

    print_success "Deployment to $server_ip completed / 部署到 $server_ip 完成"
}

# Deploy all nodes / 部署所有节点
deploy_nodes() {
    print_header "🚀 Starting Multi-Node Deployment / 开始多节点部署"
    print_info "Deploying to ${#SERVERS[@]} servers / 部署到 ${#SERVERS[@]} 台服务器"

    for i in "${!SERVERS[@]}"; do
        local server="${SERVERS[$i]}"
        local is_bootstrap="false"
        
        # First node is bootstrap / 第一个节点是引导节点
        if [[ $i -eq 0 ]]; then
            is_bootstrap="true"
        fi

        deploy_to_server "$server" "$i" "$is_bootstrap"
    done

    print_success "Multi-node deployment completed / 多节点部署完成"
    print_info "Bootstrap node: ${SERVERS[0]} / 引导节点: ${SERVERS[0]}"
    print_info "Validator nodes: ${SERVERS[*]:1} / 验证节点: ${SERVERS[*]:1}"
}

# Start all nodes / 启动所有节点
start_nodes() {
    print_header "▶️ Starting All Nodes / 启动所有节点"

    local ssh_opts="-o StrictHostKeyChecking=no"
    if [[ -n "$SSH_KEY" ]]; then
        ssh_opts="$ssh_opts -i $SSH_KEY"
    fi

    # Start bootstrap node first / 首先启动引导节点
    print_info "Starting bootstrap node on ${SERVERS[0]} / 在 ${SERVERS[0]} 上启动引导节点..."
    
    if $DRY_RUN; then
        print_info "[DRY RUN] Would start bootstrap node on ${SERVERS[0]}"
    else
        ssh $ssh_opts "$SSH_USER@${SERVERS[0]}" << 'EOF'
cd ~/titanchain
nohup npm start > node.log 2>&1 &
echo $! > node.pid
echo "Bootstrap node started with PID $(cat node.pid)"
EOF
    fi

    # Wait for bootstrap node to initialize / 等待引导节点初始化
    print_info "Waiting for bootstrap node to initialize / 等待引导节点初始化..."
    sleep 10

    # Start other nodes / 启动其他节点
    for i in "${!SERVERS[@]}"; do
        if [[ $i -eq 0 ]]; then
            continue  # Skip bootstrap node / 跳过引导节点
        fi

        local server="${SERVERS[$i]}"
        print_info "Starting validator node on $server / 在 $server 上启动验证节点..."

        if $DRY_RUN; then
            print_info "[DRY RUN] Would start validator node on $server"
        else
            ssh $ssh_opts "$SSH_USER@$server" << 'EOF'
cd ~/titanchain
nohup npm start > node.log 2>&1 &
echo $! > node.pid
echo "Validator node started with PID $(cat node.pid)"
EOF
        fi

        # Small delay between node starts / 节点启动之间的小延迟
        sleep 5
    done

    print_success "All nodes started / 所有节点已启动"
}

# Stop all nodes / 停止所有节点
stop_nodes() {
    print_header "⏹️ Stopping All Nodes / 停止所有节点"

    local ssh_opts="-o StrictHostKeyChecking=no"
    if [[ -n "$SSH_KEY" ]]; then
        ssh_opts="$ssh_opts -i $SSH_KEY"
    fi

    for server in "${SERVERS[@]}"; do
        print_info "Stopping node on $server / 停止 $server 上的节点..."

        if $DRY_RUN; then
            print_info "[DRY RUN] Would stop node on $server"
            continue
        fi

        ssh $ssh_opts "$SSH_USER@$server" << 'EOF'
cd ~/titanchain
if [[ -f node.pid ]]; then
    PID=$(cat node.pid)
    if kill -0 "$PID" 2>/dev/null; then
        echo "Stopping node with PID $PID..."
        kill "$PID"
        sleep 2
        if kill -0 "$PID" 2>/dev/null; then
            echo "Force killing node..."
            kill -9 "$PID"
        fi
    fi
    rm -f node.pid
    echo "Node stopped"
else
    echo "No PID file found, attempting to kill by name..."
    pkill -f "smart-node-launcher" || true
fi
EOF
    done

    print_success "All nodes stopped / 所有节点已停止"
}

# Check status of all nodes / 检查所有节点状态
check_status() {
    print_header "📊 Checking Node Status / 检查节点状态"

    local ssh_opts="-o StrictHostKeyChecking=no"
    if [[ -n "$SSH_KEY" ]]; then
        ssh_opts="$ssh_opts -i $SSH_KEY"
    fi

    for i in "${!SERVERS[@]}"; do
        local server="${SERVERS[$i]}"
        local node_type="Validator"
        if [[ $i -eq 0 ]]; then
            node_type="Bootstrap"
        fi

        print_info "Checking $node_type node on $server / 检查 $server 上的${node_type}节点..."

        if $DRY_RUN; then
            print_info "[DRY RUN] Would check status of node on $server"
            continue
        fi

        ssh $ssh_opts "$SSH_USER@$server" << 'EOF'
cd ~/titanchain
echo "=== Node Status ==="
if [[ -f node.pid ]]; then
    PID=$(cat node.pid)
    if kill -0 "$PID" 2>/dev/null; then
        echo "✅ Node is running (PID: $PID)"
        echo "📊 Process info:"
        ps -p "$PID" -o pid,ppid,cmd,etime,pcpu,pmem
    else
        echo "❌ Node is not running (stale PID file)"
        rm -f node.pid
    fi
else
    echo "❌ Node is not running (no PID file)"
fi

echo ""
echo "=== Recent Logs ==="
if [[ -f node.log ]]; then
    tail -10 node.log
else
    echo "No log file found"
fi
echo ""
EOF
    done
}

# Show logs from all nodes / 显示所有节点日志
show_logs() {
    print_header "📋 Node Logs / 节点日志"

    local ssh_opts="-o StrictHostKeyChecking=no"
    if [[ -n "$SSH_KEY" ]]; then
        ssh_opts="$ssh_opts -i $SSH_KEY"
    fi

    for i in "${!SERVERS[@]}"; do
        local server="${SERVERS[$i]}"
        local node_type="Validator"
        if [[ $i -eq 0 ]]; then
            node_type="Bootstrap"
        fi

        print_info "Logs from $node_type node on $server / $server 上${node_type}节点的日志:"

        if $DRY_RUN; then
            print_info "[DRY RUN] Would show logs from node on $server"
            continue
        fi

        ssh $ssh_opts "$SSH_USER@$server" << 'EOF'
cd ~/titanchain
echo "=== Last 20 lines of node.log ==="
if [[ -f node.log ]]; then
    tail -20 node.log
else
    echo "No log file found"
fi
echo ""
EOF
    done
}

# Clean up deployment / 清理部署
clean_deployment() {
    print_header "🧹 Cleaning Up Deployment / 清理部署"

    local ssh_opts="-o StrictHostKeyChecking=no"
    if [[ -n "$SSH_KEY" ]]; then
        ssh_opts="$ssh_opts -i $SSH_KEY"
    fi

    for server in "${SERVERS[@]}"; do
        print_info "Cleaning up $server / 清理 $server..."

        if $DRY_RUN; then
            print_info "[DRY RUN] Would clean up deployment on $server"
            continue
        fi

        ssh $ssh_opts "$SSH_USER@$server" << 'EOF'
cd ~
echo "Stopping any running nodes..."
pkill -f "smart-node-launcher" || true
echo "Removing deployment directory..."
rm -rf ~/titanchain
echo "Cleanup completed"
EOF
    done

    print_success "Cleanup completed on all servers / 所有服务器清理完成"
}

# Test multi-node network / 测试多节点网络
test_network() {
    print_header "🧪 Testing Multi-Node Network / 测试多节点网络"

    if $DRY_RUN; then
        print_info "[DRY RUN] Would run network tests"
        return
    fi

    # Create test script / 创建测试脚本
    cat > "/tmp/test-network.ts" << 'EOF'
#!/usr/bin/env tsx

import { NetworkDiscoveryService } from './network-discovery.js';

async function testNetwork() {
    console.log('🧪 Testing TitanChain Multi-Node Network / 测试TitanChain多节点网络');
    console.log('='.repeat(60));

    try {
        const discovery = new NetworkDiscoveryService({
            discoveryInterval: 10000,
            healthCheckInterval: 5000
        });

        await discovery.start();

        // Wait for discovery / 等待发现
        await new Promise(resolve => setTimeout(resolve, 15000));

        const networkState = discovery.getNetworkState();
        const peers = discovery.getHealthyPeers();

        console.log('\n📊 Network Test Results / 网络测试结果:');
        console.log(`   🌐 Network ID: ${networkState.networkId}`);
        console.log(`   👥 Total Peers: ${networkState.totalPeers} / 总节点数: ${networkState.totalPeers}`);
        console.log(`   ❤️ Healthy Peers: ${networkState.healthyPeers} / 健康节点数: ${networkState.healthyPeers}`);
        console.log(`   📊 Max Block Height: ${networkState.maxBlockHeight} / 最大区块高度: ${networkState.maxBlockHeight}`);
        console.log(`   ⚡ Average Latency: ${networkState.averageLatency.toFixed(2)}ms / 平均延迟: ${networkState.averageLatency.toFixed(2)}ms`);
        console.log(`   🔗 Network Partitioned: ${networkState.isPartitioned ? 'Yes' : 'No'} / 网络分区: ${networkState.isPartitioned ? '是' : '否'}`);

        console.log('\n👥 Discovered Peers / 发现的节点:');
        peers.forEach((peer, index) => {
            console.log(`   ${index + 1}. ${peer.nodeId} (${peer.address}:${peer.port})`);
            console.log(`      📊 Block Height: ${peer.blockHeight} / 区块高度: ${peer.blockHeight}`);
            console.log(`      ⚡ Latency: ${peer.latency}ms / 延迟: ${peer.latency}ms`);
            console.log(`      ❤️ Healthy: ${peer.isHealthy ? 'Yes' : 'No'} / 健康: ${peer.isHealthy ? '是' : '否'}`);
        });

        await discovery.stop();

        if (networkState.healthyPeers >= 2) {
            console.log('\n✅ Multi-node network test PASSED / 多节点网络测试通过');
            console.log('🎉 TitanChain multi-node deployment is working correctly! / TitanChain多节点部署工作正常！');
        } else {
            console.log('\n❌ Multi-node network test FAILED / 多节点网络测试失败');
            console.log('⚠️ Not enough healthy peers found / 未发现足够的健康节点');
        }

    } catch (error) {
        console.error('💥 Network test failed / 网络测试失败:', error);
        process.exit(1);
    }
}

testNetwork().catch(console.error);
EOF

    # Run test on first server / 在第一台服务器上运行测试
    local ssh_opts="-o StrictHostKeyChecking=no"
    if [[ -n "$SSH_KEY" ]]; then
        ssh_opts="$ssh_opts -i $SSH_KEY"
    fi

    print_info "Running network test from ${SERVERS[0]} / 从 ${SERVERS[0]} 运行网络测试..."

    scp $ssh_opts "/tmp/test-network.ts" "$SSH_USER@${SERVERS[0]}:~/titanchain/"
    ssh $ssh_opts "$SSH_USER@${SERVERS[0]}" << 'EOF'
cd ~/titanchain
npx tsx test-network.ts
EOF

    rm -f "/tmp/test-network.ts"
}

# Main execution / 主执行
main() {
    print_header "🚀 ${PROJECT_NAME} Multi-Node Deployment Script / 多节点部署脚本"
    print_header "=" * 80

    parse_args "$@"

    print_info "Configuration / 配置:"
    print_info "  Servers / 服务器: ${SERVERS[*]}"
    print_info "  SSH User / SSH用户: $SSH_USER"
    print_info "  P2P Port / P2P端口: $P2P_PORT"
    print_info "  RPC Port / RPC端口: $RPC_PORT"
    print_info "  API Port / API端口: $API_PORT"
    print_info "  Network ID / 网络ID: $NETWORK_ID_ARG"
    print_info "  Command / 命令: $COMMAND"
    if $DRY_RUN; then
        print_warning "DRY RUN MODE - No actual changes will be made / 试运行模式 - 不会进行实际更改"
    fi
    echo ""

    case "$COMMAND" in
        deploy)
            check_prerequisites
            test_ssh_connectivity
            deploy_nodes
            ;;
        start)
            start_nodes
            ;;
        stop)
            stop_nodes
            ;;
        status)
            check_status
            ;;
        logs)
            show_logs
            ;;
        clean)
            stop_nodes
            clean_deployment
            ;;
        test)
            test_network
            ;;
        *)
            print_error "Unknown command: $COMMAND / 未知命令: $COMMAND"
            show_usage
            exit 1
            ;;
    esac

    print_success "Operation completed successfully / 操作成功完成"
}

# Run main function / 运行主函数
main "$@"