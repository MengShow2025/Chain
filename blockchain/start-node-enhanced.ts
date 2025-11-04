#!/usr/bin/env tsx

import { TitanChain } from './core/blockchain.js';
import { ValidatorManager } from './consensus/validator-manager.js';
import { EnhancedP2PNode } from '../network/p2p-enhanced.js';
import { BlockSyncProtocol } from './core/block-sync.js';
import { ChainStateManager } from './core/chain-state.js';
import { CONSENSUS_CONFIG, NETWORK_CONFIG, PERFORMANCE_CONFIG } from '../shared/constants/blockchain.js';
import { Validator } from '../shared/types/blockchain.js';
import { blockchainInstance } from '../shared/blockchain-instance';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables / 加载环境变量
dotenv.config();

/**
 * Enhanced TitanChain Node with P2P Block Synchronization / 增强的TitanChain节点，支持P2P区块同步
 * Supports multi-node deployment with automatic blockchain synchronization / 支持多节点部署和自动区块链同步
 */
class EnhancedTitanChainNode {
  private blockchain: TitanChain;
  private validatorManager: ValidatorManager;
  private p2pNode?: EnhancedP2PNode;
  private blockSync?: BlockSyncProtocol;
  private chainState?: ChainStateManager;
  private isRunning: boolean = false;
  private nodeId: string;
  private isFirstNode: boolean = false;

  constructor() {
    console.log('🚀 Initializing Enhanced TitanChain Node / 初始化增强TitanChain节点...');
    
    this.nodeId = this.generateNodeId();
    this.blockchain = new TitanChain();
    this.validatorManager = new ValidatorManager();
    
    // Initialize chain state manager / 初始化链状态管理器
    this.chainState = new ChainStateManager({
      dataDir: process.env.DATA_DIR || './data',
      enablePersistence: true,
      syncTimeout: 30000,
      maxRetries: 3
    });
    
    // Register global blockchain instance / 注册全局区块链实例
    blockchainInstance.setBlockchain(this.blockchain);
    
    console.log(`📋 Node ID: ${this.nodeId}`);
  }

  /**
   * Generate unique node ID / 生成唯一节点ID
   */
  private generateNodeId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `node-${timestamp}-${random}`;
  }

  /**
   * Start enhanced blockchain node with P2P synchronization / 启动增强区块链节点，支持P2P同步
   */
  async start(): Promise<void> {
    try {
      console.log('🔧 Starting Enhanced TitanChain Node / 启动增强TitanChain节点...');
      console.log(`📊 Network: ${NETWORK_CONFIG.NETWORK_NAME} (Chain ID: ${NETWORK_CONFIG.CHAIN_ID})`);
      console.log(`⚡ Target TPS: ${PERFORMANCE_CONFIG.TARGET_TPS || 200000}`);
      console.log(`👥 Max Validators: ${CONSENSUS_CONFIG.MAX_VALIDATORS}`);
      console.log(`⏱️  Block Time: ${CONSENSUS_CONFIG.BLOCK_TIME}s`);

      // Step 1: Initialize P2P network / 步骤1：初始化P2P网络
      await this.initializeP2PNetwork();

      // Step 2: Check for existing network / 步骤2：检查现有网络
      const networkExists = await this.checkExistingNetwork();
      
      if (networkExists) {
        // Step 3a: Sync from existing network / 步骤3a：从现有网络同步
        await this.syncFromNetwork();
      } else {
        // Step 3b: Initialize as first node / 步骤3b：作为第一个节点初始化
        await this.initializeAsFirstNode();
      }

      // Step 4: Start blockchain services / 步骤4：启动区块链服务
      await this.startBlockchainServices();

      // Step 5: Start monitoring and maintenance / 步骤5：启动监控和维护
      this.startMonitoring();

      this.isRunning = true;
      console.log('✅ Enhanced TitanChain Node started successfully / 增强TitanChain节点启动成功!');
      console.log(`🌐 RPC URL: ${NETWORK_CONFIG.RPC_URL}`);
      console.log(`🔍 Explorer: ${NETWORK_CONFIG.EXPLORER_URL}`);
      console.log(`🕸️ P2P Port: ${process.env.P2P_PORT || 4003}`);
      console.log(`🆔 Node ID: ${this.nodeId}`);

      // Setup graceful shutdown / 设置优雅关闭
      this.setupGracefulShutdown();

    } catch (error) {
      console.error('❌ Failed to start Enhanced TitanChain Node / 启动增强TitanChain节点失败:', error);
      await this.cleanup();
      process.exit(1);
    }
  }

  /**
   * Initialize P2P network / 初始化P2P网络
   */
  private async initializeP2PNetwork(): Promise<void> {
    console.log('🕸️ Initializing P2P Network / 初始化P2P网络...');
    
    const p2pOptions = {
      port: parseInt(process.env.P2P_PORT || '4003'),
      host: process.env.P2P_HOST || '0.0.0.0',
      bootnodes: this.getBootnodes(),
      enablePeerDiscovery: true,
      enableAutoSync: true,
      maxPeers: parseInt(process.env.MAX_PEERS || '50'),
      syncInterval: parseInt(process.env.SYNC_INTERVAL || '10000')
    };

    this.p2pNode = new EnhancedP2PNode(this.blockchain, p2pOptions);
    
    // Initialize block sync protocol / 初始化区块同步协议
    this.blockSync = new BlockSyncProtocol(this.blockchain, this.p2pNode, {
      batchSize: 100,
      maxRetries: 3,
      timeout: 30000,
      enableConflictResolution: true
    });

    await this.p2pNode.start();
    console.log(`✅ P2P Network initialized on port ${p2pOptions.port} / P2P网络在端口${p2pOptions.port}初始化成功`);
  }

  /**
   * Get bootstrap nodes from environment / 从环境变量获取引导节点
   */
  private getBootnodes(): string[] {
    const bootnodes = process.env.BOOTNODES || '';
    return bootnodes.split(',').filter(node => node.trim().length > 0);
  }

  /**
   * Check if there's an existing network / 检查是否存在现有网络
   */
  private async checkExistingNetwork(): Promise<boolean> {
    console.log('🔍 Checking for existing network / 检查现有网络...');
    
    if (!this.p2pNode) {
      return false;
    }

    // Wait for initial peer connections / 等待初始对等连接
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const peers = this.p2pNode.getPeers();
    console.log(`📊 Found ${peers.length} peers / 发现${peers.length}个对等节点`);
    
    if (peers.length === 0) {
      console.log('🏗️ No peers found, initializing as first node / 未发现对等节点，作为第一个节点初始化');
      this.isFirstNode = true;
      return false;
    }

    // Request chain status from peers / 从对等节点请求链状态
    try {
      const chainStatus = await this.p2pNode.requestChainStatus();
      if (chainStatus && chainStatus.blockHeight > 0) {
        console.log(`📈 Found existing chain with height ${chainStatus.blockHeight} / 发现现有链，高度为${chainStatus.blockHeight}`);
        return true;
      }
    } catch (error) {
      console.warn('⚠️ Failed to get chain status from peers / 从对等节点获取链状态失败:', error);
    }

    return false;
  }

  /**
   * Sync blockchain from existing network / 从现有网络同步区块链
   */
  private async syncFromNetwork(): Promise<void> {
    console.log('🔄 Syncing from existing network / 从现有网络同步...');
    
    if (!this.blockSync || !this.chainState) {
      throw new Error('Block sync or chain state not initialized / 区块同步或链状态未初始化');
    }

    try {
      // Initialize chain state / 初始化链状态
      await this.chainState.initialize();
      
      // Start synchronization / 开始同步
      const syncResult = await this.blockSync.startSync();
      
      if (syncResult.success) {
        console.log(`✅ Sync completed successfully / 同步成功完成`);
        console.log(`📊 Synced ${syncResult.blocksSynced} blocks / 同步了${syncResult.blocksSynced}个区块`);
        console.log(`📈 Current height: ${syncResult.currentHeight} / 当前高度: ${syncResult.currentHeight}`);
      } else {
        throw new Error(`Sync failed: ${syncResult.error} / 同步失败: ${syncResult.error}`);
      }

      // Validate chain integrity / 验证链完整性
      const isValid = await this.chainState.validateChain();
      if (!isValid) {
        throw new Error('Chain validation failed after sync / 同步后链验证失败');
      }

    } catch (error) {
      console.error('❌ Failed to sync from network / 从网络同步失败:', error);
      throw error;
    }
  }

  /**
   * Initialize as the first node in the network / 作为网络中的第一个节点初始化
   */
  private async initializeAsFirstNode(): Promise<void> {
    console.log('🏗️ Initializing as first node / 作为第一个节点初始化...');
    
    if (!this.chainState) {
      throw new Error('Chain state not initialized / 链状态未初始化');
    }

    try {
      // Initialize chain state / 初始化链状态
      await this.chainState.initialize();
      
      // Check if genesis block already exists / 检查创世区块是否已存在
      const hasGenesis = await this.chainState.hasGenesisBlock();
      
      if (!hasGenesis) {
        // Create genesis block / 创建创世区块
        const genesisValidators = await this.getGenesisValidators();
        await this.chainState.createGenesisBlock(genesisValidators);
        console.log('✅ Genesis block created / 创世区块已创建');
      } else {
        console.log('📋 Genesis block already exists / 创世区块已存在');
      }

    } catch (error) {
      console.error('❌ Failed to initialize as first node / 作为第一个节点初始化失败:', error);
      throw error;
    }
  }

  /**
   * Start blockchain services / 启动区块链服务
   */
  private async startBlockchainServices(): Promise<void> {
    console.log('⚙️ Starting blockchain services / 启动区块链服务...');
    
    try {
      // Get validators / 获取验证节点
      const validators = await this.getValidators();
      console.log(`👥 Found ${validators.length} validators / 发现${validators.length}个验证节点`);

      // Initialize validator manager / 初始化验证节点管理器
      await this.validatorManager.initialize(validators);

      // Start blockchain / 启动区块链
      await this.blockchain.start(validators);
      
      console.log('✅ Blockchain services started / 区块链服务已启动');

    } catch (error) {
      console.error('❌ Failed to start blockchain services / 启动区块链服务失败:', error);
      throw error;
    }
  }

  /**
   * Get validators based on node type / 根据节点类型获取验证节点
   */
  private async getValidators(): Promise<Validator[]> {
    if (this.isFirstNode) {
      // First node creates genesis validators / 第一个节点创建创世验证节点
      return this.createGenesisValidators();
    } else {
      // Other nodes get validators from validator manager / 其他节点从验证节点管理器获取验证节点
      const validators = await this.validatorManager.getActiveValidators();
      
      if (validators.length === 0) {
        console.log('⚠️ No active validators found, creating genesis validators / 未发现活跃验证节点，创建创世验证节点...');
        return this.createGenesisValidators();
      }
      
      return validators;
    }
  }

  /**
   * Get genesis validators / 获取创世验证节点
   */
  private async getGenesisValidators(): Promise<Validator[]> {
    // Get validators from validator manager / 从验证节点管理器获取验证节点
    const validators = await this.validatorManager.getActiveValidators();
    
    if (validators.length === 0) {
      console.log('⚠️ No existing validators found, creating genesis validators / 未发现现有验证节点，创建创世验证节点...');
      return this.createGenesisValidators();
    }

    return validators;
  }

  /**
   * Create genesis validators / 创建创世验证节点
   */
  private createGenesisValidators(): Validator[] {
    console.log('🏛️ Creating genesis validators / 创建创世验证节点...');

    // Ensure PoS-compatible validator structure / 确保PoS兼容的验证者结构 // 英文 /中文
    const now = Date.now(); // 英文 /中文
    const blockTimeMs = (process.env.BLOCK_TIME_MS ? parseInt(process.env.BLOCK_TIME_MS) : CONSENSUS_CONFIG.BLOCK_TIME * 1000);

    const makeValidator = (address: string, stakeWei: bigint, name: string): Validator => ({
      address,
      publicKey: `0x${address.slice(2).padEnd(128, '0')}`, // placeholder pubkey derived from address / 使用地址派生占位公钥 // 英文 /中文
      stake: stakeWei,
      delegatedStake: BigInt(0),
      totalStake: stakeWei,
      commission: 5,
      status: 'active', // 必须为active以进入竞争出块 // 英文 /中文
      performance: {
        blocksProduced: 0,
        blocksExpected: 0,
        uptime: 100,
        missedBlocks: 0,
        slashingEvents: 0,
        averageBlockTime: blockTimeMs,
        score: 100
      },
      metadata: {
        name,
        description: 'Genesis validator / 创世验证者', // 英文 /中文
        website: 'https://titanchain.io'
      },
      joinedAt: now,
      lastActiveBlock: 0
    });

    // Use valid hex addresses and diverse stakes / 使用合法十六进制地址并设置不同质押量 // 英文 /中文
    const v1 = makeValidator('0x1111111111111111111111111111111111111111', BigInt('1000000000000000000000'), 'Genesis Validator #1');
    const v2 = makeValidator('0x2222222222222222222222222222222222222222', BigInt('800000000000000000000'), 'Genesis Validator #2');
    const v3 = makeValidator('0x3333333333333333333333333333333333333333', BigInt('600000000000000000000'), 'Genesis Validator #3');

    const genesisValidators: Validator[] = [v1, v2, v3];
    console.log(`✅ Created ${genesisValidators.length} genesis validators / 创建了${genesisValidators.length}个创世验证节点`);
    return genesisValidators;
  }

  /**
   * Start monitoring and maintenance / 启动监控和维护
   */
  private startMonitoring(): void {
    console.log('📊 Starting monitoring / 启动监控...');
    
    // Network status monitoring / 网络状态监控
    setInterval(() => {
      if (!this.isRunning) return;

      try {
        const stats = this.blockchain.getNetworkStats();
        const poolStats = this.blockchain.getTransactionPoolStats();
        const peers = this.p2pNode?.getPeers() || [];
        
        console.log(
          `📊 Network Stats / 网络统计 - Blocks: ${stats.blockHeight}, TXs: ${stats.totalTransactions}, TPS: ${stats.currentTPS}, Pool: ${poolStats.pendingTransactions}, Peers: ${peers.length}`
        );
      } catch (error) {
        console.error('❌ Error getting network stats / 获取网络统计失败:', error);
      }
    }, 30000); // Every 30 seconds / 每30秒

    // Sync status monitoring / 同步状态监控
    if (this.blockSync) {
      setInterval(() => {
        if (!this.isRunning || !this.blockSync) return;

        try {
          const syncStats = this.blockSync.getSyncStats();
          if (syncStats.isActive) {
            console.log(
              `🔄 Sync Progress / 同步进度 - ${syncStats.progress}% (${syncStats.syncedBlocks}/${syncStats.totalBlocks})`
            );
          }
        } catch (error) {
          console.error('❌ Error getting sync stats / 获取同步统计失败:', error);
        }
      }, 10000); // Every 10 seconds / 每10秒
    }
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
    process.on('SIGQUIT', () => shutdown('SIGQUIT'));
  }

  /**
   * Stop the node / 停止节点
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    console.log('🛑 Stopping Enhanced TitanChain Node / 停止增强TitanChain节点...');
    this.isRunning = false;

    await this.cleanup();
    console.log('✅ Enhanced TitanChain Node stopped / 增强TitanChain节点已停止');
  }

  /**
   * Cleanup resources / 清理资源
   */
  private async cleanup(): Promise<void> {
    try {
      if (this.blockSync) {
        await this.blockSync.stop();
      }

      if (this.p2pNode) {
        await this.p2pNode.stop();
      }

      if (this.chainState) {
        await this.chainState.cleanup();
      }

      await this.blockchain.stop();
      
    } catch (error) {
      console.error('❌ Error during cleanup / 清理过程中出错:', error);
    }
  }

  /**
   * Get node status / 获取节点状态
   */
  getStatus() {
    return {
      nodeId: this.nodeId,
      isRunning: this.isRunning,
      isFirstNode: this.isFirstNode,
      peers: this.p2pNode?.getPeers().length || 0,
      blockHeight: this.blockchain.getNetworkStats().blockHeight,
      syncStatus: this.blockSync?.getSyncStats()
    };
  }
}

// Main function / 主函数
async function main() {
  console.log('🌟 Enhanced TitanChain Blockchain Node / 增强TitanChain区块链节点');
  console.log('='.repeat(60));
  
  const node = new EnhancedTitanChainNode();
  await node.start();
}

// Start node - execute main function directly / 启动节点 - 直接执行主函数
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('💥 Fatal error / 致命错误:', error);
    process.exit(1);
  });
}

export { EnhancedTitanChainNode };