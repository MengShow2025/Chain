import { Block, Transaction, Validator, NetworkStats } from '../../shared/types/blockchain.js';
import { CONSENSUS_CONFIG, PERFORMANCE_CONFIG } from '../../shared/constants/blockchain.js';
import { PoSConsensus } from '../consensus/pos-consensus.js';
import { ValidatorManager } from '../consensus/validator-manager.js';
import { EVMExecutor } from '../evm/evm-executor.js';
import { TransactionPool } from './transaction-pool.js';
import { BlockValidator } from './block-validator.js';
import { ZeroGasEngine } from './zero-gas-engine.js';
import { HighPerformanceProcessor } from './high-performance-processor.js';
import { calculateBlockReward } from '../../shared/utils/rewards.ts';
import { computeSponsorAccountsRoot } from '../../shared/utils/merkle.js';
import { SponsorPoolService } from './sponsor-pool.js';

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
  
  // 获取当前区块时间（毫秒），支持环境变量覆盖 // 英文 /中文
  private getBlockTimeMs(): number {
    const envMs = Number(process.env.BLOCK_TIME_MS);
    if (!isNaN(envMs) && envMs > 0) {
      return envMs;
    }
    return CONSENSUS_CONFIG.BLOCK_TIME * 1000;
  }
  
  /**
   * 启动区块链网络
   */
  async start(genesisValidators: Validator[]): Promise<void> {
    try {
      console.log('Starting TitanChain network...');
      
      // 初始化各个组件 // 英文 /中文
      await this.consensusEngine.initialize(genesisValidators);
      await this.validatorManager.initialize(genesisValidators);
      // EVMExecutor不需要初始化，构造函数已经设置了默认状态 // 英文 /中文
      
      // 根据环境变量决定是否创建创世区块 // 英文 /中文
      const isBootstrap = (process.env.IS_BOOTSTRAP_NODE ?? 'false').toLowerCase() === 'true';
      const joinExisting = (process.env.JOIN_EXISTING_NETWORK ?? 'false').toLowerCase() === 'true';
      if (isBootstrap && !joinExisting) {
        // 引导节点创建创世区块 // 英文 /中文
        await this.createGenesisBlock();
      } else {
        // 非引导节点跳过创世，等待从网络同步 // 英文 /中文
        console.log('Skipping genesis creation for non-bootstrap node; will join existing network / 非引导节点跳过创世，将加入现有网络');
      }
      
      // 启动区块生产（可通过环境变量禁用），且需要有创世区块 // 英文 /中文
      const enableProduction = (process.env.ENABLE_BLOCK_PRODUCTION ?? 'true').toLowerCase() !== 'false';
      const hasGenesis = !!this.currentBlock;
      if (enableProduction && hasGenesis) {
        this.startBlockProduction();
      } else {
        console.log('Block production disabled or no genesis available / 区块生产被禁用或尚无创世区块');
      }
      
      // 启动验证节点选举（需要链已初始化） // 英文 /中文
      if (hasGenesis) {
        this.startValidatorElection();
      }
      
      // 更新网络统计的平均区块时间以匹配当前配置 // 英文 /中文
      this.networkStats.averageBlockTime = this.getBlockTimeMs();
      
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
   * 获取区块链数据（供同步模块读取） // 英文 /中文
   */
  getChain(): Block[] {
    return [...this.blockchain];
  }

  /**
   * 获取区块验证器实例（供BlockSyncProtocol使用） // 英文 /中文
   */
  getBlockValidator(): BlockValidator {
    return this.blockValidator;
  }
  
  /**
   * 创建创世区块
   */
  private async createGenesisBlock(): Promise<void> {
    const genesisBlock: Block = {
      number: 0,
      hash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      parentHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      timestamp: Number(process.env.GENESIS_TIMESTAMP ?? 0),
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
    
    console.log('Genesis block created');
  }
  
  /**
   * 启动区块生产
   */
  private startBlockProduction(): void {
    const blockTime = this.getBlockTimeMs();
    
    this.blockProductionInterval = setInterval(async () => {
      if (!this.isRunning) return;
      
      try {
        await this.produceBlock();
      } catch (error) {
        console.error('Error producing block:', error);
      }
    }, blockTime);
    
    console.log(`Block production started with ${blockTime}ms interval`);
  }

  /**
   * Enable block production after sync / 在同步完成后启用区块生产
   * Public wrapper to allow starting production post-initialization // 英文 /中文
   */
  enableBlockProduction(): void {
    const hasGenesis = !!this.currentBlock;
    if (!hasGenesis) {
      console.log('Cannot enable block production without genesis / 没有创世区块无法启用出块');
      return;
    }
    if (this.blockProductionInterval) {
      console.log('Block production already running / 区块生产已在运行');
      return;
    }
    if (!this.isRunning) {
      console.log('Blockchain not running, cannot start production / 区块链未运行，无法开始生产');
      return;
    }
    this.startBlockProduction();
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
      console.log(`Attempting to produce block #${nextBlockNumber}`);
      
      // 获取活跃验证者
      const activeValidators = this.validatorManager.getActiveValidators();
      console.log(`Active validators count: ${activeValidators.length}`);
      
      // 选择区块生产者
      console.log(`🔍 区块链核心开始选择区块 #${nextBlockNumber} 的出块者`);
      const producer = await this.consensusEngine.selectBlockProducer(nextBlockNumber);
      if (!producer) {
        console.error('No block producer selected');
        console.log('Available validators:', activeValidators.map(v => v.address));
        return null;
      }
      
      console.log(`🎯 区块链核心最终选择的出块者: ${producer}`);
      
      // 获取待打包交易
      const transactions = this.transactionPool.getTransactionsForBlock(
        PERFORMANCE_CONFIG.MAX_GAS_LIMIT,
        PERFORMANCE_CONFIG.MAX_TRANSACTIONS_PER_BLOCK
      );
      
      console.log(`Transactions to include: ${transactions.length}`);
      
      // 执行交易
      const executionResults = [];
      
      // 预计算区块哈希并更新EVM执行器的区块上下文
      const precomputedBlockHash = this.calculateBlockHash(
        nextBlockNumber,
        this.currentBlock.hash,
        producer,
        transactions
      );
      this.evmEngine.updateState(nextBlockNumber, precomputedBlockHash, Date.now());
      
      for (const tx of transactions) {
        const result = await this.evmEngine.executeTransaction(tx);
        executionResults.push(result);
        
        // 处理交易gas费分配
        if (result.success && result.gasUsed > BigInt(0)) {
          const gasFee = tx.gas * tx.gasPrice;
          const allocation = this.evmEngine.processGasFeeAllocation(tx, gasFee);
          
          // 如果是非原生代币交易，将gas费添加到奖励池
          if (!allocation.isNativeToken && allocation.toRewardPool > BigInt(0)) {
            // 这里可以调用MultiRewardPoolManager来处理gas费
            console.log(`非原生代币交易gas费 ${allocation.toRewardPool} 将添加到奖励池`);
          }
          
          // 验证节点获得的gas费部分
          if (allocation.toValidator > BigInt(0)) {
            console.log(`验证节点 ${producer} 获得gas费奖励: ${allocation.toValidator}`);
          }
        }
      }
      
      // 计算gas使用量
      const gasUsed = executionResults.reduce((sum, result) => sum + result.gasUsed, BigInt(0));

      // 计算本块奖励（4年减半，首个周期约4亿枚，总产出上限10亿枚）
      const blockReward = calculateBlockReward(nextBlockNumber);
      
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
        // 使用EVM执行器提供的stateRoot，而不是直接读取EVMState内部字段
        stateRoot: this.evmEngine.getStateRoot(),
        gasUsed,
        gasLimit: PERFORMANCE_CONFIG.MAX_GAS_LIMIT,
        difficulty: BigInt(1),
        size: this.calculateBlockSize(transactions),
        nonce: `0x${nextBlockNumber.toString(16).padStart(16, '0')}`,
        reward: blockReward
      };
      
      console.log(`Created block #${newBlock.number} with hash: ${newBlock.hash}`);
      
      // 验证区块
      if (!await this.blockValidator.validateBlock(newBlock, this.currentBlock)) {
        console.error('Block validation failed');
        return null;
      }
      
      console.log(`Block #${newBlock.number} validation passed`);
      
      // 处理区块
      if (!await this.consensusEngine.processNewBlock(newBlock)) {
        console.error('Block processing failed');
        return null;
      }
      
      console.log(`Block #${newBlock.number} processing completed`);
      
      // 添加到区块链
      this.blockchain.push(newBlock);
      this.currentBlock = newBlock;

      // 分发本块奖励到验证者（PoS 共识层）
      await this.consensusEngine.distributeBlockRewards(nextBlockNumber, blockReward, this.evmEngine);
      
      // 从交易池中移除已打包交易
      this.transactionPool.removeTransactions(transactions.map(tx => tx.hash));
      
      // 更新网络统计
      this.updateNetworkStats(newBlock);
      
      console.log(`✅ Block #${newBlock.number} produced by ${producer} with ${transactions.length} transactions`);
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
   * 接收并验证来自网络的区块（P2P）
   */
  async receiveBlock(block: Block): Promise<boolean> {
    try {
      const parent = this.currentBlock;
      // 只接受比当前高度新的区块
      if (parent && block.number <= parent.number) {
        // 检测同一高度双签（同一验证者在同一高度提交不同区块）
        if (block.number === parent.number && block.validator === parent.validator && block.hash !== parent.hash) {
          console.warn(`⚠️ Detected potential double-sign at height #${block.number} by ${block.validator}`);
          try {
            await this.consensusEngine.slashValidator(block.validator, 'double_sign', {
              height: block.number,
              currentHash: parent.hash,
              incomingHash: block.hash
            });
          } catch (e) {
            console.error('Error slashing validator for double-sign:', e);
          }
        } else {
          console.warn(`Received stale block #${block.number}, current is #${parent.number}`);
        }
        return false;
      }

      // 验证区块
      const valid = await this.blockValidator.validateBlock(block, parent || undefined);
      if (!valid) {
        console.error('Received block validation failed');
        return false;
      }

      // 处理区块（共识层）
      const processed = await this.consensusEngine.processNewBlock(block);
      if (!processed) {
        console.error('Received block processing failed');
        return false;
      }

      // 添加到链并更新状态
      this.blockchain.push(block);
      this.currentBlock = block;

      // 从交易池移除已打包交易
      this.transactionPool.removeTransactions(block.transactions.map(tx => tx.hash));

      // 更新网络统计
      this.updateNetworkStats(block);

      console.log(`📦 Imported block #${block.number} from network with ${block.transactions.length} txs`);
      return true;
    } catch (error) {
      console.error('Error receiving block:', error);
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
    // 本地计算排名：按综合评分和总质押排序
    const validators = this.validatorManager.getActiveValidators?.()
      ? this.validatorManager.getActiveValidators()
      : [];
    const rankings = validators
      .map(v => ({
        address: v.address,
        name: v.metadata?.name || v.address,
        stake: v.stake,
        totalStake: v.totalStake,
        score: v.performance?.score ?? 0,
      }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        // 次级排序依据：总质押
        return Number(b.totalStake - a.totalStake);
      })
      .map((item, idx) => ({ ...item, ranking: idx + 1 }));
    return rankings;
  }
  
  /**
   * 获取候补节点排名
   */
  getCandidateRankings() {
    // 本地计算候选节点排名：按总质押和准备度评分排序
    const candidates = this.validatorManager.getCandidateValidators?.()
      ? this.validatorManager.getCandidateValidators()
      : [];
    const rankings = candidates
      .map(c => ({
        address: c.address,
        name: c.metadata?.name || c.address,
        stake: c.stake,
        totalStake: c.totalStake,
        readinessScore: c.readinessScore ?? 0,
      }))
      .sort((a, b) => {
        // 先按总质押排序，再按准备度评分
        const stakeDiff = Number(b.totalStake - a.totalStake);
        if (stakeDiff !== 0) return stakeDiff;
        return (b.readinessScore || 0) - (a.readinessScore || 0);
      })
      .map((item, idx) => ({ ...item, ranking: idx + 1 }));
    return rankings;
  }
  
  /**
   * 获取选举统计
   */
  getElectionStats() {
    // 使用动态管理器的系统统计作为选举统计
    if (this.validatorManager.getDynamicManagerStatus) {
      return this.validatorManager.getDynamicManagerStatus();
    }
    // 兜底：返回验证节点统计
    return this.getValidatorStats();
  }
  
  /**
   * 获取候补节点管理统计
   */
  getCandidateManagerStats() {
    // 使用候选替换系统状态作为候补管理统计
    if (this.validatorManager.getReplacementSystemStatus) {
      return this.validatorManager.getReplacementSystemStatus();
    }
    // 兜底：返回候选节点数量
    const candidates = this.validatorManager.getCandidateValidators?.()
      ? this.validatorManager.getCandidateValidators()
      : [];
    return { candidateNodes: candidates.length } as any;
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
    try {
      await this.validatorManager.conductElection();
      return true;
    } catch (e) {
      console.error('Force validator election failed:', e);
      return false;
    }
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
   * 获取交易池安全统计（黑名单、限速、可疑模式、拒绝计数）
   */
  getTransactionPoolSecurityStats() {
    // 暴露交易池内部的安全统计，用于API查询与监控
    return (this.transactionPool as any).getSecurityStats?.()
      ?? { blacklistedAddresses: 0, rateLimitedAddresses: 0, suspiciousPatterns: 0, rejectedTransactions: 0 };
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
    this.networkStats.blockHeight = this.blockchain.length - 1;
    this.networkStats.totalTransactions += block.transactions.length;
    this.networkStats.activeValidators = this.validatorManager.getValidatorStats().activeValidators;
    
    // 计算零gas费交易数量
    const zeroGasCount = block.transactions.filter(tx => tx.isZeroGas).length;
    this.networkStats.zeroGasTransactions += zeroGasCount;
    

    
    // 计算当前TPS
    if (this.networkStats.averageBlockTime > 0) {
      this.networkStats.currentTPS = (block.transactions.length * 1000) / this.networkStats.averageBlockTime;
      
      // 更新平均TPS
      const totalBlocks = this.blockchain.length;
      if (totalBlocks > 1) {
        this.networkStats.averageTPS = 
          (this.networkStats.averageTPS * (totalBlocks - 1) + this.networkStats.currentTPS) / totalBlocks;
      } else {
        this.networkStats.averageTPS = this.networkStats.currentTPS;
      }
      
      // 更新峰值TPS
      if (this.networkStats.currentTPS > this.networkStats.peakTPS) {
        this.networkStats.peakTPS = this.networkStats.currentTPS;
      }
    }
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
   * 获取微批调度器状态
   */

  
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
   * 获取赞助账户根（基于当前赞助池快照）
   */
  getSponsorAccountsRoot(): string {
    const snapshot = SponsorPoolService.snapshot();
    return computeSponsorAccountsRoot(snapshot);
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
      queueStatus: this.getQueueStatus(),

    };
  }

  /**
   * 获取当前出块节点
   */
  async getCurrentBlockProducer(): Promise<{ address: string; blockNumber: number } | null> {
    try {
      if (!this.currentBlock) {
        return null;
      }
      
      const nextBlockNumber = this.currentBlock.number + 1;
      const producer = await this.consensusEngine.selectBlockProducer(nextBlockNumber);
      
      if (producer) {
        return {
          address: producer,
          blockNumber: nextBlockNumber
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error getting current block producer:', error);
      return null;
    }
  }

  /**
   * 获取最新区块的出块者
   */
  getLatestBlockProducer(): string | null {
    if (!this.currentBlock) {
      return null;
    }
    return this.currentBlock.validator;
  }
}