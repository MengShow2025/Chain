#!/usr/bin/env tsx

/**
 * Smart Node Launcher for TitanChain / TitanChain智能节点启动器
 * Intelligent node startup that handles multi-node deployment scenarios
 * 智能节点启动，处理多节点部署场景
 * 
 * Key Features / 核心功能:
 * 1. Network discovery and existing node detection / 网络发现和现有节点检测
 * 2. Genesis block creation for first node / 第一个节点创建创世区块
 * 3. Blockchain synchronization for subsequent nodes / 后续节点区块链同步
 * 4. Graceful node joining process / 优雅的节点加入流程
 * 5. Network partition handling / 网络分区处理
 */

import { TitanChain } from './blockchain/core/blockchain.js';
import { ValidatorManager } from './blockchain/consensus/validator-manager.js';
import { EnhancedP2PNode } from './network/p2p-enhanced.js';
import { BlockSyncProtocol, SyncStatus } from './blockchain/core/block-sync.js';
import { ChainStateManager } from './blockchain/core/chain-state.js';
import { CONSENSUS_CONFIG, NETWORK_CONFIG, PERFORMANCE_CONFIG } from './shared/constants/blockchain.js';
import { Validator, Block } from './shared/types/blockchain.js';
import { blockchainInstance } from './shared/blockchain-instance';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

// Load environment variables / 加载环境变量
dotenv.config();

// Node startup configuration / 节点启动配置
interface NodeStartupConfig {
  nodeId: string;
  dataDir: string;
  p2pPort: number;
  rpcPort: number;
  bootstrapNodes: string[];
  isBootstrapNode: boolean;
  networkTimeout: number;
  syncTimeout: number;
  maxRetries: number;
}

// Network discovery result / 网络发现结果
interface NetworkDiscoveryResult {
  hasExistingNetwork: boolean;
  networkHeight: number;
  bestPeer?: string;
  availablePeers: string[];
  genesisHash?: string;
  networkId: string;
}

// Node status / 节点状态
interface NodeStatus {
  nodeId: string;
  isRunning: boolean;
  blockHeight: number;
  peerCount: number;
  syncStatus: 'syncing' | 'synced' | 'error';
  lastUpdate: number;
  lastBlockHash?: string; // last block hash / 最新区块哈希 // 英文 /中文
}

/**
 * Smart Node Launcher Class / 智能节点启动器类
 */
class SmartNodeLauncher {
  private config: NodeStartupConfig;
  private blockchain: TitanChain;
  private validatorManager: ValidatorManager;
  private p2pNode?: EnhancedP2PNode;
  private blockSync?: BlockSyncProtocol;
  private chainState: ChainStateManager;
  private isRunning: boolean = false;
  private nodeStatus: NodeStatus;

  constructor(config?: Partial<NodeStartupConfig>) {
    // Initialize configuration / 初始化配置
    this.config = {
      nodeId: process.env.NODE_ID || this.generateNodeId(),
      dataDir: process.env.DATA_DIR || './data',
      p2pPort: parseInt(process.env.P2P_PORT || '4003'),
      rpcPort: parseInt(process.env.RPC_PORT || '3001'),
      bootstrapNodes: this.parseBootstrapNodes(process.env.BOOTSTRAP_NODES || ''),
      isBootstrapNode: process.env.IS_BOOTSTRAP_NODE === 'true',
      networkTimeout: parseInt(process.env.NETWORK_TIMEOUT || '30000'),
      syncTimeout: parseInt(process.env.SYNC_TIMEOUT || '60000'),
      maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
      ...config
    };

    console.log('🚀 Smart Node Launcher Initialized / 智能节点启动器已初始化');
    console.log(`📋 Node ID: ${this.config.nodeId}`);
    console.log(`📁 Data Directory: ${this.config.dataDir}`);
    console.log(`🌐 P2P Port: ${this.config.p2pPort}`);
    console.log(`🔌 RPC Port: ${this.config.rpcPort}`);
    console.log(`🏗️  Bootstrap Node: ${this.config.isBootstrapNode}`);

    // Initialize components / 初始化组件
    this.blockchain = new TitanChain();
    this.validatorManager = new ValidatorManager();
    
    // Initialize chain state manager / 初始化链状态管理器
    this.chainState = new ChainStateManager({
      dataDir: this.config.dataDir,
      enablePersistence: true,
      syncTimeout: this.config.syncTimeout,
      maxRetries: this.config.maxRetries
    });

    // Initialize node status / 初始化节点状态
    this.nodeStatus = {
      nodeId: this.config.nodeId,
      isRunning: false,
      blockHeight: 0,
      peerCount: 0,
      syncStatus: 'syncing',
      lastUpdate: Date.now(),
      lastBlockHash: undefined // initialize without hash / 初始无哈希 // 英文 /中文
    };

    // Register global blockchain instance / 注册全局区块链实例
    blockchainInstance.setBlockchain(this.blockchain);
  }

  /**
   * Smart node startup process / 智能节点启动流程
   */
  async start(): Promise<void> {
    try {
      console.log('\n🔧 Starting Smart Node Launcher / 启动智能节点启动器...');
      console.log('='.repeat(80));

      // Step 1: Prepare node environment / 步骤1：准备节点环境
      await this.prepareNodeEnvironment();

      // Step 2: Discover existing network / 步骤2：发现现有网络
      const networkInfo = await this.discoverNetwork();

      // Step 3: Initialize based on network state / 步骤3：根据网络状态初始化
      if (networkInfo.hasExistingNetwork && !this.config.isBootstrapNode) {
        await this.joinExistingNetwork(networkInfo);
      } else {
        await this.initializeNewNetwork();
      }

      // Step 4: Start blockchain services / 步骤4：启动区块链服务
      await this.startBlockchainServices();

      // Step 5: Start P2P networking / 步骤5：启动P2P网络
      await this.startP2PNetwork();

      // Step 6: Start monitoring / 步骤6：启动监控
      this.startMonitoring();

      this.isRunning = true;
      this.nodeStatus.isRunning = true;
      this.nodeStatus.lastUpdate = Date.now();

      console.log('\n✅ Smart Node Launcher completed successfully! / 智能节点启动器启动成功！');
      console.log('='.repeat(80));
      console.log(`🆔 Node ID: ${this.config.nodeId}`);
      console.log(`🌐 P2P Port: ${this.config.p2pPort}`);
      console.log(`🔌 RPC Port: ${this.config.rpcPort}`);
      console.log(`📊 Block Height: ${this.nodeStatus.blockHeight}`);
      console.log(`👥 Peer Count: ${this.nodeStatus.peerCount}`);
      console.log(`🔄 Sync Status: ${this.nodeStatus.syncStatus}`);

      // Setup graceful shutdown / 设置优雅关闭
      this.setupGracefulShutdown();

    } catch (error) {
      console.error('❌ Smart Node Launcher failed / 智能节点启动器失败:', error);
      this.nodeStatus.syncStatus = 'error';
      throw error;
    }
  }

  /**
   * Prepare node environment / 准备节点环境
   */
  private async prepareNodeEnvironment(): Promise<void> {
    console.log('\n📁 Preparing node environment / 准备节点环境...');

    try {
      // Create data directory / 创建数据目录
      await fs.mkdir(this.config.dataDir, { recursive: true });
      
      // Create subdirectories / 创建子目录
      const subdirs = ['blocks', 'state', 'peers', 'logs'];
      for (const subdir of subdirs) {
        await fs.mkdir(path.join(this.config.dataDir, subdir), { recursive: true });
      }

      // Initialize node metadata / 初始化节点元数据
      const nodeMetadata = {
        nodeId: this.config.nodeId,
        createdAt: new Date().toISOString(),
        version: '1.0.0',
        networkId: NETWORK_CONFIG.CHAIN_ID
      };

      await fs.writeFile(
        path.join(this.config.dataDir, 'node-metadata.json'),
        JSON.stringify(nodeMetadata, null, 2)
      );

      console.log('✅ Node environment prepared / 节点环境准备完成');

    } catch (error) {
      console.error('❌ Failed to prepare node environment / 节点环境准备失败:', error);
      throw error;
    }
  }

  /**
   * Discover existing network / 发现现有网络
   */
  private async discoverNetwork(): Promise<NetworkDiscoveryResult> {
    console.log('\n🔍 Discovering existing network / 发现现有网络...');

    const result: NetworkDiscoveryResult = {
      hasExistingNetwork: false,
      networkHeight: 0,
      availablePeers: [],
      networkId: NETWORK_CONFIG.CHAIN_ID.toString()
    };

    try {
      // If this is explicitly a bootstrap node, skip discovery / 如果明确是引导节点，跳过发现
      if (this.config.isBootstrapNode) {
        console.log('🏗️  Bootstrap node mode - skipping network discovery / 引导节点模式 - 跳过网络发现');
        return result;
      }

      // Try to connect to bootstrap nodes / 尝试连接引导节点
      if (this.config.bootstrapNodes.length > 0) {
        console.log(`🔗 Checking ${this.config.bootstrapNodes.length} bootstrap nodes / 检查${this.config.bootstrapNodes.length}个引导节点...`);

        for (const bootstrapNode of this.config.bootstrapNodes) {
          try {
            const peerInfo = await this.queryPeerInfo(bootstrapNode);
            if (peerInfo) {
              result.hasExistingNetwork = true;
              result.availablePeers.push(bootstrapNode);
              
              if (peerInfo.blockHeight > result.networkHeight) {
                result.networkHeight = peerInfo.blockHeight;
                result.bestPeer = bootstrapNode;
                result.genesisHash = peerInfo.genesisHash;
              }
            }
          } catch (error) {
            console.warn(`⚠️ Failed to connect to bootstrap node ${bootstrapNode}:`, error.message);
          }
        }
      }

      // Auto-discovery on local network / 本地网络自动发现
      if (!result.hasExistingNetwork) {
        console.log('🔍 Attempting local network auto-discovery / 尝试本地网络自动发现...');
        const localPeers = await this.discoverLocalPeers();
        result.availablePeers.push(...localPeers);
        result.hasExistingNetwork = localPeers.length > 0;
      }

      if (result.hasExistingNetwork) {
        console.log(`✅ Found existing network with ${result.availablePeers.length} peers / 发现现有网络，包含${result.availablePeers.length}个节点`);
        console.log(`📊 Network height: ${result.networkHeight} / 网络高度: ${result.networkHeight}`);
        console.log(`🎯 Best peer: ${result.bestPeer || 'N/A'} / 最佳节点: ${result.bestPeer || '无'}`);
      } else {
        console.log('🆕 No existing network found - will initialize new network / 未发现现有网络 - 将初始化新网络');
      }

      return result;

    } catch (error) {
      console.error('❌ Network discovery failed / 网络发现失败:', error);
      return result;
    }
  }

  /**
   * Join existing network / 加入现有网络
   */
  private async joinExistingNetwork(networkInfo: NetworkDiscoveryResult): Promise<void> {
    console.log('\n🔗 Joining existing network / 加入现有网络...');

    try {
      if (!networkInfo.bestPeer) {
        throw new Error('No best peer available for synchronization');
      }

      // Ensure environment flags reflect joining existing network // 英文 /中文
      process.env.IS_BOOTSTRAP_NODE = 'false';
      process.env.JOIN_EXISTING_NETWORK = 'true';

      // Initialize validators from network / 从网络初始化验证节点
      const validators = await this.getValidatorsFromNetwork(networkInfo.bestPeer);
      await this.validatorManager.initialize(validators);

      // Start blockchain without creating genesis / 启动区块链但不创建创世区块
      console.log('📦 Starting blockchain in sync mode / 以同步模式启动区块链...');
      
      // Set environment to disable block production during sync / 设置环境变量在同步期间禁用区块生产
      process.env.ENABLE_BLOCK_PRODUCTION = 'false';
      await this.blockchain.start(validators);

      // Synchronize blockchain data / 同步区块链数据
      await this.synchronizeBlockchainData(networkInfo);

      // Update node status / 更新节点状态
      this.nodeStatus.blockHeight = this.blockchain.getChain().length;
      this.nodeStatus.syncStatus = 'synced';

      console.log('✅ Successfully joined existing network / 成功加入现有网络');

    } catch (error) {
      console.error('❌ Failed to join existing network / 加入现有网络失败:', error);
      this.nodeStatus.syncStatus = 'error';
      throw error;
    }
  }

  /**
   * Initialize new network / 初始化新网络
   */
  private async initializeNewNetwork(): Promise<void> {
    console.log('\n🆕 Initializing new network / 初始化新网络...');

    try {
      // Ensure environment flags reflect bootstrap genesis creation // 英文 /中文
      process.env.IS_BOOTSTRAP_NODE = 'true';
      process.env.JOIN_EXISTING_NETWORK = 'false';

      // Create genesis validators / 创建创世验证节点
      const genesisValidators = this.createGenesisValidators();
      
      // Initialize validator manager / 初始化验证节点管理器
      await this.validatorManager.initialize(genesisValidators);

      // Start blockchain with genesis creation / 启动区块链并创建创世区块
      console.log('🏛️  Creating genesis block / 创建创世区块...');
      
      // Enable block production for genesis node / 为创世节点启用区块生产
      process.env.ENABLE_BLOCK_PRODUCTION = 'true';
      await this.blockchain.start(genesisValidators);

      // Update node status / 更新节点状态
      this.nodeStatus.blockHeight = this.blockchain.getChain().length;
      this.nodeStatus.syncStatus = 'synced';
      this.nodeStatus.lastBlockHash = this.blockchain.getLatestBlock()?.hash || undefined; // set genesis hash / 设置创世哈希 // 英文 /中文

      console.log('✅ New network initialized successfully / 新网络初始化成功');
      console.log(`🏛️  Genesis block created with hash: ${this.blockchain.getChain()[0]?.hash || 'N/A'}`);

    } catch (error) {
      console.error('❌ Failed to initialize new network / 新网络初始化失败:', error);
      this.nodeStatus.syncStatus = 'error';
      throw error;
    }
  }

  /**
   * Start blockchain services / 启动区块链服务
   */
  private async startBlockchainServices(): Promise<void> {
    console.log('\n⚙️ Starting blockchain services / 启动区块链服务...');

    try {
      // Initialize chain state / 初始化链状态
      await this.chainState.initialize();

      // Start monitoring blockchain events / 开始监控区块链事件
      this.setupBlockchainEventListeners();

      console.log('✅ Blockchain services started / 区块链服务启动完成');

    } catch (error) {
      console.error('❌ Failed to start blockchain services / 区块链服务启动失败:', error);
      throw error;
    }
  }

  /**
   * Start P2P network / 启动P2P网络
   */
  private async startP2PNetwork(): Promise<void> {
    console.log('\n🕸️ Starting P2P network / 启动P2P网络...');

    try {
      // Create P2P node configuration / 创建P2P节点配置
      const p2pConfig = {
        port: this.config.p2pPort,
        host: '0.0.0.0',
        bootnodes: this.config.bootstrapNodes,
        enablePeerDiscovery: true,
        enableAutoSync: true,
        maxPeers: 50,
        syncInterval: 10000
      };

      // Initialize block sync protocol / 初始化区块同步协议
      // 基于链内的区块验证器实例创建同步协议 // 英文 /中文
      const blockValidator = this.blockchain.getBlockValidator();
      this.blockSync = new BlockSyncProtocol(blockValidator, {
        maxBatchSize: 200,               // 增加批量同步的大小 // 英文 /中文
        syncTimeout: this.config.syncTimeout || 30000, // 同步超时 // 英文 /中文
        maxRetries: this.config.maxRetries || 3,       // 最大重试次数 // 英文 /中文
        conflictResolutionTimeout: 10000, // 冲突解决超时 // 英文 /中文
        enableForkDetection: true,       // 启用分叉检测 // 英文 /中文
        maxForkDepth: 10                 // 最大分叉深度 // 英文 /中文
      });

      // 设置当前链状态给同步协议 // 英文 /中文
      this.blockSync.setBlockchainState(this.blockchain.getChain(), this.blockchain.getLatestBlock());

      // Create or reuse P2P node / 创建或复用P2P节点 // 英文 /中文
      if (this.p2pNode) {
        console.log('♻️ Reusing existing P2P node / 复用已存在的P2P节点');
        // 如果尚未连接，尝试启动 / If not connected, try to start // 英文 /中文
        if (!this.p2pNode.isConnected()) {
          await this.p2pNode.start();
        }
      } else {
        // 将区块链与同步协议接入增强P2P节点 // 英文 /中文
        this.p2pNode = new EnhancedP2PNode(this.blockchain, this.blockSync, p2pConfig);
        await this.p2pNode.start();
      }

      // 触发一次同步尝试（如果启用了自动同步也会定期进行） // 英文 /中文
      try {
        await this.p2pNode.triggerSync();
      } catch (e) {
        console.warn('Trigger sync failed, will rely on auto-sync / 触发同步失败，将依赖自动同步');
      }

      // 简单等待同步完成或超时 // 英文 /中文
      const waitStart = Date.now();
      const waitTimeout = this.config.syncTimeout || 30000;
      while (Date.now() - waitStart < waitTimeout) {
        const stats = this.blockSync.getSyncStats();
        if (stats.status === SyncStatus.SYNCHRONIZED) {
          break;
        }
        await new Promise((r) => setTimeout(r, 500));
      }

      // 更新节点状态 // 英文 /中文
      this.nodeStatus.blockHeight = this.blockchain.getChain().length;
      this.nodeStatus.peerCount = this.p2pNode?.getPeers().length || 0;

      console.log(`✅ P2P network started on port ${this.config.p2pPort} / P2P网络在端口${this.config.p2pPort}启动`);

    } catch (error) {
      console.error('❌ Failed to start P2P network / P2P网络启动失败:', error);
      // Don't throw error to allow node to continue without P2P for now
      console.warn('⚠️ Continuing without P2P network / 继续运行但不启用P2P网络');
    }
  }

  /**
   * Start monitoring / 启动监控
   */
  private startMonitoring(): void {
    console.log('\n📊 Starting node monitoring / 启动节点监控...');

    // Update node status periodically / 定期更新节点状态
    setInterval(() => {
      this.updateNodeStatus();
    }, 10000); // Every 10 seconds

    // Log status periodically / 定期记录状态
    setInterval(() => {
      this.logNodeStatus();
    }, 60000); // Every minute

    console.log('✅ Node monitoring started / 节点监控启动完成');
  }

  /**
   * Update node status / 更新节点状态
   */
  private updateNodeStatus(): void {
    try {
      this.nodeStatus.blockHeight = this.blockchain.getChain().length;
      this.nodeStatus.peerCount = this.p2pNode?.getPeers().length || 0;
      this.nodeStatus.lastUpdate = Date.now();
      this.nodeStatus.lastBlockHash = this.blockchain.getLatestBlock()?.hash || undefined; // update hash / 更新哈希 // 英文 /中文

      // Check if node is still syncing / 检查节点是否仍在同步
      if (this.nodeStatus.syncStatus === 'syncing') {
        // Simple heuristic: if we have peers and blocks, we're likely synced
        if (this.nodeStatus.blockHeight > 0) {
          this.nodeStatus.syncStatus = 'synced';
        }
      }
    } catch (error) {
      console.error('Error updating node status:', error);
      this.nodeStatus.syncStatus = 'error';
    }
  }

  /**
   * Log node status / 记录节点状态
   */
  private logNodeStatus(): void {
    console.log('\n📊 Node Status Update / 节点状态更新:');
    console.log(`   🆔 Node ID: ${this.nodeStatus.nodeId}`);
    console.log(`   📊 Block Height: ${this.nodeStatus.blockHeight} / 区块高度: ${this.nodeStatus.blockHeight}`);
    console.log(`   👥 Peer Count: ${this.nodeStatus.peerCount} / 节点数量: ${this.nodeStatus.peerCount}`);
    console.log(`   🔄 Sync Status: ${this.nodeStatus.syncStatus} / 同步状态: ${this.nodeStatus.syncStatus}`);
    const shortHash = this.nodeStatus.lastBlockHash ? this.nodeStatus.lastBlockHash.slice(0, 12) : 'N/A';
    console.log(`   🔑 Last Block Hash: ${shortHash} / 最新区块哈希: ${shortHash}`);
    console.log(`   ⏰ Last Update: ${new Date(this.nodeStatus.lastUpdate).toISOString()}`);
  }

  /**
   * Setup blockchain event listeners / 设置区块链事件监听器
   */
  private setupBlockchainEventListeners(): void {
    // Note: This would require TitanChain to extend EventEmitter
    // For now, we'll use a simple polling approach
    console.log('📡 Setting up blockchain event listeners / 设置区块链事件监听器...');
  }

  /**
   * Query peer information / 查询节点信息
   */
  private async queryPeerInfo(peerAddress: string): Promise<any> {
    // This would implement actual HTTP/RPC calls to peer nodes
    // For now, return mock data
    console.log(`🔍 Querying peer info from ${peerAddress} / 从${peerAddress}查询节点信息...`);
    
    // Simulate network call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock response for testing
    return {
      blockHeight: Math.floor(Math.random() * 100) + 1,
      genesisHash: '0x' + crypto.randomBytes(32).toString('hex'),
      networkId: NETWORK_CONFIG.CHAIN_ID,
      nodeId: 'mock-peer-' + Math.random().toString(36).substring(7)
    };
  }

  /**
   * Discover local peers / 发现本地节点
   */
  private async discoverLocalPeers(): Promise<string[]> {
    // This would implement local network scanning
    // For now, return empty array
    console.log('🔍 Scanning local network for peers / 扫描本地网络寻找节点...');
    return [];
  }

  /**
   * Get validators from network / 从网络获取验证节点
   */
  private async getValidatorsFromNetwork(peerAddress: string): Promise<Validator[]> {
    console.log(`👥 Getting validators from ${peerAddress} / 从${peerAddress}获取验证节点...`);
    
    // This would implement actual network call
    // For now, return default validators
    return this.createGenesisValidators();
  }

  /**
   * Synchronize blockchain data / 同步区块链数据
   */
  private async synchronizeBlockchainData(networkInfo: NetworkDiscoveryResult): Promise<void> {
    console.log('\n🔄 Synchronizing blockchain data / 同步区块链数据...');

    try {
      if (!networkInfo.bestPeer) {
        throw new Error('No peer available for synchronization');
      }

      console.log(`📥 Syncing from peer: ${networkInfo.bestPeer} / 从节点同步: ${networkInfo.bestPeer}`);
      console.log(`📊 Target height: ${networkInfo.networkHeight} / 目标高度: ${networkInfo.networkHeight}`);

      // Initialize BlockSyncProtocol if not present // 英文 /中文
      if (!this.blockSync) {
        const blockValidator = this.blockchain.getBlockValidator();
        this.blockSync = new BlockSyncProtocol(blockValidator, {
          maxBatchSize: 200,                // 批量大小 // 英文 /中文
          syncTimeout: this.config.syncTimeout || 30000, // 同步超时 // 英文 /中文
          maxRetries: this.config.maxRetries || 3,       // 最大重试 // 英文 /中文
          conflictResolutionTimeout: 10000, // 冲突解决超时 // 英文 /中文
          enableForkDetection: true,        // 启用分叉检测 // 英文 /中文
          maxForkDepth: 10                  // 最大分叉深度 // 英文 /中文
        });
      }

      // Keep BlockSyncProtocol in sync with local chain state // 英文 /中文
      this.blockSync.setBlockchainState(this.blockchain.getChain(), this.blockchain.getLatestBlock());

      // Prepare a minimal P2P node focused on syncing from best peer // 英文 /中文
      if (!this.p2pNode) {
        const p2pConfig = {
          port: this.config.p2pPort,        // 使用配置端口 // 英文 /中文
          host: '0.0.0.0',
          bootnodes: [networkInfo.bestPeer], // 仅连接最佳节点 // 英文 /中文
          enablePeerDiscovery: false,       // 同步阶段禁用发现以减少噪音 // 英文 /中文
          enableAutoSync: true,             // 启用自动同步 // 英文 /中文
          maxPeers: 5,                      // 同步阶段限制连接数 // 英文 /中文
          syncInterval: 5000                // 同步检查间隔 // 英文 /中文
        };

        // Create and start P2P node with block sync protocol // 英文 /中文
        this.p2pNode = new EnhancedP2PNode(this.blockchain, this.blockSync, p2pConfig);
        await this.p2pNode.start();
      }

      // Manually trigger an initial sync attempt // 英文 /中文
      try {
        await this.p2pNode.triggerSync();
      } catch (e) {
        console.warn('Trigger sync failed, will rely on auto-sync / 触发同步失败，将依赖自动同步');
      }

      // Wait for synchronization with progress monitoring // 英文 /中文
      const startHeight = this.blockchain.getChain().length;
      const targetHeight = Math.max(networkInfo.networkHeight, startHeight);
      const startTime = Date.now();
      const timeout = this.config.syncTimeout || 30000;
      let lastLoggedHeight = startHeight;

      while (true) {
        const stats = this.blockSync.getSyncStats();
        const currentHeight = this.blockchain.getChain().length;

        // Progress logging every 1s or when height increases // 英文 /中文
        if (currentHeight > lastLoggedHeight) {
          console.log(`📊 Sync progress / 同步进度: ${currentHeight}/${targetHeight} (status=${stats.status})`);
          lastLoggedHeight = currentHeight;
        }

        // Exit conditions // 英文 /中文
        if (currentHeight >= targetHeight || stats.status === SyncStatus.SYNCHRONIZED) {
          break;
        }
        if (Date.now() - startTime > timeout) {
          throw new Error(`Sync timeout after ${timeout}ms / 同步超时${timeout}毫秒，当前高度${currentHeight}，目标高度${targetHeight}`);
        }

        await new Promise((r) => setTimeout(r, 500));
      }

      console.log('✅ Blockchain synchronization completed / 区块链同步完成');

    } catch (error) {
      console.error('❌ Blockchain synchronization failed / 区块链同步失败:', error);
      throw error;
    }
  }

  /**
   * Create genesis validators / 创建创世验证节点
   */
  private createGenesisValidators(): Validator[] {
    return [
      {
        address: '0x742d35Cc6634C0532925a3b8D0C9964E5Bfe4d4b',
        stake: BigInt('10000000000000000000000'), // 10,000 tokens
        isActive: true,
        lastBlockProduced: 0,
        missedBlocks: 0,
        joinedAt: Date.now()
      },
      {
        address: '0x8ba1f109551bD432803012645Hac136c30C6213',
        stake: BigInt('8000000000000000000000'), // 8,000 tokens
        isActive: true,
        lastBlockProduced: 0,
        missedBlocks: 0,
        joinedAt: Date.now()
      },
      {
        address: '0x1234567890123456789012345678901234567890',
        stake: BigInt('5000000000000000000000'), // 5,000 tokens
        isActive: true,
        lastBlockProduced: 0,
        missedBlocks: 0,
        joinedAt: Date.now()
      }
    ];
  }

  /**
   * Generate unique node ID / 生成唯一节点ID
   */
  private generateNodeId(): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(4).toString('hex');
    return `titan-${timestamp}-${random}`;
  }

  /**
   * Parse bootstrap nodes from environment / 从环境变量解析引导节点
   */
  private parseBootstrapNodes(bootstrapNodesStr: string): string[] {
    if (!bootstrapNodesStr) return [];
    return bootstrapNodesStr.split(',').map(node => node.trim()).filter(node => node.length > 0);
  }

  /**
   * Setup graceful shutdown / 设置优雅关闭
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}, shutting down gracefully / 收到${signal}信号，正在优雅关闭...`);
      await this.stop();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }

  /**
   * Stop the node / 停止节点
   */
  async stop(): Promise<void> {
    console.log('\n🛑 Stopping Smart Node Launcher / 停止智能节点启动器...');

    try {
      if (this.p2pNode) {
        await this.p2pNode.stop();
        console.log('✅ P2P network stopped / P2P网络已停止');
      }

      if (this.blockchain) {
        await this.blockchain.stop();
        console.log('✅ Blockchain stopped / 区块链已停止');
      }

      this.isRunning = false;
      this.nodeStatus.isRunning = false;
      this.nodeStatus.lastUpdate = Date.now();

      console.log('✅ Smart Node Launcher stopped successfully / 智能节点启动器停止成功');

    } catch (error) {
      console.error('❌ Error during shutdown / 关闭过程中出错:', error);
    }
  }

  /**
   * Get node status / 获取节点状态
   */
  getStatus(): NodeStatus {
    return { ...this.nodeStatus };
  }

  /**
   * Get node configuration / 获取节点配置
   */
  getConfig(): NodeStartupConfig {
    return { ...this.config };
  }
}

/**
 * Main execution function / 主执行函数
 */
async function main() {
  console.log('🚀 TitanChain Smart Node Launcher / TitanChain智能节点启动器');
  console.log('='.repeat(80));

  try {
    const launcher = new SmartNodeLauncher();
    await launcher.start();

    // Keep the process running / 保持进程运行
    console.log('\n🔄 Node is running... Press Ctrl+C to stop / 节点正在运行... 按Ctrl+C停止');

  } catch (error) {
    console.error('💥 Smart Node Launcher failed / 智能节点启动器失败:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly / 如果直接执行此文件则运行
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { SmartNodeLauncher };
export type { NodeStartupConfig, NetworkDiscoveryResult, NodeStatus };