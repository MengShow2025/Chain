/**
 * TitanChain 增强版主链核心 - 支持混合双区块架构
 * Enhanced TitanChain Core with Hybrid Dual-Block Architecture
 */

import { Block, Transaction, Validator, NetworkStats } from '../../shared/types/blockchain.js';
import { CONSENSUS_CONFIG, PERFORMANCE_CONFIG } from '../../shared/constants/blockchain.js';
import { PoSConsensus } from '../consensus/pos-consensus.js';
import { ValidatorManager } from '../consensus/validator-manager.js';
import { EVMExecutor } from '../evm/evm-executor.js';
import { TransactionPool } from './transaction-pool.js';
import { BlockValidator } from './block-validator.js';
import { ZeroGasEngine } from './zero-gas-engine.js';
import { HighPerformanceProcessor } from './high-performance-processor.js';
import { DualBlockManager } from './dual-block-manager.js';
import { SponsorPoolService } from './sponsor-pool.js';
import { DUAL_BLOCK_CONFIG, PERFORMANCE_MONITORING } from './dual-block-config.js';

/**
 * TitanChain增强版主链核心
 * 支持混合双区块架构：快速区块(1秒,5M gas) + 批量区块(5秒,50M gas)
 * Enhanced TitanChain Core with Hybrid Dual-Block Architecture
 */
export class TitanChainEnhanced {
  private consensusEngine: PoSConsensus;
  private validatorManager: ValidatorManager;
  private evmEngine: EVMExecutor;
  private transactionPool: TransactionPool;
  private blockValidator: BlockValidator;
  private zeroGasEngine: ZeroGasEngine;
  private performanceProcessor: HighPerformanceProcessor;
  private dualBlockManager: DualBlockManager;

  private blockchain: Block[] = [];
  private currentBlock: Block | null = null;
  private isRunning: boolean = false;
  
  // 增强的网络统计 / Enhanced network statistics
  private networkStats: NetworkStats & {
    fastBlockCount: number;                // 快速区块数量 / Fast block count
    batchBlockCount: number;               // 批量区块数量 / Batch block count
    fastBlockTPS: number;                  // 快速区块TPS / Fast block TPS
    batchBlockTPS: number;                 // 批量区块TPS / Batch block TPS
    averageFastBlockTime: number;          // 平均快速区块时间 / Average fast block time
    averageBatchBlockTime: number;         // 平均批量区块时间 / Average batch block time
    routingEfficiency: number;             // 路由效率 / Routing efficiency
  } = {
    currentTPS: 0,
    averageTPS: 0,
    peakTPS: 0,
    blockHeight: 0,
    totalTransactions: 0,
    activeValidators: 0,
    candidateNodes: 0,
    totalStaked: BigInt(0),
    networkHealth: 'excellent',
    averageBlockTime: CONSENSUS_CONFIG.BLOCK_TIME * 1000,
    zeroGasTransactions: 0,
    // 新增字段 / New fields
    fastBlockCount: 0,
    batchBlockCount: 0,
    fastBlockTPS: 0,
    batchBlockTPS: 0,
    averageFastBlockTime: DUAL_BLOCK_CONFIG.FAST_BLOCK.BLOCK_TIME,
    averageBatchBlockTime: DUAL_BLOCK_CONFIG.BATCH_BLOCK.BLOCK_TIME,
    routingEfficiency: 0
  };

  constructor() {
    console.log('🚀 初始化TitanChain增强版 - 混合双区块架构 / Initializing TitanChain Enhanced with Hybrid Dual-Block Architecture...');
    
    // 初始化核心组件 / Initialize core components
    this.consensusEngine = new PoSConsensus();
    this.validatorManager = new ValidatorManager();
    this.evmEngine = new EVMExecutor();
    this.transactionPool = new TransactionPool();
    this.blockValidator = new BlockValidator();
    this.zeroGasEngine = new ZeroGasEngine();
    this.performanceProcessor = new HighPerformanceProcessor(this.transactionPool);

    // 初始化双区块管理器 / Initialize dual block manager
    this.dualBlockManager = new DualBlockManager(
      this.transactionPool,
      this.evmEngine,
      this.consensusEngine,
      this.blockValidator
    );

    console.log('✅ TitanChain增强版初始化成功 / TitanChain Enhanced initialized successfully');
  }

  /**
   * 启动增强版区块链网络
   * Start enhanced blockchain network
   */
  async start(genesisValidators: Validator[]): Promise<void> {
    try {
      console.log('🌟 启动TitanChain增强版网络 / Starting TitanChain Enhanced network...');
      
      // 初始化各个组件 / Initialize components
      await this.consensusEngine.initialize(genesisValidators);
      await this.validatorManager.initialize(genesisValidators);
      
      // 创建创世区块 / Create genesis block
      await this.createGenesisBlock();
      
      // 启动双区块生产系统 / Start dual block production system
      const enableProduction = (process.env.ENABLE_BLOCK_PRODUCTION ?? 'true').toLowerCase() !== 'false';
      if (enableProduction) {
        await this.dualBlockManager.start();
        console.log('🏗️ 双区块生产系统已启动 / Dual block production system started');
      } else {
        console.log('⚠️ 区块生产已通过环境变量禁用 / Block production disabled by environment variable');
      }
      
      // 启动验证节点选举 / Start validator election
      this.startValidatorElection();
      
      // 启动性能监控 / Start performance monitoring
      this.startPerformanceMonitoring();
      
      this.isRunning = true;
      console.log('✅ TitanChain增强版网络启动成功 / TitanChain Enhanced network started successfully');
      
    } catch (error) {
      console.error('❌ 启动TitanChain增强版网络失败 / Failed to start TitanChain Enhanced network:', error);
      throw error;
    }
  }

  /**
   * 停止增强版区块链网络
   * Stop enhanced blockchain network
   */
  async stop(): Promise<void> {
    console.log('🛑 停止TitanChain增强版网络 / Stopping TitanChain Enhanced network...');
    
    this.isRunning = false;
    
    // 停止双区块管理器 / Stop dual block manager
    await this.dualBlockManager.stop();
    
    console.log('✅ TitanChain增强版网络已停止 / TitanChain Enhanced network stopped');
  }

  /**
   * 创建创世区块
   * Create genesis block
   */
  private async createGenesisBlock(): Promise<void> {
    const genesisBlock: Block = {
      number: 0,
      hash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      parentHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      timestamp: Number(process.env.GENESIS_TIMESTAMP ?? Date.now()),
      validator: '0x0000000000000000000000000000000000000000',
      transactions: [],
      transactionsRoot: '0x0000000000000000000000000000000000000000000000000000000000000000',
      receiptsRoot: '0x0000000000000000000000000000000000000000000000000000000000000000',
      stateRoot: '0x0000000000000000000000000000000000000000000000000000000000000000',
      gasUsed: BigInt(0),
      gasLimit: PERFORMANCE_CONFIG.MAX_GAS_LIMIT,
      difficulty: BigInt(1),
      nonce: '0x0000000000000000',
      size: 1024,
      reward: BigInt(0)
    };
    
    this.blockchain.push(genesisBlock);
    this.currentBlock = genesisBlock;
    this.networkStats.blockHeight = 0;
    
    console.log('🎯 创世区块已创建 / Genesis block created');
  }

  /**
   * 启动验证节点选举
   * Start validator election
   */
  private startValidatorElection(): void {
    const electionInterval = CONSENSUS_CONFIG.ELECTION_INTERVAL * 1000;
    
    setInterval(async () => {
      if (!this.isRunning) return;
      
      try {
        await this.validatorManager.conductElection();
        this.updateValidatorStats();
      } catch (error) {
        console.error('❌ 验证节点选举错误 / Validator election error:', error);
      }
    }, electionInterval);
    
    console.log(`🗳️ 验证节点选举已启动，间隔 ${CONSENSUS_CONFIG.ELECTION_INTERVAL}s / Validator election started with ${CONSENSUS_CONFIG.ELECTION_INTERVAL}s interval`);
  }

  /**
   * 启动性能监控
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    setInterval(() => {
      if (!this.isRunning) return;
      
      try {
        this.updateNetworkStats();
        this.checkPerformanceThresholds();
      } catch (error) {
        console.error('❌ 性能监控错误 / Performance monitoring error:', error);
      }
    }, 5000); // 每5秒更新一次 / Update every 5 seconds
    
    console.log('📊 性能监控已启动 / Performance monitoring started');
  }

  /**
   * 提交交易到增强版系统
   * Submit transaction to enhanced system
   */
  async submitTransaction(tx: Transaction): Promise<boolean> {
    try {
      console.log(`📤 提交交易到增强版系统 ${tx.hash} / Submitting transaction to enhanced system ${tx.hash}`);
      
      // 检查是否为0-gas费交易 / Check if zero-gas transaction
      if (tx.isZeroGas) {
        const eligibility = this.zeroGasEngine.canProcessAsZeroGas(tx);
        if (!eligibility.eligible) {
          console.error(`❌ 零Gas交易被拒绝: ${eligibility.reason} / Zero-gas transaction rejected: ${eligibility.reason}`);
          return false;
        }
      }
      
      // 添加到高性能处理器 / Add to high performance processor
      this.performanceProcessor.addTransaction(tx);
      
      // 添加到交易池 / Add to transaction pool
      const success = await this.transactionPool.addTransaction(tx);
      
      if (success) {
        console.log(`✅ 交易 ${tx.hash} 已添加到交易池 / Transaction ${tx.hash} added to pool`);
        this.updateTransactionStats();
      } else {
        console.error(`❌ 添加交易 ${tx.hash} 到交易池失败 / Failed to add transaction ${tx.hash} to pool`);
      }
      
      return success;
      
    } catch (error) {
      console.error(`❌ 提交交易失败 / Failed to submit transaction:`, error);
      return false;
    }
  }

  /**
   * 更新网络统计信息
   * Update network statistics
   */
  private updateNetworkStats(): void {
    try {
      // 获取双区块管理器状态 / Get dual block manager status
      const systemStatus = this.dualBlockManager.getSystemStatus();
      
      // 更新区块统计 / Update block statistics
      this.networkStats.fastBlockCount = systemStatus.fastBlock.blockCount;
      this.networkStats.batchBlockCount = systemStatus.batchBlock.blockCount;
      this.networkStats.blockHeight = this.networkStats.fastBlockCount + this.networkStats.batchBlockCount;
      
      // 更新TPS统计 / Update TPS statistics
      this.networkStats.fastBlockTPS = this.calculateTPS(
        systemStatus.fastBlock.blockCount,
        DUAL_BLOCK_CONFIG.FAST_BLOCK.BLOCK_TIME
      );
      this.networkStats.batchBlockTPS = this.calculateTPS(
        systemStatus.batchBlock.blockCount,
        DUAL_BLOCK_CONFIG.BATCH_BLOCK.BLOCK_TIME
      );
      
      // 更新总体TPS / Update overall TPS
      this.networkStats.currentTPS = this.networkStats.fastBlockTPS + this.networkStats.batchBlockTPS;
      this.networkStats.averageTPS = (this.networkStats.averageTPS + this.networkStats.currentTPS) / 2;
      this.networkStats.peakTPS = Math.max(this.networkStats.peakTPS, this.networkStats.currentTPS);
      
      // 更新平均区块时间 / Update average block times
      this.networkStats.averageFastBlockTime = systemStatus.fastBlock.averageLatency || DUAL_BLOCK_CONFIG.FAST_BLOCK.BLOCK_TIME;
      this.networkStats.averageBatchBlockTime = systemStatus.batchBlock.averageLatency || DUAL_BLOCK_CONFIG.BATCH_BLOCK.BLOCK_TIME;
      
      // 计算路由效率 / Calculate routing efficiency
      const routingStats = systemStatus.routingStats;
      const totalRouted = Object.values(routingStats).reduce((sum: number, count: number) => sum + count, 0);
      this.networkStats.routingEfficiency = totalRouted > 0 ? 
        (routingStats.fast || 0) / totalRouted : 0;
      
      // 更新网络健康状态 / Update network health
      this.updateNetworkHealth();
      
    } catch (error) {
      console.error('❌ 更新网络统计失败 / Failed to update network stats:', error);
    }
  }

  /**
   * 更新验证节点统计
   * Update validator statistics
   */
  private updateValidatorStats(): void {
    const activeValidators = this.validatorManager.getActiveValidators();
    this.networkStats.activeValidators = activeValidators.length;
    
    // 计算总质押量 / Calculate total staked amount
    this.networkStats.totalStaked = activeValidators.reduce(
      (sum, validator) => sum + validator.stake,
      BigInt(0)
    );
  }

  /**
   * 更新交易统计
   * Update transaction statistics
   */
  private updateTransactionStats(): void {
    this.networkStats.totalTransactions++;
  }

  /**
   * 计算TPS
   * Calculate TPS
   */
  private calculateTPS(blockCount: number, blockTime: number): number {
    if (blockCount === 0) return 0;
    
    const timeInSeconds = (blockCount * blockTime) / 1000;
    const avgTransactionsPerBlock = 100; // 假设平均每个区块100个交易 / Assume 100 transactions per block on average
    
    return (blockCount * avgTransactionsPerBlock) / timeInSeconds;
  }

  /**
   * 更新网络健康状态
   * Update network health status
   */
  private updateNetworkHealth(): void {
    let healthScore = 100;
    
    // 检查快速区块性能 / Check fast block performance
    if (this.networkStats.averageFastBlockTime > PERFORMANCE_MONITORING.LATENCY_TARGETS.FAST_BLOCK_MAX_LATENCY) {
      healthScore -= 20;
    }
    
    // 检查批量区块性能 / Check batch block performance
    if (this.networkStats.averageBatchBlockTime > PERFORMANCE_MONITORING.LATENCY_TARGETS.BATCH_BLOCK_MAX_LATENCY) {
      healthScore -= 20;
    }
    
    // 检查TPS性能 / Check TPS performance
    if (this.networkStats.fastBlockTPS < PERFORMANCE_MONITORING.THROUGHPUT_TARGETS.FAST_BLOCK_MIN_TPS) {
      healthScore -= 15;
    }
    
    if (this.networkStats.batchBlockTPS < PERFORMANCE_MONITORING.THROUGHPUT_TARGETS.BATCH_BLOCK_MIN_TPS) {
      healthScore -= 15;
    }
    
    // 检查验证节点数量 / Check validator count
    if (this.networkStats.activeValidators < CONSENSUS_CONFIG.MAX_VALIDATORS * 0.5) {
      healthScore -= 10;
    }
    
    // 设置健康状态 / Set health status
    if (healthScore >= 90) {
      this.networkStats.networkHealth = 'excellent';
    } else if (healthScore >= 70) {
      this.networkStats.networkHealth = 'good';
    } else if (healthScore >= 50) {
      this.networkStats.networkHealth = 'fair';
    } else {
      this.networkStats.networkHealth = 'poor';
    }
  }

  /**
   * 检查性能阈值
   * Check performance thresholds
   */
  private checkPerformanceThresholds(): void {
    const systemStatus = this.dualBlockManager.getSystemStatus();
    
    // 检查快速区块队列 / Check fast block queue
    if (systemStatus.fastBlock.queueSize > PERFORMANCE_MONITORING.QUEUE_MONITORING.WARNING_THRESHOLD) {
      console.log(`⚠️ 快速区块队列警告: ${systemStatus.fastBlock.queueSize} 个交易 / Fast block queue warning: ${systemStatus.fastBlock.queueSize} transactions`);
    }
    
    // 检查批量区块队列 / Check batch block queue
    if (systemStatus.batchBlock.queueSize > PERFORMANCE_MONITORING.QUEUE_MONITORING.WARNING_THRESHOLD) {
      console.log(`⚠️ 批量区块队列警告: ${systemStatus.batchBlock.queueSize} 个交易 / Batch block queue warning: ${systemStatus.batchBlock.queueSize} transactions`);
    }
    
    // 检查错误率 / Check error rate
    if (systemStatus.fastBlock.errorCount > 10) {
      console.log(`⚠️ 快速区块错误率过高: ${systemStatus.fastBlock.errorCount} 个错误 / Fast block error rate too high: ${systemStatus.fastBlock.errorCount} errors`);
    }
    
    if (systemStatus.batchBlock.errorCount > 5) {
      console.log(`⚠️ 批量区块错误率过高: ${systemStatus.batchBlock.errorCount} 个错误 / Batch block error rate too high: ${systemStatus.batchBlock.errorCount} errors`);
    }
  }

  /**
   * 获取增强版网络状态
   * Get enhanced network status
   */
  getEnhancedNetworkStats() {
    return {
      ...this.networkStats,
      dualBlockSystem: this.dualBlockManager.getSystemStatus(),
      performanceTargets: {
        fastBlockLatency: PERFORMANCE_MONITORING.LATENCY_TARGETS.FAST_BLOCK_MAX_LATENCY,
        batchBlockLatency: PERFORMANCE_MONITORING.LATENCY_TARGETS.BATCH_BLOCK_MAX_LATENCY,
        fastBlockTPS: PERFORMANCE_MONITORING.THROUGHPUT_TARGETS.FAST_BLOCK_MIN_TPS,
        batchBlockTPS: PERFORMANCE_MONITORING.THROUGHPUT_TARGETS.BATCH_BLOCK_MIN_TPS
      }
    };
  }

  /**
   * 获取区块链状态
   * Get blockchain status
   */
  getBlockchainStatus() {
    return {
      isRunning: this.isRunning,
      currentBlock: this.currentBlock,
      blockchainLength: this.blockchain.length,
      networkStats: this.getEnhancedNetworkStats()
    };
  }

  /**
   * 获取指定区块
   * Get block by number
   */
  getBlock(blockNumber: number): Block | null {
    return this.blockchain.find(block => block.number === blockNumber) || null;
  }

  /**
   * 获取最新区块
   * Get latest block
   */
  getLatestBlock(): Block | null {
    return this.currentBlock;
  }

  /**
   * 获取区块链
   * Get blockchain
   */
  getBlockchain(): Block[] {
    return [...this.blockchain]; // 返回副本 / Return copy
  }
}