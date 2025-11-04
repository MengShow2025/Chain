/**
 * TitanChain 双区块管理器
 * Dual Block Manager
 */

import { Block, Transaction } from '../../shared/types/blockchain.js';
import { TransactionPool } from './transaction-pool.js';
import { TransactionRouter } from './transaction-router.js';
import { EVMExecutor } from '../evm/evm-executor.js';
import { PoSConsensus } from '../consensus/pos-consensus.js';
import { BlockValidator } from './block-validator.js';
import { 
  BlockType, 
  DUAL_BLOCK_CONFIG, 
  BLOCK_PRODUCER_CONFIG,
  PERFORMANCE_MONITORING 
} from './dual-block-config.js';

// 区块生产状态 / Block Production Status
interface BlockProductionStatus {
  isProducing: boolean;                  // 是否正在生产 / Is producing
  lastBlockTime: number;                 // 上次出块时间 / Last block time
  blockCount: number;                    // 区块计数 / Block count
  averageLatency: number;                // 平均延迟 / Average latency
  errorCount: number;                    // 错误计数 / Error count
}

// 交易队列 / Transaction Queue
interface TransactionQueue {
  transactions: Transaction[];           // 交易列表 / Transaction list
  totalGas: bigint;                     // 总Gas / Total gas
  lastUpdate: number;                   // 最后更新时间 / Last update time
}

/**
 * 双区块管理器
 * Dual Block Manager
 */
export class DualBlockManager {
  private transactionPool: TransactionPool;
  private transactionRouter: TransactionRouter;
  private evmExecutor: EVMExecutor;
  private consensusEngine: PoSConsensus;
  private blockValidator: BlockValidator;

  // 区块生产状态 / Block production status
  private fastBlockStatus: BlockProductionStatus;
  private batchBlockStatus: BlockProductionStatus;

  // 交易队列 / Transaction queues
  private fastQueue: TransactionQueue;
  private batchQueue: TransactionQueue;

  // 定时器 / Timers
  private fastBlockTimer: NodeJS.Timeout | null = null;
  private batchBlockTimer: NodeJS.Timeout | null = null;

  // 运行状态 / Running status
  private isRunning: boolean = false;

  constructor(
    transactionPool: TransactionPool,
    evmExecutor: EVMExecutor,
    consensusEngine: PoSConsensus,
    blockValidator: BlockValidator
  ) {
    this.transactionPool = transactionPool;
    this.transactionRouter = new TransactionRouter();
    this.evmExecutor = evmExecutor;
    this.consensusEngine = consensusEngine;
    this.blockValidator = blockValidator;

    // 初始化状态 / Initialize status
    this.fastBlockStatus = this.createInitialStatus();
    this.batchBlockStatus = this.createInitialStatus();

    // 初始化队列 / Initialize queues
    this.fastQueue = this.createEmptyQueue();
    this.batchQueue = this.createEmptyQueue();

    console.log('🏗️ 双区块管理器已初始化 / Dual Block Manager initialized');
  }

  /**
   * 启动双区块生产
   * Start dual block production
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ 双区块管理器已在运行 / Dual Block Manager already running');
      return;
    }

    console.log('🚀 启动双区块生产系统 / Starting dual block production system');
    this.isRunning = true;

    try {
      // 启动快速区块生产 / Start fast block production
      if (BLOCK_PRODUCER_CONFIG.FAST_PRODUCER.ENABLED) {
        this.startFastBlockProduction();
      }

      // 启动批量区块生产 / Start batch block production
      if (BLOCK_PRODUCER_CONFIG.BATCH_PRODUCER.ENABLED) {
        this.startBatchBlockProduction();
      }

      // 启动交易路由处理 / Start transaction routing
      this.startTransactionRouting();

      console.log('✅ 双区块生产系统启动成功 / Dual block production system started successfully');

    } catch (error) {
      console.error('❌ 启动双区块生产系统失败 / Failed to start dual block production system:', error);
      await this.stop();
      throw error;
    }
  }

  /**
   * 停止双区块生产
   * Stop dual block production
   */
  async stop(): Promise<void> {
    console.log('🛑 停止双区块生产系统 / Stopping dual block production system');
    this.isRunning = false;

    // 清除定时器 / Clear timers
    if (this.fastBlockTimer) {
      clearInterval(this.fastBlockTimer);
      this.fastBlockTimer = null;
    }

    if (this.batchBlockTimer) {
      clearInterval(this.batchBlockTimer);
      this.batchBlockTimer = null;
    }

    console.log('✅ 双区块生产系统已停止 / Dual block production system stopped');
  }

  /**
   * 启动快速区块生产
   * Start fast block production
   */
  private startFastBlockProduction(): void {
    const blockTime = DUAL_BLOCK_CONFIG.FAST_BLOCK.BLOCK_TIME;
    
    this.fastBlockTimer = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        await this.produceFastBlock();
      } catch (error) {
        console.error('❌ 快速区块生产错误 / Fast block production error:', error);
        this.fastBlockStatus.errorCount++;
      }
    }, blockTime);

    console.log(`⚡ 快速区块生产已启动，间隔 ${blockTime}ms / Fast block production started with ${blockTime}ms interval`);
  }

  /**
   * 启动批量区块生产
   * Start batch block production
   */
  private startBatchBlockProduction(): void {
    const blockTime = DUAL_BLOCK_CONFIG.BATCH_BLOCK.BLOCK_TIME;
    
    this.batchBlockTimer = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        await this.produceBatchBlock();
      } catch (error) {
        console.error('❌ 批量区块生产错误 / Batch block production error:', error);
        this.batchBlockStatus.errorCount++;
      }
    }, blockTime);

    console.log(`📦 批量区块生产已启动，间隔 ${blockTime}ms / Batch block production started with ${blockTime}ms interval`);
  }

  /**
   * 启动交易路由处理
   * Start transaction routing
   */
  private startTransactionRouting(): void {
    // 定期处理交易池中的新交易 / Periodically process new transactions from pool
    setInterval(async () => {
      if (!this.isRunning) return;

      try {
        await this.processNewTransactions();
      } catch (error) {
        console.error('❌ 交易路由处理错误 / Transaction routing error:', error);
      }
    }, 100); // 每100ms处理一次 / Process every 100ms

    console.log('🚦 交易路由处理已启动 / Transaction routing started');
  }

  /**
   * 处理新交易
   * Process new transactions
   */
  private async processNewTransactions(): Promise<void> {
    // 从交易池获取待处理交易 / Get pending transactions from pool
    const pendingTransactions = this.transactionPool.getPendingTransactions();
    
    if (pendingTransactions.length === 0) return;

    console.log(`🔄 处理 ${pendingTransactions.length} 个待路由交易 / Processing ${pendingTransactions.length} transactions for routing`);

    // 路由每个交易 / Route each transaction
    for (const tx of pendingTransactions) {
      try {
        const decision = await this.transactionRouter.routeTransaction(tx);
        
        // 根据路由决策添加到相应队列 / Add to appropriate queue based on routing decision
        if (decision.blockType === BlockType.FAST) {
          this.addToFastQueue(tx);
        } else {
          this.addToBatchQueue(tx);
        }

        // 从交易池中移除已路由的交易 / Remove routed transaction from pool
        this.transactionPool.removeTransaction(tx.hash);

      } catch (error) {
        console.error(`❌ 路由交易 ${tx.hash} 失败 / Failed to route transaction ${tx.hash}:`, error);
      }
    }

    // 更新路由器的队列状态 / Update router queue status
    this.updateRouterQueueStatus();
  }

  /**
   * 生产快速区块
   * Produce fast block
   */
  private async produceFastBlock(): Promise<Block | null> {
    if (this.fastQueue.transactions.length === 0) {
      return null; // 没有交易需要处理 / No transactions to process
    }

    const startTime = Date.now();
    this.fastBlockStatus.isProducing = true;

    try {
      console.log(`⚡ 开始生产快速区块，队列中有 ${this.fastQueue.transactions.length} 个交易 / Starting fast block production with ${this.fastQueue.transactions.length} transactions`);

      // 选择交易 / Select transactions
      const transactions = this.selectTransactionsForFastBlock();
      
      if (transactions.length === 0) {
        return null;
      }

      // 生产区块 / Produce block
      const block = await this.produceBlock(BlockType.FAST, transactions);
      
      if (block) {
        // 从队列中移除已打包的交易 / Remove packaged transactions from queue
        this.removeTransactionsFromQueue(this.fastQueue, transactions);
        
        // 更新状态 / Update status
        this.updateBlockProductionStatus(this.fastBlockStatus, startTime);
        
        console.log(`✅ 快速区块 #${block.number} 生产成功，包含 ${transactions.length} 个交易 / Fast block #${block.number} produced successfully with ${transactions.length} transactions`);
      }

      return block;

    } catch (error) {
      console.error('❌ 快速区块生产失败 / Fast block production failed:', error);
      return null;
    } finally {
      this.fastBlockStatus.isProducing = false;
    }
  }

  /**
   * 生产批量区块
   * Produce batch block
   */
  private async produceBatchBlock(): Promise<Block | null> {
    if (this.batchQueue.transactions.length === 0) {
      return null; // 没有交易需要处理 / No transactions to process
    }

    const startTime = Date.now();
    this.batchBlockStatus.isProducing = true;

    try {
      console.log(`📦 开始生产批量区块，队列中有 ${this.batchQueue.transactions.length} 个交易 / Starting batch block production with ${this.batchQueue.transactions.length} transactions`);

      // 选择交易 / Select transactions
      const transactions = this.selectTransactionsForBatchBlock();
      
      if (transactions.length === 0) {
        return null;
      }

      // 生产区块 / Produce block
      const block = await this.produceBlock(BlockType.BATCH, transactions);
      
      if (block) {
        // 从队列中移除已打包的交易 / Remove packaged transactions from queue
        this.removeTransactionsFromQueue(this.batchQueue, transactions);
        
        // 更新状态 / Update status
        this.updateBlockProductionStatus(this.batchBlockStatus, startTime);
        
        console.log(`✅ 批量区块 #${block.number} 生产成功，包含 ${transactions.length} 个交易 / Batch block #${block.number} produced successfully with ${transactions.length} transactions`);
      }

      return block;

    } catch (error) {
      console.error('❌ 批量区块生产失败 / Batch block production failed:', error);
      return null;
    } finally {
      this.batchBlockStatus.isProducing = false;
    }
  }

  /**
   * 生产区块
   * Produce block
   */
  private async produceBlock(blockType: BlockType, transactions: Transaction[]): Promise<Block | null> {
    try {
      // 获取区块配置 / Get block configuration
      const config = blockType === BlockType.FAST 
        ? DUAL_BLOCK_CONFIG.FAST_BLOCK 
        : DUAL_BLOCK_CONFIG.BATCH_BLOCK;

      // 选择区块生产者 / Select block producer
      const producer = await this.consensusEngine.selectBlockProducer(Date.now());
      if (!producer) {
        console.error('❌ 无法选择区块生产者 / Cannot select block producer');
        return null;
      }

      // 执行交易 / Execute transactions
      const executionResults = [];
      let totalGasUsed = BigInt(0);

      for (const tx of transactions) {
        const result = await this.evmExecutor.executeTransaction(tx);
        executionResults.push(result);
        totalGasUsed += result.gasUsed;

        // 检查Gas限制 / Check gas limit
        if (totalGasUsed > config.GAS_LIMIT) {
          console.log(`⚠️ 达到${blockType}区块Gas限制，停止添加交易 / Reached ${blockType} block gas limit, stopping transaction addition`);
          break;
        }
      }

      // 创建区块 / Create block
      const blockNumber = await this.getNextBlockNumber();
      const parentHash = await this.getLatestBlockHash();

      const block: Block = {
        number: blockNumber,
        hash: this.calculateBlockHash(blockNumber, parentHash, producer, transactions),
        parentHash,
        timestamp: Date.now(),
        validator: producer,
        transactions: transactions.slice(0, executionResults.length), // 只包含成功执行的交易 / Only include successfully executed transactions
        transactionsRoot: this.calculateTransactionsRoot(transactions),
        receiptsRoot: this.calculateReceiptsRoot(executionResults),
        stateRoot: this.evmExecutor.getStateRoot(),
        gasUsed: totalGasUsed,
        gasLimit: config.GAS_LIMIT,
        difficulty: BigInt(1),
        size: this.calculateBlockSize(transactions),
        nonce: `0x${blockNumber.toString(16).padStart(16, '0')}`,
        reward: BigInt(0) // 奖励计算将在共识层处理 / Reward calculation will be handled in consensus layer
      };

      // 验证区块 / Validate block
      const parentBlock = await this.getParentBlock(parentHash);
      if (!await this.blockValidator.validateBlock(block, parentBlock)) {
        console.error('❌ 区块验证失败 / Block validation failed');
        return null;
      }

      // 处理区块 / Process block
      if (!await this.consensusEngine.processNewBlock(block)) {
        console.error('❌ 区块处理失败 / Block processing failed');
        return null;
      }

      return block;

    } catch (error) {
      console.error('❌ 区块生产过程中发生错误 / Error during block production:', error);
      return null;
    }
  }

  /**
   * 为快速区块选择交易
   * Select transactions for fast block
   */
  private selectTransactionsForFastBlock(): Transaction[] {
    const config = DUAL_BLOCK_CONFIG.FAST_BLOCK;
    const selected: Transaction[] = [];
    let totalGas = BigInt(0);

    // 按优先级排序交易 / Sort transactions by priority
    const sortedTransactions = [...this.fastQueue.transactions].sort((a, b) => {
      const aPriority = Number(a.gasPrice || BigInt(0));
      const bPriority = Number(b.gasPrice || BigInt(0));
      return bPriority - aPriority; // 高Gas价格优先 / Higher gas price first
    });

    for (const tx of sortedTransactions) {
      const txGas = tx.gasLimit || BigInt('21000');
      
      // 检查Gas限制 / Check gas limit
      if (totalGas + txGas > config.GAS_LIMIT) {
        break;
      }

      // 检查交易数量限制 / Check transaction count limit
      if (selected.length >= config.MAX_TRANSACTIONS) {
        break;
      }

      selected.push(tx);
      totalGas += txGas;
    }

    return selected;
  }

  /**
   * 为批量区块选择交易
   * Select transactions for batch block
   */
  private selectTransactionsForBatchBlock(): Transaction[] {
    const config = DUAL_BLOCK_CONFIG.BATCH_BLOCK;
    const selected: Transaction[] = [];
    let totalGas = BigInt(0);

    // 按优先级排序交易 / Sort transactions by priority
    const sortedTransactions = [...this.batchQueue.transactions].sort((a, b) => {
      const aPriority = Number(a.gasPrice || BigInt(0));
      const bPriority = Number(b.gasPrice || BigInt(0));
      return bPriority - aPriority; // 高Gas价格优先 / Higher gas price first
    });

    for (const tx of sortedTransactions) {
      const txGas = tx.gasLimit || BigInt('21000');
      
      // 检查Gas限制 / Check gas limit
      if (totalGas + txGas > config.GAS_LIMIT) {
        break;
      }

      // 检查交易数量限制 / Check transaction count limit
      if (selected.length >= config.MAX_TRANSACTIONS) {
        break;
      }

      selected.push(tx);
      totalGas += txGas;
    }

    return selected;
  }

  /**
   * 添加交易到快速队列
   * Add transaction to fast queue
   */
  private addToFastQueue(tx: Transaction): void {
    this.fastQueue.transactions.push(tx);
    this.fastQueue.totalGas += tx.gasLimit || BigInt('21000');
    this.fastQueue.lastUpdate = Date.now();
    
    console.log(`⚡ 交易 ${tx.hash} 已添加到快速队列 / Transaction ${tx.hash} added to fast queue`);
  }

  /**
   * 添加交易到批量队列
   * Add transaction to batch queue
   */
  private addToBatchQueue(tx: Transaction): void {
    this.batchQueue.transactions.push(tx);
    this.batchQueue.totalGas += tx.gasLimit || BigInt('21000');
    this.batchQueue.lastUpdate = Date.now();
    
    console.log(`📦 交易 ${tx.hash} 已添加到批量队列 / Transaction ${tx.hash} added to batch queue`);
  }

  /**
   * 从队列中移除交易
   * Remove transactions from queue
   */
  private removeTransactionsFromQueue(queue: TransactionQueue, transactions: Transaction[]): void {
    const txHashes = new Set(transactions.map(tx => tx.hash));
    
    queue.transactions = queue.transactions.filter(tx => !txHashes.has(tx.hash));
    
    // 重新计算总Gas / Recalculate total gas
    queue.totalGas = queue.transactions.reduce(
      (sum, tx) => sum + (tx.gasLimit || BigInt('21000')), 
      BigInt(0)
    );
    
    queue.lastUpdate = Date.now();
  }

  /**
   * 更新路由器队列状态
   * Update router queue status
   */
  private updateRouterQueueStatus(): void {
    this.transactionRouter.updateQueueStatus({
      fastQueueSize: this.fastQueue.transactions.length,
      batchQueueSize: this.batchQueue.transactions.length,
      fastQueueLoad: this.calculateQueueLoad(this.fastQueue, DUAL_BLOCK_CONFIG.FAST_BLOCK.GAS_LIMIT),
      batchQueueLoad: this.calculateQueueLoad(this.batchQueue, DUAL_BLOCK_CONFIG.BATCH_BLOCK.GAS_LIMIT)
    });
  }

  /**
   * 计算队列负载
   * Calculate queue load
   */
  private calculateQueueLoad(queue: TransactionQueue, gasLimit: bigint): number {
    if (queue.totalGas === BigInt(0)) return 0;
    return Math.min(Number(queue.totalGas) / Number(gasLimit), 1.0);
  }

  /**
   * 更新区块生产状态
   * Update block production status
   */
  private updateBlockProductionStatus(status: BlockProductionStatus, startTime: number): void {
    const latency = Date.now() - startTime;
    
    status.lastBlockTime = Date.now();
    status.blockCount++;
    status.averageLatency = (status.averageLatency * (status.blockCount - 1) + latency) / status.blockCount;
  }

  /**
   * 创建初始状态
   * Create initial status
   */
  private createInitialStatus(): BlockProductionStatus {
    return {
      isProducing: false,
      lastBlockTime: 0,
      blockCount: 0,
      averageLatency: 0,
      errorCount: 0
    };
  }

  /**
   * 创建空队列
   * Create empty queue
   */
  private createEmptyQueue(): TransactionQueue {
    return {
      transactions: [],
      totalGas: BigInt(0),
      lastUpdate: Date.now()
    };
  }

  // 辅助方法 / Helper methods
  private async getNextBlockNumber(): Promise<number> {
    // 这里应该从区块链状态获取下一个区块号 / Should get next block number from blockchain state
    return Date.now(); // 临时实现 / Temporary implementation
  }

  private async getLatestBlockHash(): Promise<string> {
    // 这里应该从区块链状态获取最新区块哈希 / Should get latest block hash from blockchain state
    return '0x0000000000000000000000000000000000000000000000000000000000000000'; // 临时实现 / Temporary implementation
  }

  private async getParentBlock(parentHash: string): Promise<Block | null> {
    // 这里应该从区块链状态获取父区块 / Should get parent block from blockchain state
    return null; // 临时实现 / Temporary implementation
  }

  private calculateBlockHash(number: number, parentHash: string, validator: string, transactions: Transaction[]): string {
    // 简化的哈希计算 / Simplified hash calculation
    return `0x${number.toString(16).padStart(64, '0')}`;
  }

  private calculateTransactionsRoot(transactions: Transaction[]): string {
    // 简化的Merkle根计算 / Simplified Merkle root calculation
    return `0x${transactions.length.toString(16).padStart(64, '0')}`;
  }

  private calculateReceiptsRoot(results: any[]): string {
    // 简化的收据根计算 / Simplified receipts root calculation
    return `0x${results.length.toString(16).padStart(64, '0')}`;
  }

  private calculateBlockSize(transactions: Transaction[]): number {
    // 简化的区块大小计算 / Simplified block size calculation
    return transactions.length * 1000; // 假设每个交易1KB / Assume 1KB per transaction
  }

  /**
   * 获取系统状态
   * Get system status
   */
  getSystemStatus() {
    return {
      isRunning: this.isRunning,
      fastBlock: {
        ...this.fastBlockStatus,
        queueSize: this.fastQueue.transactions.length,
        totalGas: this.fastQueue.totalGas.toString()
      },
      batchBlock: {
        ...this.batchBlockStatus,
        queueSize: this.batchQueue.transactions.length,
        totalGas: this.batchQueue.totalGas.toString()
      },
      routingStats: Object.fromEntries(this.transactionRouter.getRoutingStats()),
      performanceMetrics: Object.fromEntries(this.transactionRouter.getPerformanceMetrics())
    };
  }
}