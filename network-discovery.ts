#!/usr/bin/env tsx

/**
 * Network Discovery Service for TitanChain / TitanChain网络发现服务
 * Automatic discovery of network nodes and blockchain state
 * 自动发现网络节点和区块链状态
 * 
 * Key Features / 核心功能:
 * 1. Automatic peer discovery / 自动节点发现
 * 2. Network state monitoring / 网络状态监控
 * 3. Best sync source selection / 最佳同步源选择
 * 4. Network partition detection / 网络分区检测
 * 5. Connection health monitoring / 连接健康监控
 */

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import dotenv from 'dotenv';

// Load environment variables / 加载环境变量
dotenv.config();

// Peer information / 节点信息
interface PeerInfo {
  nodeId: string;
  address: string;
  port: number;
  blockHeight: number;
  genesisHash: string;
  networkId: string;
  version: string;
  lastSeen: number;
  latency: number;
  isHealthy: boolean;
  capabilities: string[];
}

// Network state / 网络状态
interface NetworkState {
  networkId: string;
  genesisHash: string;
  maxBlockHeight: number;
  totalPeers: number;
  healthyPeers: number;
  averageLatency: number;
  lastUpdated: number;
  isPartitioned: boolean;
}

// Discovery configuration / 发现配置
interface DiscoveryConfig {
  discoveryInterval: number;
  healthCheckInterval: number;
  peerTimeout: number;
  maxPeers: number;
  minHealthyPeers: number;
  networkScanPorts: number[];
  bootstrapNodes: string[];
  enableLocalDiscovery: boolean;
  enableDNSDiscovery: boolean;
}

// Discovery result / 发现结果
interface DiscoveryResult {
  success: boolean;
  peersFound: number;
  bestPeer?: PeerInfo;
  networkState: NetworkState;
  errors: string[];
}

/**
 * Network Discovery Service Class / 网络发现服务类
 */
class NetworkDiscoveryService extends EventEmitter {
  private config: DiscoveryConfig;
  private peers: Map<string, PeerInfo> = new Map();
  private networkState: NetworkState;
  private isRunning: boolean = false;
  private discoveryTimer?: NodeJS.Timeout;
  private healthCheckTimer?: NodeJS.Timeout;

  constructor(config?: Partial<DiscoveryConfig>) {
    super();

    // Initialize configuration / 初始化配置
    this.config = {
      discoveryInterval: parseInt(process.env.DISCOVERY_INTERVAL || '30000'), // 30 seconds
      healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '10000'), // 10 seconds
      peerTimeout: parseInt(process.env.PEER_TIMEOUT || '60000'), // 60 seconds
      maxPeers: parseInt(process.env.MAX_PEERS || '50'),
      minHealthyPeers: parseInt(process.env.MIN_HEALTHY_PEERS || '3'),
      networkScanPorts: this.parsePortRange(process.env.NETWORK_SCAN_PORTS || '4003-4010'),
      bootstrapNodes: this.parseBootstrapNodes(process.env.BOOTSTRAP_NODES || ''),
      enableLocalDiscovery: process.env.ENABLE_LOCAL_DISCOVERY !== 'false',
      enableDNSDiscovery: process.env.ENABLE_DNS_DISCOVERY === 'true',
      ...config
    };

    // Initialize network state / 初始化网络状态
    this.networkState = {
      networkId: process.env.NETWORK_ID || 'titanchain-mainnet',
      genesisHash: '',
      maxBlockHeight: 0,
      totalPeers: 0,
      healthyPeers: 0,
      averageLatency: 0,
      lastUpdated: Date.now(),
      isPartitioned: false
    };

    console.log('🔍 Network Discovery Service initialized / 网络发现服务已初始化');
    console.log(`📊 Discovery interval: ${this.config.discoveryInterval}ms`);
    console.log(`❤️ Health check interval: ${this.config.healthCheckInterval}ms`);
    console.log(`👥 Max peers: ${this.config.maxPeers}`);
    console.log(`🌐 Bootstrap nodes: ${this.config.bootstrapNodes.length}`);
  }

  /**
   * Start network discovery / 启动网络发现
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('⚠️ Network discovery is already running / 网络发现已在运行');
      return;
    }

    console.log('\n🚀 Starting Network Discovery Service / 启动网络发现服务...');
    console.log('='.repeat(60));

    try {
      this.isRunning = true;

      // Initial discovery / 初始发现
      await this.performDiscovery();

      // Start periodic discovery / 启动定期发现
      this.discoveryTimer = setInterval(async () => {
        try {
          await this.performDiscovery();
        } catch (error) {
          console.error('❌ Discovery error / 发现错误:', error);
          this.emit('discoveryError', error);
        }
      }, this.config.discoveryInterval);

      // Start health checks / 启动健康检查
      this.healthCheckTimer = setInterval(async () => {
        try {
          await this.performHealthChecks();
        } catch (error) {
          console.error('❌ Health check error / 健康检查错误:', error);
          this.emit('healthCheckError', error);
        }
      }, this.config.healthCheckInterval);

      console.log('✅ Network Discovery Service started / 网络发现服务启动成功');
      this.emit('started');

    } catch (error) {
      console.error('❌ Failed to start Network Discovery Service / 网络发现服务启动失败:', error);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Stop network discovery / 停止网络发现
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('\n🛑 Stopping Network Discovery Service / 停止网络发现服务...');

    this.isRunning = false;

    if (this.discoveryTimer) {
      clearInterval(this.discoveryTimer);
      this.discoveryTimer = undefined;
    }

    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }

    console.log('✅ Network Discovery Service stopped / 网络发现服务已停止');
    this.emit('stopped');
  }

  /**
   * Perform network discovery / 执行网络发现
   */
  private async performDiscovery(): Promise<DiscoveryResult> {
    console.log('\n🔍 Performing network discovery / 执行网络发现...');

    const result: DiscoveryResult = {
      success: false,
      peersFound: 0,
      networkState: { ...this.networkState },
      errors: []
    };

    try {
      const discoveryTasks: Promise<PeerInfo[]>[] = [];

      // Discover from bootstrap nodes / 从引导节点发现
      if (this.config.bootstrapNodes.length > 0) {
        discoveryTasks.push(this.discoverFromBootstrapNodes());
      }

      // Local network discovery / 本地网络发现
      if (this.config.enableLocalDiscovery) {
        discoveryTasks.push(this.discoverLocalNetwork());
      }

      // DNS discovery / DNS发现
      if (this.config.enableDNSDiscovery) {
        discoveryTasks.push(this.discoverFromDNS());
      }

      // Execute all discovery tasks / 执行所有发现任务
      const discoveryResults = await Promise.allSettled(discoveryTasks);
      
      let totalNewPeers = 0;
      for (const taskResult of discoveryResults) {
        if (taskResult.status === 'fulfilled') {
          const peers = taskResult.value;
          for (const peer of peers) {
            if (this.addPeer(peer)) {
              totalNewPeers++;
            }
          }
        } else {
          result.errors.push(taskResult.reason?.message || 'Unknown discovery error');
        }
      }

      // Update network state / 更新网络状态
      this.updateNetworkState();

      // Find best peer / 找到最佳节点
      result.bestPeer = this.findBestPeer();
      result.peersFound = totalNewPeers;
      result.success = this.peers.size > 0;
      result.networkState = { ...this.networkState };

      console.log(`✅ Discovery completed: ${totalNewPeers} new peers, ${this.peers.size} total / 发现完成: ${totalNewPeers}个新节点，总计${this.peers.size}个`);

      // Emit discovery event / 发出发现事件
      this.emit('discoveryCompleted', result);

      return result;

    } catch (error) {
      console.error('❌ Network discovery failed / 网络发现失败:', error);
      result.errors.push(error.message);
      this.emit('discoveryError', error);
      return result;
    }
  }

  /**
   * Discover from bootstrap nodes / 从引导节点发现
   */
  private async discoverFromBootstrapNodes(): Promise<PeerInfo[]> {
    console.log(`🔗 Discovering from ${this.config.bootstrapNodes.length} bootstrap nodes / 从${this.config.bootstrapNodes.length}个引导节点发现...`);

    const peers: PeerInfo[] = [];
    const promises = this.config.bootstrapNodes.map(async (nodeAddress) => {
      try {
        const peer = await this.queryPeerInfo(nodeAddress);
        if (peer) {
          peers.push(peer);
          
          // Get additional peers from this node / 从此节点获取额外的节点
          const additionalPeers = await this.getPeerList(nodeAddress);
          peers.push(...additionalPeers);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to connect to bootstrap node ${nodeAddress}:`, error.message);
      }
    });

    await Promise.allSettled(promises);
    console.log(`📊 Found ${peers.length} peers from bootstrap nodes / 从引导节点发现${peers.length}个节点`);
    return peers;
  }

  /**
   * Discover local network / 发现本地网络
   */
  private async discoverLocalNetwork(): Promise<PeerInfo[]> {
    console.log('🏠 Scanning local network for peers / 扫描本地网络寻找节点...');

    const peers: PeerInfo[] = [];
    const localIPs = await this.getLocalNetworkIPs();

    const scanPromises: Promise<void>[] = [];
    
    for (const ip of localIPs) {
      for (const port of this.config.networkScanPorts) {
        scanPromises.push(
          this.scanPeer(ip, port).then(peer => {
            if (peer) peers.push(peer);
          }).catch(() => {
            // Ignore scan errors / 忽略扫描错误
          })
        );
      }
    }

    // Limit concurrent scans / 限制并发扫描
    const batchSize = 20;
    for (let i = 0; i < scanPromises.length; i += batchSize) {
      const batch = scanPromises.slice(i, i + batchSize);
      await Promise.allSettled(batch);
    }

    console.log(`📊 Found ${peers.length} peers on local network / 在本地网络发现${peers.length}个节点`);
    return peers;
  }

  /**
   * Discover from DNS / 从DNS发现
   */
  private async discoverFromDNS(): Promise<PeerInfo[]> {
    console.log('🌐 Discovering peers from DNS / 从DNS发现节点...');

    // This would implement DNS-based peer discovery
    // For now, return empty array
    return [];
  }

  /**
   * Query peer information / 查询节点信息
   */
  private async queryPeerInfo(address: string): Promise<PeerInfo | null> {
    try {
      const startTime = Date.now();
      
      // Parse address / 解析地址
      const [host, portStr] = address.split(':');
      const port = parseInt(portStr) || 4003;

      // This would implement actual HTTP/RPC call to peer
      // For now, simulate the call
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 100));

      const latency = Date.now() - startTime;

      // Mock peer info for testing / 测试用的模拟节点信息
      const peerInfo: PeerInfo = {
        nodeId: `peer-${crypto.randomBytes(4).toString('hex')}`,
        address: host,
        port: port,
        blockHeight: Math.floor(Math.random() * 1000) + 1,
        genesisHash: '0x' + crypto.randomBytes(32).toString('hex'),
        networkId: this.networkState.networkId,
        version: '1.0.0',
        lastSeen: Date.now(),
        latency: latency,
        isHealthy: true,
        capabilities: ['sync', 'mining', 'api']
      };

      return peerInfo;

    } catch (error) {
      console.warn(`⚠️ Failed to query peer ${address}:`, error.message);
      return null;
    }
  }

  /**
   * Get peer list from node / 从节点获取节点列表
   */
  private async getPeerList(address: string): Promise<PeerInfo[]> {
    try {
      // This would implement actual API call to get peer list
      // For now, return empty array
      return [];
    } catch (error) {
      console.warn(`⚠️ Failed to get peer list from ${address}:`, error.message);
      return [];
    }
  }

  /**
   * Scan individual peer / 扫描单个节点
   */
  private async scanPeer(host: string, port: number): Promise<PeerInfo | null> {
    const address = `${host}:${port}`;
    return await this.queryPeerInfo(address);
  }

  /**
   * Get local network IP addresses / 获取本地网络IP地址
   */
  private async getLocalNetworkIPs(): Promise<string[]> {
    // This would implement actual network interface scanning
    // For now, return common local network ranges
    const baseIPs: string[] = [];
    
    // Common local network ranges / 常见本地网络范围
    const networks = [
      '192.168.1', '192.168.0', '10.0.0', '172.16.0'
    ];

    for (const network of networks) {
      // Scan first 10 IPs in each network / 扫描每个网络的前10个IP
      for (let i = 1; i <= 10; i++) {
        baseIPs.push(`${network}.${i}`);
      }
    }

    return baseIPs;
  }

  /**
   * Add peer to the list / 添加节点到列表
   */
  private addPeer(peer: PeerInfo): boolean {
    const existingPeer = this.peers.get(peer.nodeId);
    
    if (existingPeer) {
      // Update existing peer / 更新现有节点
      existingPeer.blockHeight = peer.blockHeight;
      existingPeer.lastSeen = peer.lastSeen;
      existingPeer.latency = peer.latency;
      existingPeer.isHealthy = peer.isHealthy;
      return false; // Not a new peer
    } else {
      // Add new peer / 添加新节点
      if (this.peers.size < this.config.maxPeers) {
        this.peers.set(peer.nodeId, peer);
        console.log(`➕ Added new peer: ${peer.nodeId} (${peer.address}:${peer.port}) / 添加新节点: ${peer.nodeId}`);
        this.emit('peerAdded', peer);
        return true; // New peer added
      } else {
        console.warn(`⚠️ Max peers limit reached (${this.config.maxPeers}) / 达到最大节点限制`);
        return false;
      }
    }
  }

  /**
   * Remove peer from the list / 从列表中移除节点
   */
  private removePeer(nodeId: string): void {
    const peer = this.peers.get(nodeId);
    if (peer) {
      this.peers.delete(nodeId);
      console.log(`➖ Removed peer: ${nodeId} / 移除节点: ${nodeId}`);
      this.emit('peerRemoved', peer);
    }
  }

  /**
   * Update network state / 更新网络状态
   */
  private updateNetworkState(): void {
    const healthyPeers = Array.from(this.peers.values()).filter(peer => peer.isHealthy);
    
    this.networkState.totalPeers = this.peers.size;
    this.networkState.healthyPeers = healthyPeers.length;
    this.networkState.lastUpdated = Date.now();

    if (healthyPeers.length > 0) {
      // Update max block height / 更新最大区块高度
      this.networkState.maxBlockHeight = Math.max(...healthyPeers.map(peer => peer.blockHeight));
      
      // Update average latency / 更新平均延迟
      this.networkState.averageLatency = healthyPeers.reduce((sum, peer) => sum + peer.latency, 0) / healthyPeers.length;
      
      // Update genesis hash from majority / 从多数节点更新创世区块哈希
      const genesisHashes = healthyPeers.map(peer => peer.genesisHash);
      const hashCounts = new Map<string, number>();
      genesisHashes.forEach(hash => {
        hashCounts.set(hash, (hashCounts.get(hash) || 0) + 1);
      });
      
      let maxCount = 0;
      let majorityHash = '';
      hashCounts.forEach((count, hash) => {
        if (count > maxCount) {
          maxCount = count;
          majorityHash = hash;
        }
      });
      
      this.networkState.genesisHash = majorityHash;
    }

    // Check for network partition / 检查网络分区
    this.networkState.isPartitioned = this.detectNetworkPartition();

    // Emit network state update / 发出网络状态更新事件
    this.emit('networkStateUpdated', this.networkState);
  }

  /**
   * Detect network partition / 检测网络分区
   */
  private detectNetworkPartition(): boolean {
    const healthyPeers = Array.from(this.peers.values()).filter(peer => peer.isHealthy);
    
    if (healthyPeers.length < this.config.minHealthyPeers) {
      return true; // Too few healthy peers
    }

    // Check for significant block height differences / 检查显著的区块高度差异
    if (healthyPeers.length > 1) {
      const heights = healthyPeers.map(peer => peer.blockHeight);
      const maxHeight = Math.max(...heights);
      const minHeight = Math.min(...heights);
      
      // If height difference is more than 10 blocks, consider it a partition
      if (maxHeight - minHeight > 10) {
        return true;
      }
    }

    return false;
  }

  /**
   * Perform health checks / 执行健康检查
   */
  private async performHealthChecks(): Promise<void> {
    const now = Date.now();
    const peersToCheck = Array.from(this.peers.values());

    console.log(`❤️ Performing health checks on ${peersToCheck.length} peers / 对${peersToCheck.length}个节点执行健康检查...`);

    const healthCheckPromises = peersToCheck.map(async (peer) => {
      try {
        // Check if peer is too old / 检查节点是否过期
        if (now - peer.lastSeen > this.config.peerTimeout) {
          peer.isHealthy = false;
          console.log(`⚠️ Peer ${peer.nodeId} timed out / 节点${peer.nodeId}超时`);
          return;
        }

        // Perform actual health check / 执行实际健康检查
        const updatedPeer = await this.queryPeerInfo(`${peer.address}:${peer.port}`);
        if (updatedPeer) {
          peer.blockHeight = updatedPeer.blockHeight;
          peer.lastSeen = updatedPeer.lastSeen;
          peer.latency = updatedPeer.latency;
          peer.isHealthy = true;
        } else {
          peer.isHealthy = false;
        }

      } catch (error) {
        peer.isHealthy = false;
        console.warn(`⚠️ Health check failed for peer ${peer.nodeId}:`, error.message);
      }
    });

    await Promise.allSettled(healthCheckPromises);

    // Remove unhealthy peers that have been offline too long / 移除长时间离线的不健康节点
    const peersToRemove: string[] = [];
    this.peers.forEach((peer, nodeId) => {
      if (!peer.isHealthy && now - peer.lastSeen > this.config.peerTimeout * 2) {
        peersToRemove.push(nodeId);
      }
    });

    peersToRemove.forEach(nodeId => this.removePeer(nodeId));

    // Update network state after health checks / 健康检查后更新网络状态
    this.updateNetworkState();

    const healthyCount = Array.from(this.peers.values()).filter(peer => peer.isHealthy).length;
    console.log(`✅ Health check completed: ${healthyCount}/${this.peers.size} peers healthy / 健康检查完成: ${healthyCount}/${this.peers.size}个节点健康`);
  }

  /**
   * Find best peer for synchronization / 找到最佳同步节点
   */
  private findBestPeer(): PeerInfo | undefined {
    const healthyPeers = Array.from(this.peers.values()).filter(peer => peer.isHealthy);
    
    if (healthyPeers.length === 0) {
      return undefined;
    }

    // Sort by block height (descending) and latency (ascending) / 按区块高度（降序）和延迟（升序）排序
    healthyPeers.sort((a, b) => {
      if (a.blockHeight !== b.blockHeight) {
        return b.blockHeight - a.blockHeight; // Higher block height first
      }
      return a.latency - b.latency; // Lower latency first
    });

    return healthyPeers[0];
  }

  /**
   * Parse port range from string / 从字符串解析端口范围
   */
  private parsePortRange(portRange: string): number[] {
    const ports: number[] = [];
    
    if (portRange.includes('-')) {
      const [start, end] = portRange.split('-').map(p => parseInt(p.trim()));
      for (let port = start; port <= end; port++) {
        ports.push(port);
      }
    } else {
      ports.push(parseInt(portRange));
    }

    return ports;
  }

  /**
   * Parse bootstrap nodes from string / 从字符串解析引导节点
   */
  private parseBootstrapNodes(bootstrapNodesStr: string): string[] {
    if (!bootstrapNodesStr) return [];
    return bootstrapNodesStr.split(',').map(node => node.trim()).filter(node => node.length > 0);
  }

  /**
   * Get all peers / 获取所有节点
   */
  getPeers(): PeerInfo[] {
    return Array.from(this.peers.values());
  }

  /**
   * Get healthy peers / 获取健康节点
   */
  getHealthyPeers(): PeerInfo[] {
    return Array.from(this.peers.values()).filter(peer => peer.isHealthy);
  }

  /**
   * Get network state / 获取网络状态
   */
  getNetworkState(): NetworkState {
    return { ...this.networkState };
  }

  /**
   * Get best peer / 获取最佳节点
   */
  getBestPeer(): PeerInfo | undefined {
    return this.findBestPeer();
  }

  /**
   * Check if network exists / 检查网络是否存在
   */
  hasNetwork(): boolean {
    return this.getHealthyPeers().length > 0;
  }

  /**
   * Get discovery configuration / 获取发现配置
   */
  getConfig(): DiscoveryConfig {
    return { ...this.config };
  }
}

/**
 * Main execution function / 主执行函数
 */
async function main() {
  console.log('🔍 TitanChain Network Discovery Service / TitanChain网络发现服务');
  console.log('='.repeat(60));

  try {
    const discovery = new NetworkDiscoveryService();

    // Setup event listeners / 设置事件监听器
    discovery.on('discoveryCompleted', (result: DiscoveryResult) => {
      console.log(`\n📊 Discovery Result / 发现结果:`);
      console.log(`   ✅ Success: ${result.success} / 成功: ${result.success}`);
      console.log(`   👥 Peers Found: ${result.peersFound} / 发现节点: ${result.peersFound}`);
      console.log(`   🎯 Best Peer: ${result.bestPeer?.nodeId || 'None'} / 最佳节点: ${result.bestPeer?.nodeId || '无'}`);
      console.log(`   📊 Network Height: ${result.networkState.maxBlockHeight} / 网络高度: ${result.networkState.maxBlockHeight}`);
    });

    discovery.on('peerAdded', (peer: PeerInfo) => {
      console.log(`➕ New peer discovered: ${peer.nodeId} (${peer.address}:${peer.port}) / 发现新节点: ${peer.nodeId}`);
    });

    discovery.on('networkStateUpdated', (state: NetworkState) => {
      console.log(`🌐 Network state updated: ${state.healthyPeers}/${state.totalPeers} healthy peers / 网络状态更新: ${state.healthyPeers}/${state.totalPeers}个健康节点`);
    });

    await discovery.start();

    // Keep running / 保持运行
    console.log('\n🔄 Network Discovery Service is running... Press Ctrl+C to stop / 网络发现服务正在运行... 按Ctrl+C停止');

    // Graceful shutdown / 优雅关闭
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down Network Discovery Service / 关闭网络发现服务...');
      await discovery.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error('💥 Network Discovery Service failed / 网络发现服务失败:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly / 如果直接执行此文件则运行
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { 
  NetworkDiscoveryService, 
  PeerInfo, 
  NetworkState, 
  DiscoveryConfig, 
  DiscoveryResult 
};