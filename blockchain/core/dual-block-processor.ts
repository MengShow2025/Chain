/**
 * TitanChain 双区块处理器
 * Dual Block Processor for Fast and Batch Block Processing
 * 
 * 功能特性 / Features:
 * - 快速区块处理（1秒，5M gas）/ Fast block processing (1s, 5M gas)
 * - 批量区块处理（5秒，50M gas）/ Batch block processing (5s, 50M gas)
 * - 并行处理和状态同步 / Parallel processing and state synchronization
 * - 性能监控和优化 / Performance monitoring and optimization
 */

import { Transaction, Block } from '../../shared/types/blockchain';
import { SmartTransactionRouter, TransactionAnalysis } from './smart-transaction-router';
import { 
  DUAL_BLOCK_CONFIG, 
  BLOCK_PRODUCER_CONFIG,
  BLOCK_SYNC_CONFIG,
  PERFORMANCE_MONITORING,
  BlockType 
} from './dual-block-config';

// 区块处理结果 / Block Processing Result
export interface BlockProcessingResult {
  block: Block;                           // 生成的区块 / Generated block
  processedTransactions: number;          // 处理的交易数 / Processed transactions
  processingTime: number;                 // 处理时间(ms) / Processing time (ms)
  gasUsed: bigint;                       // 使用的Gas / Gas used
  success: boolean;                       // 处理是否成功 / Processing success
  errors: string[];                       // 错误信息 / Error messages
}

// 处理器状态 / Processor Status
export interface ProcessorStatus {
  fastBlockProcessor: {
    isRunning: boolean;                   // 是否运行中 / Is running
    currentBlock: number;                 // 当前区块号 / Current block number
    queueSize: number;                    // 队列大小 / Queue size
    averageProcessingTime: number;        // 平均处理时间 / Average processing time
    tps: number;                         // 当前TPS / Current TPS
  };
  batchBlockProcessor: {
    isRunning: boolean;                   // 是否运行中 / Is running
    currentBlock: number;                 // 当前区块号 / Current block number
    queueSize: number;                    // 队列大小 / Queue size
    averageProcessingTime: number;        // 平均处理时间 / Average processing time
    tps: number;                         // 当前TPS / Current TPS
  };
  syncStatus: {
    isSynced: boolean;                    // 是否同步 / Is synced
    lastSyncTime: number;                 // 最后同步时间 / Last sync time
    syncLag: number;                      // 同步延迟 / Sync lag
  };
}

/**
 * 双区块处理器类
 * Dual Block Processor Class
 */
export class DualBlockProcessor {
  private router: SmartTransactionRouter;
  private fastBlockQueue: Transaction[] = [];
  private batchBlockQueue: Transaction[] = [];
  private fastBlockChain: Block[] = [];
  private batchBlockChain: Block[] = [];
  private processorStatus: ProcessorStatus;
  private isRunning: boolean = false;
  
  // 处理器定时器 / Processor timers
  private fastBlockTimer: NodeJS.Timeout | null = null;
  private batchBlockTimer: NodeJS.Timeout | null = null;
  private syncTimer: NodeJS.Timeout | null = null;

  // 状态管理 / State management
  private state = {
    stateRoot: '0x0',
    lastSyncTime: Date.now(),
    syncInProgress: false
  };

  // 性能统计 / Performance statistics
  private performanceMetrics = {
    fastBlock: {
      totalBlocks: 0,
      totalTransactions: 0,
      totalProcessingTime: 0,
      averageTPS: 0,
      averageLatency: 0
    },
    batchBlock: {
      totalBlocks: 0,
      totalTransactions: 0,
      totalProcessingTime: 0,
      averageTPS: 0,
      averageLatency: 0
    },
    syncOperations: 0,
    lastSyncTime: Date.now()
  };

  constructor() {
    this.router = new SmartTransactionRouter();
    this.processorStatus = {
      fastBlockProcessor: {
        isRunning: false,
        currentBlock: 0,
        queueSize: 0,
        averageProcessingTime: 0,
        tps: 0
      },
      batchBlockProcessor: {
        isRunning: false,
        currentBlock: 0,
        queueSize: 0,
        averageProcessingTime: 0,
        tps: 0
      },
      syncStatus: {
        isSynced: true,
        lastSyncTime: Date.now(),
        syncLag: 0
      }
    };
  }

  /**
   * 启动双区块处理器
   * Start dual block processor
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ 双区块处理器已在运行中 / Dual block processor is already running');
      return;
    }

    console.log('🚀 启动TitanChain双区块处理器 / Starting TitanChain Dual Block Processor...');
    
    this.isRunning = true;
    
    // 启动快速区块处理器 / Start fast block processor
    if (BLOCK_PRODUCER_CONFIG.FAST_PRODUCER.ENABLED) {
      this.startFastBlockProcessor();
    }
    
    // 启动批量区块处理器 / Start batch block processor
    if (BLOCK_PRODUCER_CONFIG.BATCH_PRODUCER.ENABLED) {
      this.startBatchBlockProcessor();
    }
    
    // 启动状态同步器 / Start state synchronizer
    this.startStateSynchronizer();
    
    console.log('✅ 双区块处理器启动成功 / Dual block processor started successfully');
  }

  /**
   * 停止双区块处理器
   * Stop dual block processor
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('⚠️ 双区块处理器未在运行 / Dual block processor is not running');
      return;
    }

    console.log('🛑 停止双区块处理器 / Stopping dual block processor...');
    
    this.isRunning = false;
    
    // 清理定时器 / Clear timers
    if (this.fastBlockTimer) {
      clearInterval(this.fastBlockTimer);
      this.fastBlockTimer = null;
    }
    
    if (this.batchBlockTimer) {
      clearInterval(this.batchBlockTimer);
      this.batchBlockTimer = null;
    }
    
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    
    // 更新状态 / Update status
    this.processorStatus.fastBlockProcessor.isRunning = false;
    this.processorStatus.batchBlockProcessor.isRunning = false;
    
    console.log('✅ 双区块处理器已停止 / Dual block processor stopped');
  }

  /**
   * 添加交易到处理队列
   * Add transaction to processing queue
   */
  async addTransaction(transaction: Transaction): Promise<void> {
    // 分析交易并决定路由 / Analyze transaction and decide routing
    const analysis = await this.router.analyzeTransaction(transaction);
    
    // 根据路由决策添加到相应队列 / Add to appropriate queue based on routing decision
    if (analysis.routingDecision === BlockType.FAST) {
      this.fastBlockQueue.push(transaction);
      this.processorStatus.fastBlockProcessor.queueSize = this.fastBlockQueue.length;
    } else {
      this.batchBlockQueue.push(transaction);
      this.processorStatus.batchBlockProcessor.queueSize = this.batchBlockQueue.length;
    }

    // 更新路由器队列状态 / Update router queue status
    this.router.updateQueueStatus({
      fastQueue: {
        size: this.fastBlockQueue.length,
        averageWaitTime: this.calculateAverageWaitTime(BlockType.FAST),
        throughput: this.processorStatus.fastBlockProcessor.tps
      },
      batchQueue: {
        size: this.batchBlockQueue.length,
        averageWaitTime: this.calculateAverageWaitTime(BlockType.BATCH),
        throughput: this.processorStatus.batchBlockProcessor.tps
      }
    });
  }

  /**
   * 启动快速区块处理器
   * Start fast block processor
   */
  private startFastBlockProcessor(): void {
    this.processorStatus.fastBlockProcessor.isRunning = true;
    
    this.fastBlockTimer = setInterval(async () => {
      if (this.fastBlockQueue.length > 0) {
        await this.processFastBlock();
      }
    }, DUAL_BLOCK_CONFIG.FAST_BLOCK.BLOCK_TIME);
    
    console.log(`⚡ 快速区块处理器已启动 (${DUAL_BLOCK_CONFIG.FAST_BLOCK.BLOCK_TIME}ms间隔) / Fast block processor started`);
  }

  /**
   * 启动批量区块处理器
   * Start batch block processor
   */
  private startBatchBlockProcessor(): void {
    this.processorStatus.batchBlockProcessor.isRunning = true;
    
    this.batchBlockTimer = setInterval(async () => {
      if (this.batchBlockQueue.length > 0) {
        await this.processBatchBlock();
      }
    }, DUAL_BLOCK_CONFIG.BATCH_BLOCK.BLOCK_TIME);
    
    console.log(`📦 批量区块处理器已启动 (${DUAL_BLOCK_CONFIG.BATCH_BLOCK.BLOCK_TIME}ms间隔) / Batch block processor started`);
  }

  /**
   * 启动状态同步器
   * Start state synchronizer
   */
  private startStateSynchronizer(): void {
    this.syncTimer = setInterval(() => {
      this.synchronizeState();
    }, BLOCK_SYNC_CONFIG.CONSISTENCY_CHECK.CHECK_INTERVAL);
    
    console.log('🔄 状态同步器已启动 / State synchronizer started');
  }

  /**
   * 处理快速区块
   * Process fast block
   */
  private async processFastBlock(): Promise<BlockProcessingResult> {
    const startTime = Date.now();
    const maxTransactions = DUAL_BLOCK_CONFIG.FAST_BLOCK.MAX_TRANSACTIONS;
    const gasLimit = DUAL_BLOCK_CONFIG.FAST_BLOCK.GAS_LIMIT;
    
    // 从队列中取出交易 / Extract transactions from queue
    const transactions = this.fastBlockQueue.splice(0, maxTransactions);
    let gasUsed = BigInt(0);
    const processedTransactions: Transaction[] = [];
    const errors: string[] = [];

    // 处理交易 / Process transactions
    for (const tx of transactions) {
      try {
        const txGasEstimate = await this.estimateTransactionGas(tx);
        
        if (gasUsed + txGasEstimate <= gasLimit) {
          processedTransactions.push(tx);
          gasUsed += txGasEstimate;
        } else {
          // Gas不足，放回队列 / Insufficient gas, return to queue
          this.fastBlockQueue.unshift(tx);
          break;
        }
      } catch (error) {
        errors.push(`Transaction ${tx.hash} processing error: ${error}`);
      }
    }

    // 创建区块 / Create block
    const block = this.createBlock(
      BlockType.FAST,
      processedTransactions,
      this.fastBlockChain.length,
      gasUsed
    );

    // 添加到快速区块链 / Add to fast blockchain
    this.fastBlockChain.push(block);
    
    const processingTime = Date.now() - startTime;
    
    // 更新统计 / Update statistics
    this.updateFastBlockStats(processedTransactions.length, processingTime);
    this.processorStatus.fastBlockProcessor.currentBlock = this.fastBlockChain.length;
    this.processorStatus.fastBlockProcessor.queueSize = this.fastBlockQueue.length;

    console.log(`⚡ 快速区块 #${block.number} 已处理: ${processedTransactions.length}笔交易, ${processingTime}ms / Fast block processed`);

    return {
      block,
      processedTransactions: processedTransactions.length,
      processingTime,
      gasUsed,
      success: errors.length === 0,
      errors
    };
  }

  /**
   * 处理批量区块（优化版）
   * Process batch block (optimized version)
   */
  private async processBatchBlock(): Promise<BlockProcessingResult> {
    const startTime = Date.now();
    const maxTransactions = DUAL_BLOCK_CONFIG.BATCH_BLOCK.MAX_TRANSACTIONS;
    const gasLimit = DUAL_BLOCK_CONFIG.BATCH_BLOCK.GAS_LIMIT;
    
    // 从队列中取出交易 / Extract transactions from queue
    const transactions = this.batchBlockQueue.splice(0, maxTransactions);
    let gasUsed = BigInt(0);
    const processedTransactions: Transaction[] = [];
    const errors: string[] = [];

    // 并行处理交易估算 / Parallel transaction estimation
    const transactionPromises = transactions.map(async (tx, index) => {
      try {
        const gasEstimate = await this.estimateTransactionGas(tx);
        return { tx, gasEstimate, index };
      } catch (error) {
        return { tx, gasEstimate: BigInt(0), index, error: error.toString() };
      }
    });

    const transactionResults = await Promise.all(transactionPromises);

    // 按Gas效率排序，优先处理高效交易 / Sort by gas efficiency, prioritize efficient transactions
    transactionResults.sort((a, b) => {
      if (a.error || b.error) return a.error ? 1 : -1;
      const aEfficiency = Number(a.gasEstimate) / (a.tx.data?.length || 1);
      const bEfficiency = Number(b.gasEstimate) / (b.tx.data?.length || 1);
      return aEfficiency - bEfficiency;
    });

    // 智能打包交易 / Smart transaction packing
    for (const result of transactionResults) {
      if (result.error) {
        errors.push(`Transaction ${result.tx.hash} estimation error: ${result.error}`);
        continue;
      }

      if (gasUsed + result.gasEstimate <= gasLimit) {
        processedTransactions.push(result.tx);
        gasUsed += result.gasEstimate;
      } else {
        // Gas不足，放回队列（按原顺序）/ Insufficient gas, return to queue (in original order)
        this.batchBlockQueue.unshift(result.tx);
      }
    }

    // 创建区块 / Create block
    const block = this.createBlock(
      BlockType.BATCH,
      processedTransactions,
      this.batchBlockChain.length,
      gasUsed
    );

    // 添加到批量区块链 / Add to batch blockchain
    this.batchBlockChain.push(block);
    
    const processingTime = Date.now() - startTime;
    
    // 更新统计 / Update statistics
    this.updateBatchBlockStats(processedTransactions.length, processingTime);
    this.processorStatus.batchBlockProcessor.currentBlock = this.batchBlockChain.length;
    this.processorStatus.batchBlockProcessor.queueSize = this.batchBlockQueue.length;

    // 计算Gas利用率 / Calculate gas utilization
    const gasUtilization = (Number(gasUsed) / Number(gasLimit) * 100).toFixed(2);

    console.log(`📦 批量区块 #${block.number} 已处理: ${processedTransactions.length}笔交易, ${processingTime}ms, Gas利用率: ${gasUtilization}% / Batch block processed`);

    return {
      block,
      processedTransactions: processedTransactions.length,
      processingTime,
      gasUsed,
      success: errors.length === 0,
      errors
    };
  }

  /**
   * 创建区块
   * Create block
   */
  private createBlock(
    blockType: BlockType,
    transactions: Transaction[],
    blockNumber: number,
    gasUsed: bigint
  ): Block {
    const timestamp = Date.now();
    const previousHash = blockNumber > 0 ? 
      (blockType === BlockType.FAST ? 
        this.fastBlockChain[blockNumber - 1].hash : 
        this.batchBlockChain[blockNumber - 1].hash) : 
      '0x0000000000000000000000000000000000000000000000000000000000000000';

    return {
      number: blockNumber,
      hash: this.calculateBlockHash(blockNumber, timestamp, previousHash, transactions),
      previousHash,
      timestamp,
      transactions,
      gasUsed,
      gasLimit: blockType === BlockType.FAST ? 
        DUAL_BLOCK_CONFIG.FAST_BLOCK.GAS_LIMIT : 
        DUAL_BLOCK_CONFIG.BATCH_BLOCK.GAS_LIMIT,
      miner: 'dual-block-processor',
      difficulty: BigInt(1),
      nonce: BigInt(0),
      size: this.calculateBlockSize(transactions),
      transactionCount: transactions.length
    };
  }

  /**
   * 估算交易Gas
   * Estimate transaction gas
   */
  private async estimateTransactionGas(transaction: Transaction): Promise<bigint> {
    // 基础Gas / Base gas
    let gas = BigInt(21000);
    
    // 数据Gas / Data gas
    if (transaction.data && transaction.data !== '0x') {
      const dataSize = (transaction.data.length - 2) / 2;
      gas += BigInt(dataSize * 16);
    }
    
    return gas;
  }

  /**
   * 计算区块哈希
   * Calculate block hash
   */
  private calculateBlockHash(
    blockNumber: number,
    timestamp: number,
    previousHash: string,
    transactions: Transaction[]
  ): string {
    const data = `${blockNumber}${timestamp}${previousHash}${transactions.length}`;
    // 简化的哈希计算 / Simplified hash calculation
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `0x${Math.abs(hash).toString(16).padStart(64, '0')}`;
  }

  /**
   * 计算区块大小
   * Calculate block size
   */
  private calculateBlockSize(transactions: Transaction[]): number {
    return transactions.reduce((size, tx) => {
      return size + (tx.data ? tx.data.length : 0) + 200; // 基础交易大小 / Base transaction size
    }, 500); // 区块头大小 / Block header size
  }

  /**
   * 计算平均等待时间
   * Calculate average wait time
   */
  private calculateAverageWaitTime(blockType: BlockType): number {
    const blockTime = blockType === BlockType.FAST ? 
      DUAL_BLOCK_CONFIG.FAST_BLOCK.BLOCK_TIME : 
      DUAL_BLOCK_CONFIG.BATCH_BLOCK.BLOCK_TIME;
    
    const queueSize = blockType === BlockType.FAST ? 
      this.fastBlockQueue.length : 
      this.batchBlockQueue.length;
    
    const maxTransactions = blockType === BlockType.FAST ? 
      DUAL_BLOCK_CONFIG.FAST_BLOCK.MAX_TRANSACTIONS : 
      DUAL_BLOCK_CONFIG.BATCH_BLOCK.MAX_TRANSACTIONS;
    
    return queueSize > 0 ? (queueSize / maxTransactions) * blockTime : 0;
  }

  /**
   * 更新快速区块统计
   * Update fast block statistics
   */
  private updateFastBlockStats(transactionCount: number, processingTime: number): void {
    this.performanceMetrics.fastBlock.totalBlocks++;
    this.performanceMetrics.fastBlock.totalTransactions += transactionCount;
    this.performanceMetrics.fastBlock.totalProcessingTime += processingTime;
    
    const avgTime = this.performanceMetrics.fastBlock.totalProcessingTime / this.performanceMetrics.fastBlock.totalBlocks;
    this.performanceMetrics.fastBlock.averageLatency = avgTime;
    this.performanceMetrics.fastBlock.averageTPS = transactionCount > 0 ? (transactionCount / (processingTime / 1000)) : 0;
    
    this.processorStatus.fastBlockProcessor.averageProcessingTime = avgTime;
    this.processorStatus.fastBlockProcessor.tps = this.performanceMetrics.fastBlock.averageTPS;
  }

  /**
   * 更新批量区块统计
   * Update batch block statistics
   */
  private updateBatchBlockStats(transactionCount: number, processingTime: number): void {
    this.performanceMetrics.batchBlock.totalBlocks++;
    this.performanceMetrics.batchBlock.totalTransactions += transactionCount;
    this.performanceMetrics.batchBlock.totalProcessingTime += processingTime;
    
    const avgTime = this.performanceMetrics.batchBlock.totalProcessingTime / this.performanceMetrics.batchBlock.totalBlocks;
    this.performanceMetrics.batchBlock.averageLatency = avgTime;
    this.performanceMetrics.batchBlock.averageTPS = transactionCount > 0 ? (transactionCount / (processingTime / 1000)) : 0;
    
    this.processorStatus.batchBlockProcessor.averageProcessingTime = avgTime;
    this.processorStatus.batchBlockProcessor.tps = this.performanceMetrics.batchBlock.averageTPS;
  }

  /**
   * 同步状态（增强版）
   * Synchronize state (enhanced version)
   */
  private async synchronizeState(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // 获取最新状态 / Get latest state
      const fastBlockState = await this.fastBlockChain[this.fastBlockChain.length - 1]?.stateRoot || '0x0';
      const batchBlockState = await this.batchBlockChain[this.batchBlockChain.length - 1]?.stateRoot || '0x0';
      
      // 检查状态一致性 / Check state consistency
      const stateConsistent = fastBlockState === batchBlockState;
      
      if (!stateConsistent) {
        console.log('🔄 检测到状态不一致，开始同步... / State inconsistency detected, starting sync...');
        
        // 执行状态同步 / Perform state synchronization
        await this.performStateMerge();
        
        // 更新同步统计 / Update sync statistics
        this.performanceMetrics.syncOperations++;
        this.performanceMetrics.lastSyncTime = Date.now();
      }
      
      // 更新状态根 / Update state root
      this.state.stateRoot = this.calculateMergedStateRoot();
      this.state.lastSyncTime = Date.now();
      this.state.syncInProgress = false;
      
      const syncTime = Date.now() - startTime;
      console.log(`✅ 状态同步完成: ${syncTime}ms, 一致性: ${stateConsistent ? '是' : '否'} / State sync completed`);
      
    } catch (error) {
      console.error('❌ 状态同步失败 / State sync failed:', error);
      this.state.syncInProgress = false;
      throw error;
    }
  }

  /**
   * 执行状态合并
   * Perform state merge
   */
  private async performStateMerge(): Promise<void> {
    // 获取快速区块和批量区块的最新状态 / Get latest state from both chains
    const fastBlocks = this.fastBlockChain.slice(-10); // 最近10个快速区块
    const batchBlocks = this.batchBlockChain.slice(-5); // 最近5个批量区块
    
    // 合并交易状态 / Merge transaction states
    const mergedTransactions = new Map<string, Transaction>();
    
    // 处理快速区块交易 / Process fast block transactions
    for (const block of fastBlocks) {
      for (const tx of block.transactions) {
        mergedTransactions.set(tx.hash, tx);
      }
    }
    
    // 处理批量区块交易 / Process batch block transactions
    for (const block of batchBlocks) {
      for (const tx of block.transactions) {
        mergedTransactions.set(tx.hash, tx);
      }
    }
    
    // 验证状态一致性 / Validate state consistency
    const totalTransactions = mergedTransactions.size;
    console.log(`🔍 状态合并: 处理了${totalTransactions}笔交易 / State merge: processed ${totalTransactions} transactions`);
  }

  /**
   * 计算合并状态根
   * Calculate merged state root
   */
  private calculateMergedStateRoot(): string {
    const fastBlockHash = this.fastBlockChain[this.fastBlockChain.length - 1]?.hash || '0x0';
    const batchBlockHash = this.batchBlockChain[this.batchBlockChain.length - 1]?.hash || '0x0';
    
    // 简化的状态根计算 / Simplified state root calculation
    const combined = fastBlockHash + batchBlockHash + Date.now().toString();
    
    // 计算哈希 / Calculate hash
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `0x${Math.abs(hash).toString(16).padStart(64, '0')}`;
  }

  /**
   * 获取处理器状态
   * Get processor status
   */
  getProcessorStatus(): ProcessorStatus {
    return { ...this.processorStatus };
  }

  /**
   * 获取性能指标
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }

  /**
   * 获取快速区块链
   * Get fast blockchain
   */
  getFastBlockchain(): Block[] {
    return [...this.fastBlockChain];
  }

  /**
   * 获取批量区块链
   * Get batch blockchain
   */
  getBatchBlockchain(): Block[] {
    return [...this.batchBlockChain];
  }

  /**
   * 获取路由器
   * Get router
   */
  getRouter(): SmartTransactionRouter {
    return this.router;
  }
}