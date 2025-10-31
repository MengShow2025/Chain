import { Block, Transaction, Validator, NetworkStats } from '../../shared/types/blockchain.js';
import { CONSENSUS_CONFIG, PERFORMANCE_CONFIG } from '../../shared/constants/blockchain.js';
import { PoSConsensus } from '../consensus/pos-consensus.js';
import { ValidatorManager } from '../consensus/validator-manager.js';
import { EVMExecutor } from '../evm/evm-executor.js';
import { TransactionPool } from './transaction-pool.js';
import { BlockValidator } from './block-validator.js';
import { ZeroGasEngine } from './zero-gas-engine.js';
import { HighPerformanceProcessor } from './high-performance-processor.js';

/**
 * TitanChain主链核心
 * 高性能PoS共识机制和EVM兼容执行环境
 */
export class TitanChain {
  private consensusEngine: PoSConsensus;
  private validatorManager: ValidatorManager;
  private evmEngine: EVMExecutor;
  private transactionPool: TransactionPool;
  private blockValidator: BlockValidator;
  private zeroGasEngine: ZeroGasEngine;
  private performanceProcessor: HighPerformanceProcessor;
  
  private blockchain: Block[] = [];
  private currentBlock: Block | null = null;
  private isRunning: boolean = false;
  private blockProductionInterval: NodeJS.Timeout | null = null;
  
  // 网络统计
  private networkStats: NetworkStats = {
    totalBlocks: 0,
    totalTransactions: 0,
    totalValidators: 0,
    networkHashRate: BigInt(0),
    averageBlockTime: CONSENSUS_CONFIG.BLOCK_TIME * 1000,
    tps: 0,
    lastBlockTime: Date.now()
  };
  
  constructor() {
    console.log('Initializing TitanChain...');
    
    this.consensusEngine = new PoSConsensus();
    this.validatorManager = new ValidatorManager();
    this.evmEngine = new EVMExecutor();
    this.transactionPool = new TransactionPool();
    this.blockValidator = new BlockValidator();
    this.zeroGasEngine = new ZeroGasEngine();
    this.performanceProcessor = new HighPerformanceProcessor(this.transactionPool);
    
    console.log('TitanChain initialized successfully');
  }
  
  /**
   * 启动区块链网络
   */
  async start(genesisValidators: Validator[]): Promise<void> {
    try {
      console.log('Starting TitanChain network...');
      
      // 初始化各个组件
      await this.consensusEngine.initialize(genesisValidators);
      await this.validatorManager.initialize(genesisValidators);
      await this.evmEngine.initialize();
      
      // 创建创世区块
      await this.createGenesisBlock();
      
      // 启动区块生产
      this.startBlockProduction();
      
      // 启动验证节点选举
      this.startValidatorElection();
      
      this.isRunning = true;
      console.log('TitanChain network started successfully');
      
    } catch (error) {
      console.error('Failed to start TitanChain network:', error);
      throw error;
    }
  }
  
  /**
   * 停止区块链网络
   */
  async stop(): Promise<void> {
    console.log('Stopping TitanChain network...');
    
    this.isRunning = false;
    
    if (this.blockProductionInterval) {
      clearInterval(this.blockProductionInterval);
      this.blockProductionInterval = null;
    }
    
    console.log('TitanChain network stopped');
  }
  
  /**
   * 创建创世区块
   */
  private async createGenesisBlock(): Promise<void> {
    const genesisBlock: Block = {
      number: 0,
      hash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      parentHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      timestamp: Date.now(),
      validator: '0x0000000000000000000000000000000000000000',
      transactions: [],
      transactionsRoot: '0x0000000000000000000000000000000000000000000000000000000000000000',
      receiptsRoot: '0x0000000000000000000000000000000000000000000000000000000000000000',
      stateRoot: '0x0000000000000000000000000000000000000000000000000000000000000000',
      gasUsed: BigInt(0),
      gasLimit: PERFORMANCE_CONFIG.MAX_GAS_LIMIT,
      difficulty: BigInt(1),
      size: 1024,
      extraData: 'TitanChain Genesis Block'
    };
    
    this.blockchain.push(genesisBlock);
    this.currentBlock = genesisBlock;
    this.networkStats.totalBlocks = 1;
    
    console.log('Genesis block created');
  }
  
  /**
   * 启动区块生产
   */
  private startBlockProduction(): void {
    const blockTime = CONSENSUS_CONFIG.BLOCK_TIME * 1000;
    
    this.blockProductionInterval = setInterval(async () => {
      if (!this.isRunning) return;
      
      try {
        await this.produceBlock();
      } catch (error) {
        console.error('Error producing block:', error);
      }
    }, blockTime);
    
    console.log(`Block production started with ${CONSENSUS_CONFIG.BLOCK_TIME}s interval`);
  }
  
  /**
   * 启动验证节点选举
   */
  private startValidatorElection(): void {
    const electionInterval = CONSENSUS_CONFIG.ELECTION_INTERVAL * 1000;
    
    setInterval(async () => {
      if (!this.isRunning) return;
      
      try {
        await this.validatorManager.conductElection();
      } catch (error) {
        console.error('Error conducting validator election:', error);
      }
    }, electionInterval);
    
    console.log(`Validator election started with ${CONSENSUS_CONFIG.ELECTION_INTERVAL}s interval`);
  }
  
  /**
   * 生产新区块
   */
  private async produceBlock(): Promise<Block | null> {
    try {
      if (!this.currentBlock) {
        console.error('No current block available');
        return null;
      }
      
      const nextBlockNumber = this.currentBlock.number + 1;
      
      // 选择区块生产者
      const producer = this.consensusEngine.selectBlockProducer(nextBlockNumber);
      if (!producer) {
        console.error('No block producer selected');
        return null;
      }
      
      // 获取待打包交易
      const transactions = this.transactionPool.getTransactionsForBlock(
        PERFORMANCE_CONFIG.MAX_GAS_LIMIT,
        PERFORMANCE_CONFIG.MAX_TRANSACTIONS_PER_BLOCK
      );
      
      // 执行交易
      const executionResults = await this.evmEngine.executeTransactions(transactions);
      
      // 计算gas使用量
      const gasUsed = executionResults.reduce((sum, result) => sum + result.gasUsed, BigInt(0));
      
      // 创建新区块
      const newBlock: Block = {
        number: nextBlockNumber,
        hash: this.calculateBlockHash(nextBlockNumber, this.currentBlock.hash, producer, transactions),
        parentHash: this.currentBlock.hash,
        timestamp: Date.now(),
        validator: producer,
        transactions,
        transactionsRoot: this.calculateTransactionsRoot(transactions),
        receiptsRoot: this.calculateReceiptsRoot(executionResults),
        stateRoot: await this.evmEngine.getStateRoot(),
        gasUsed,
        gasLimit: PERFORMANCE_CONFIG.MAX_GAS_LIMIT,
        difficulty: BigInt(1),
        size: this.calculateBlockSize(transactions),
        extraData: `Block produced by ${producer}`
      };
      
      // 验证区块
      if (!await this.blockValidator.validateBlock(newBlock, this.currentBlock)) {
        console.error('Block validation failed');
        return null;
      }
      
      // 处理区块
      if (!await this.consensusEngine.processNewBlock(newBlock)) {
        console.error('Block processing failed');
        return null;
      }
      
      // 添加到区块链
      this.blockchain.push(newBlock);
      this.currentBlock = newBlock;
      
      // 从交易池中移除已打包交易
      this.transactionPool.removeTransactions(transactions.map(tx => tx.hash));
      
      // 更新网络统计
      this.updateNetworkStats(newBlock);
      
      console.log(`Block #${newBlock.number} produced by ${producer} with ${transactions.length} transactions`);
      return newBlock;
      
    } catch (error) {
      console.error('Error producing block:', error);
      return null;
    }
  }
  
  /**
   * 提交交易
   */
  async submitTransaction(tx: Transaction): Promise<boolean> {
    try {
      console.log(`Submitting transaction ${tx.hash}`);
      
      // 检查是否为0-gas费交易
      if (tx.isZeroGas) {
        const eligibility = this.zeroGasEngine.canProcessAsZeroGas(tx);
        if (!eligibility.eligible) {
          console.error(`Zero-gas transaction rejected: ${eligibility.reason}`);
          return false;
        }
      }
      
      // 添加到高性能处理器
      this.performanceProcessor.addTransaction(tx);
      
      // 添加到交易池
      const success = await this.transactionPool.addTransaction(tx);
      
      if (success) {
        console.log(`Transaction ${tx.hash} added to pool`);
      } else {
        console.error(`Failed to add transaction ${tx.hash} to pool`);
      }
      
      return success;
      
    } catch (error) {
      console.error('Error submitting transaction:', error);
      return false;
    }
  }
  
  /**
   * 获取区块
   */
  getBlock(blockNumber: number): Block | null {
    return this.blockchain.find(block => block.number === blockNumber) || null;
  }
  
  /**
   * 获取最新区块
   */
  getLatestBlock(): Block | null {
    return this.currentBlock;
  }
  
  /**
   * 获取交易
   */
  getTransaction(txHash: string): Transaction | null {
    for (const block of this.blockchain) {
      const tx = block.transactions.find(t => t.hash === txHash);
      if (tx) return tx;
    }
    
    // 检查交易池
    return this.transactionPool.getTransaction(txHash);
  }
  
  /**
   * 获取网络统计
   */
  getNetworkStats(): NetworkStats {
    return { ...this.networkStats };
  }
  
  /**
   * 获取验证节点统计
   */
  getValidatorStats() {
    return this.validatorManager.getValidatorStats();
  }
  
  /**
   * 获取验证节点排名
   */
  getValidatorRankings() {
    return this.validatorManager.getValidatorRankings();
  }
  
  /**
   * 获取候补节点排名
   */
  getCandidateRankings() {
    return this.validatorManager.getCandidateRankings();
  }
  
  /**
   * 获取选举统计
   */
  getElectionStats() {
    return this.validatorManager.getElectionStats();
  }
  
  /**
   * 获取候补节点管理统计
   */
  getCandidateManagerStats() {
    return this.validatorManager.getCandidateManagerStats();
  }
  
  /**
   * 获取网络健康状态
   */
  getNetworkHealth() {
    return this.validatorManager.getNetworkHealth();
  }
  
  /**
   * 强制进行验证节点选举
   */
  async forceValidatorElection(): Promise<boolean> {
    return await this.validatorManager.forceElection();
  }
  
  /**
   * 处理验证节点离线
   */
  async handleValidatorOffline(address: string): Promise<void> {
    await this.validatorManager.handleValidatorOffline(address);
  }
  
  /**
   * 处理验证节点上线
   */
  async handleValidatorOnline(address: string): Promise<void> {
    await this.validatorManager.handleValidatorOnline(address);
  }
  
  /**
   * 获取交易池统计
   */
  getTransactionPoolStats() {
    return this.transactionPool.getPoolStats();
  }
  
  /**
   * 注册候补验证节点
   */
  async registerValidatorCandidate(candidate: any): Promise<boolean> {
    return await this.validatorManager.registerCandidate(candidate);
  }
  
  /**
   * 更新验证节点质押
   */
  async updateValidatorStake(address: string, newStake: bigint): Promise<boolean> {
    const success = await this.validatorManager.updateValidatorStake(address, newStake);
    if (success) {
      await this.consensusEngine.updateValidatorStake(address, newStake);
    }
    return success;
  }
  
  /**
   * 计算区块哈希
   */
  private calculateBlockHash(blockNumber: number, parentHash: string, validator: string, transactions: Transaction[]): string {
    const data = `${blockNumber}${parentHash}${validator}${transactions.map(tx => tx.hash).join('')}${Date.now()}`;
    return '0x' + Buffer.from(data).toString('hex').substring(0, 64).padStart(64, '0');
  }
  
  /**
   * 计算交易根哈希
   */
  private calculateTransactionsRoot(transactions: Transaction[]): string {
    if (transactions.length === 0) {
      return '0x0000000000000000000000000000000000000000000000000000000000000000';
    }
    
    const txHashes = transactions.map(tx => tx.hash).join('');
    return '0x' + Buffer.from(txHashes).toString('hex').substring(0, 64).padStart(64, '0');
  }
  
  /**
   * 计算收据根哈希
   */
  private calculateReceiptsRoot(executionResults: any[]): string {
    if (executionResults.length === 0) {
      return '0x0000000000000000000000000000000000000000000000000000000000000000';
    }
    
    const receiptsData = executionResults.map(result => result.receipt || '').join('');
    return '0x' + Buffer.from(receiptsData).toString('hex').substring(0, 64).padStart(64, '0');
  }
  
  /**
   * 计算区块大小
   */
  private calculateBlockSize(transactions: Transaction[]): number {
    const baseSize = 1024; // 区块头等基础数据
    const txSize = transactions.reduce((sum, tx) => {
      return sum + tx.data.length + 200; // 交易数据 + 元数据
    }, 0);
    
    return baseSize + txSize;
  }
  
  /**
   * 更新网络统计
   */
  private updateNetworkStats(block: Block): void {
    this.networkStats.totalBlocks++;
    this.networkStats.totalTransactions += block.transactions.length;
    this.networkStats.totalValidators = this.validatorManager.getValidatorStats().activeValidators;
    this.networkStats.networkHashRate = BigInt(this.networkStats.totalValidators * 1000000);
    
    // 计算平均出块时间
    if (this.networkStats.totalBlocks > 1) {
      const timeDiff = block.timestamp - this.networkStats.lastBlockTime;
      this.networkStats.averageBlockTime = 
        (this.networkStats.averageBlockTime * (this.networkStats.totalBlocks - 1) + timeDiff) / 
        this.networkStats.totalBlocks;
    }
    
    // 计算TPS
    if (this.networkStats.averageBlockTime > 0) {
      this.networkStats.tps = (block.transactions.length * 1000) / this.networkStats.averageBlockTime;
    }
    
    this.networkStats.lastBlockTime = block.timestamp;
  }
  
  /**
   * 获取区块链高度
   */
  getBlockHeight(): number {
    return this.blockchain.length - 1;
  }
  
  /**
   * 检查网络是否运行
   */
  isNetworkRunning(): boolean {
    return this.isRunning;
  }
  
  /**
   * 获取0-gas费引擎统计
   */
  getZeroGasStats() {
    return this.zeroGasEngine.getEngineStats();
  }
  
  /**
   * 获取高性能处理器统计
   */
  getPerformanceStats() {
    return this.performanceProcessor.getStats();
  }
  
  /**
   * 获取性能指标
   */
  getPerformanceMetrics() {
    return this.performanceProcessor.getMetrics();
  }
  
  /**
   * 获取处理队列状态
   */
  getQueueStatus() {
    return this.performanceProcessor.getQueueStatus();
  }
  
  /**
   * 批量提交交易
   */
  async submitTransactions(transactions: Transaction[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;
    
    // 使用高性能处理器批量处理
    this.performanceProcessor.addTransactions(transactions);
    
    // 逐个验证并添加到交易池
    for (const tx of transactions) {
      try {
        // 检查0-gas费交易条件
        if (tx.isZeroGas) {
          const eligibility = this.zeroGasEngine.canProcessAsZeroGas(tx);
          if (!eligibility.eligible) {
            console.error(`Zero-gas transaction ${tx.hash} rejected: ${eligibility.reason}`);
            failed++;
            continue;
          }
        }
        
        const result = await this.transactionPool.addTransaction(tx);
        if (result) {
          success++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`Error processing transaction ${tx.hash}:`, error);
        failed++;
      }
    }
    
    console.log(`Batch submission completed: ${success} success, ${failed} failed`);
    return { success, failed };
  }
  
  /**
   * 获取交易所批量状态
   */
  getExchangeBatchStatus(batchId: string) {
    return this.zeroGasEngine.getBatchStatus(batchId);
  }
  
  /**
   * 获取合约层级使用统计
   */
  getContractTierStats() {
    return this.zeroGasEngine.getTierUsageStats();
  }
  
  /**
   * 获取每日限额使用情况
   */
  getDailyLimitUsage(exchangeId: string) {
    return this.zeroGasEngine.getDailyLimitUsage(exchangeId);
  }
  
  /**
   * 估算gas费用节省
   */
  estimateGasSavings(transactions: Transaction[]): bigint {
    return this.zeroGasEngine.estimateGasSavings(transactions);
  }
  
  /**
   * 优化性能处理参数
   */
  optimizePerformance(): void {
    this.performanceProcessor.optimizeProcessing();
  }
  
  /**
   * 获取完整的网络状态
   */
  getNetworkStatus() {
    return {
      isRunning: this.isRunning,
      blockHeight: this.getBlockHeight(),
      networkStats: this.getNetworkStats(),
      validatorStats: this.getValidatorStats(),
      transactionPoolStats: this.getTransactionPoolStats(),
      zeroGasStats: this.getZeroGasStats(),
      performanceStats: this.getPerformanceStats(),
      performanceMetrics: this.getPerformanceMetrics(),
      queueStatus: this.getQueueStatus()
    };
  }
}