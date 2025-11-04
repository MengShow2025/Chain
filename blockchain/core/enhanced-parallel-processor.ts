/**
 * TitanChain 增强并行处理器
 * Enhanced Parallel Processor
 */

import { PerformanceTier, PerformanceTierClassifier, PERFORMANCE_TIERS, TierMetrics, TierStatus } from './performance-tiers.js';

// 交易依赖关系接口 / Transaction Dependency Interface
export interface TransactionDependency {
  transactionHash: string;
  dependsOn: string[];        // 依赖的交易哈希 / Dependent transaction hashes
  affectedAccounts: string[]; // 影响的账户地址 / Affected account addresses
  affectedContracts: string[]; // 影响的合约地址 / Affected contract addresses
  readOnlyAccounts: string[];  // 只读账户地址 / Read-only account addresses
}

// 处理组接口 / Processing Group Interface
export interface ProcessingGroup {
  id: string;
  tier: PerformanceTier;
  transactions: any[];
  dependencies: TransactionDependency[];
  estimatedGas: bigint;
  estimatedLatency: number;
  priority: number;
}

// 处理结果接口 / Processing Result Interface
export interface ProcessResult {
  transactionHash: string;
  success: boolean;
  gasUsed: bigint;
  executionTime: number;
  error?: string;
  tier: PerformanceTier;
  groupId: string;
}

// 批处理结果接口 / Batch Processing Result Interface
export interface BatchProcessResult {
  groupId: string;
  tier: PerformanceTier;
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  totalGasUsed: bigint;
  totalExecutionTime: number;
  results: ProcessResult[];
  metrics: TierMetrics;
}

// 并行处理统计接口 / Parallel Processing Statistics Interface
export interface ParallelProcessingStats {
  totalProcessed: number;
  totalSuccessful: number;
  totalFailed: number;
  averageLatency: number;
  currentTPS: number;
  tierStats: Map<PerformanceTier, TierMetrics>;
  lastUpdated: number;
}

/**
 * 增强并行处理器类
 * Enhanced Parallel Processor Class
 */
export class EnhancedParallelProcessor {
  private tierQueues: Map<PerformanceTier, any[]>;
  private tierStatus: Map<PerformanceTier, TierStatus>;
  private processingGroups: Map<string, ProcessingGroup>;
  private dependencyGraph: Map<string, Set<string>>;
  private accountLocks: Map<string, Set<string>>;
  private contractLocks: Map<string, Set<string>>;
  private processingStats: ParallelProcessingStats;
  private isProcessing: boolean;
  private processingInterval: NodeJS.Timeout | null;

  constructor() {
    this.tierQueues = new Map();
    this.tierStatus = new Map();
    this.processingGroups = new Map();
    this.dependencyGraph = new Map();
    this.accountLocks = new Map();
    this.contractLocks = new Map();
    this.isProcessing = false;
    this.processingInterval = null;

    // 初始化层级队列和状态 / Initialize tier queues and status
    this.initializeTiers();
    
    // 初始化处理统计 / Initialize processing statistics
    this.processingStats = {
      totalProcessed: 0,
      totalSuccessful: 0,
      totalFailed: 0,
      averageLatency: 0,
      currentTPS: 0,
      tierStats: new Map(),
      lastUpdated: Date.now()
    };

    console.log('🚀 增强并行处理器初始化完成 / Enhanced parallel processor initialized');
  }

  /**
   * 初始化性能层级
   * Initialize performance tiers
   */
  private initializeTiers(): void {
    for (const tier of Object.values(PerformanceTier)) {
      this.tierQueues.set(tier, []);
      this.tierStatus.set(tier, {
        tier,
        isActive: true,
        isOverloaded: false,
        queueSize: 0,
        processingCount: 0,
        lastProcessedTime: Date.now(),
        metrics: {
          tier,
          currentTPS: 0,
          averageLatency: 0,
          queueSize: 0,
          queueLoad: 0,
          errorRate: 0,
          successRate: 1.0,
          timestamp: Date.now()
        }
      });
    }
  }

  /**
   * 启动并行处理
   * Start parallel processing
   */
  async startProcessing(): Promise<void> {
    if (this.isProcessing) {
      console.log('⚠️ 并行处理器已在运行 / Parallel processor already running');
      return;
    }

    this.isProcessing = true;
    console.log('🚀 启动增强并行处理 / Starting enhanced parallel processing');

    // 启动各层级的处理循环 / Start processing loops for each tier
    this.processingInterval = setInterval(async () => {
      await this.processAllTiers();
    }, 100); // 100ms处理间隔 / 100ms processing interval
  }

  /**
   * 停止并行处理
   * Stop parallel processing
   */
  async stopProcessing(): Promise<void> {
    if (!this.isProcessing) {
      console.log('⚠️ 并行处理器未在运行 / Parallel processor not running');
      return;
    }

    this.isProcessing = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    console.log('🛑 停止增强并行处理 / Stopped enhanced parallel processing');
  }

  /**
   * 添加交易到处理队列
   * Add transaction to processing queue
   */
  async addTransaction(tx: any): Promise<void> {
    // 分类交易到性能层级 / Classify transaction to performance tier
    const tier = PerformanceTierClassifier.classifyTransaction(tx);
    
    // 分析交易依赖关系 / Analyze transaction dependencies
    const dependency = await this.analyzeDependencies(tx);
    
    // 添加到对应层级队列 / Add to corresponding tier queue
    const queue = this.tierQueues.get(tier);
    if (queue) {
      queue.push({ transaction: tx, dependency });
      
      // 更新队列状态 / Update queue status
      this.updateTierStatus(tier);
      
      console.log(`📥 交易 ${tx.hash} 添加到 ${tier} 队列 / Transaction ${tx.hash} added to ${tier} queue`);
    }
  }

  /**
   * 批量添加交易
   * Add transactions in batch
   */
  async addTransactionBatch(transactions: any[]): Promise<void> {
    console.log(`📥 批量添加 ${transactions.length} 个交易 / Adding ${transactions.length} transactions in batch`);
    
    const addPromises = transactions.map(tx => this.addTransaction(tx));
    await Promise.all(addPromises);
    
    console.log(`✅ 批量添加完成 / Batch addition completed`);
  }

  /**
   * 处理所有层级
   * Process all tiers
   */
  private async processAllTiers(): Promise<void> {
    const processingPromises: Promise<void>[] = [];

    // 按优先级处理各层级 / Process tiers by priority
    for (const tier of [PerformanceTier.TIER_1, PerformanceTier.TIER_2, PerformanceTier.TIER_3]) {
      const status = this.tierStatus.get(tier);
      if (status && status.isActive && !status.isOverloaded) {
        processingPromises.push(this.processTier(tier));
      }
    }

    await Promise.all(processingPromises);
  }

  /**
   * 处理特定层级
   * Process specific tier
   */
  private async processTier(tier: PerformanceTier): Promise<void> {
    const queue = this.tierQueues.get(tier);
    const config = PerformanceTierClassifier.getTierConfig(tier);
    
    if (!queue || queue.length === 0) {
      return;
    }

    try {
      // 根据处理模式选择处理策略 / Choose processing strategy based on processing mode
      switch (config.PROCESSING_MODE) {
        case 'immediate':
          await this.processImmediate(tier, queue, config);
          break;
        case 'batched':
          await this.processBatched(tier, queue, config);
          break;
        case 'scheduled':
          await this.processScheduled(tier, queue, config);
          break;
        default:
          await this.processBatched(tier, queue, config);
      }
    } catch (error) {
      console.error(`❌ 处理层级 ${tier} 时出错: ${error} / Error processing tier ${tier}:`, error);
    }
  }

  /**
   * 立即处理模式
   * Immediate processing mode
   */
  private async processImmediate(tier: PerformanceTier, queue: any[], config: any): Promise<void> {
    const batchSize = Math.min(queue.length, 10); // 小批量立即处理 / Small batch immediate processing
    const batch = queue.splice(0, batchSize);
    
    if (batch.length === 0) return;

    const startTime = Date.now();
    
    // 并行处理批次 / Process batch in parallel
    const processingPromises = batch.map(async (item) => {
      return this.processTransaction(item.transaction, tier);
    });

    const results = await Promise.all(processingPromises);
    
    // 更新统计信息 / Update statistics
    this.updateProcessingStats(tier, results, Date.now() - startTime);
    
    console.log(`⚡ ${tier} 立即处理完成 ${results.length} 个交易 / ${tier} immediate processing completed ${results.length} transactions`);
  }

  /**
   * 批量处理模式
   * Batched processing mode
   */
  private async processBatched(tier: PerformanceTier, queue: any[], config: any): Promise<void> {
    const batchSize = Math.min(queue.length, 100); // 中等批量处理 / Medium batch processing
    const batch = queue.splice(0, batchSize);
    
    if (batch.length === 0) return;

    const startTime = Date.now();

    // 按依赖关系分组 / Group by dependencies
    const groups = await this.groupByDependency(batch, tier);
    
    // 并行处理独立组 / Process independent groups in parallel
    const groupPromises = groups.map(group => this.processGroup(group));
    const groupResults = await Promise.all(groupPromises);
    
    // 合并结果 / Merge results
    const allResults = groupResults.flat();
    
    // 更新统计信息 / Update statistics
    this.updateProcessingStats(tier, allResults, Date.now() - startTime);
    
    console.log(`📦 ${tier} 批量处理完成 ${allResults.length} 个交易 / ${tier} batch processing completed ${allResults.length} transactions`);
  }

  /**
   * 计划处理模式
   * Scheduled processing mode
   */
  private async processScheduled(tier: PerformanceTier, queue: any[], config: any): Promise<void> {
    const batchSize = Math.min(queue.length, 1000); // 大批量计划处理 / Large batch scheduled processing
    const batch = queue.splice(0, batchSize);
    
    if (batch.length === 0) return;

    const startTime = Date.now();

    // 优化分组策略 / Optimize grouping strategy
    const optimizedGroups = await this.optimizeGrouping(batch, tier);
    
    // 按优先级顺序处理组 / Process groups by priority order
    const allResults: ProcessResult[] = [];
    for (const group of optimizedGroups) {
      const groupResults = await this.processGroup(group);
      allResults.push(...groupResults);
    }
    
    // 更新统计信息 / Update statistics
    this.updateProcessingStats(tier, allResults, Date.now() - startTime);
    
    console.log(`📅 ${tier} 计划处理完成 ${batch.length} 个交易 / ${tier} scheduled processing completed ${batch.length} transactions`);
  }

  /**
   * 分析交易依赖关系
   * Analyze transaction dependencies
   */
  private async analyzeDependencies(tx: any): Promise<TransactionDependency> {
    const affectedAccounts: string[] = [];
    const affectedContracts: string[] = [];
    const readOnlyAccounts: string[] = [];

    // 添加发送者账户 / Add sender account
    if (tx.from) {
      affectedAccounts.push(tx.from);
    }

    // 添加接收者账户或合约 / Add receiver account or contract
    if (tx.to) {
      if (tx.data && tx.data !== '0x') {
        affectedContracts.push(tx.to); // 合约调用 / Contract call
      } else {
        affectedAccounts.push(tx.to); // 简单转账 / Simple transfer
      }
    }

    // 分析合约调用的额外依赖 / Analyze additional dependencies from contract calls
    if (tx.data && tx.data !== '0x') {
      // 这里可以添加更复杂的合约分析逻辑 / More complex contract analysis logic can be added here
      // 例如解析函数调用参数中的地址 / For example, parse addresses in function call parameters
    }

    return {
      transactionHash: tx.hash,
      dependsOn: [], // 暂时为空，可以根据需要实现更复杂的依赖分析 / Empty for now, more complex dependency analysis can be implemented as needed
      affectedAccounts,
      affectedContracts,
      readOnlyAccounts
    };
  }

  /**
   * 按依赖关系分组
   * Group by dependencies
   */
  private async groupByDependency(batch: any[], tier: PerformanceTier): Promise<ProcessingGroup[]> {
    const groups: ProcessingGroup[] = [];
    const processed = new Set<string>();

    for (const item of batch) {
      if (processed.has(item.transaction.hash)) {
        continue;
      }

      // 创建新组 / Create new group
      const group: ProcessingGroup = {
        id: `${tier}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        tier,
        transactions: [item.transaction],
        dependencies: [item.dependency],
        estimatedGas: item.transaction.gasLimit || BigInt('21000'),
        estimatedLatency: 0,
        priority: this.calculateGroupPriority(item.transaction, tier)
      };

      // 查找可以并行处理的交易 / Find transactions that can be processed in parallel
      for (const otherItem of batch) {
        if (processed.has(otherItem.transaction.hash) || 
            otherItem.transaction.hash === item.transaction.hash) {
          continue;
        }

        // 检查是否有冲突 / Check for conflicts
        if (!this.hasConflict(item.dependency, otherItem.dependency)) {
          group.transactions.push(otherItem.transaction);
          group.dependencies.push(otherItem.dependency);
          group.estimatedGas += otherItem.transaction.gasLimit || BigInt('21000');
          processed.add(otherItem.transaction.hash);
        }
      }

      processed.add(item.transaction.hash);
      groups.push(group);
    }

    return groups;
  }

  /**
   * 优化分组策略
   * Optimize grouping strategy
   */
  private async optimizeGrouping(batch: any[], tier: PerformanceTier): Promise<ProcessingGroup[]> {
    // 先按依赖关系分组 / First group by dependencies
    const initialGroups = await this.groupByDependency(batch, tier);
    
    // 按优先级排序 / Sort by priority
    initialGroups.sort((a, b) => b.priority - a.priority);
    
    // 合并小组以提高效率 / Merge small groups for efficiency
    const optimizedGroups: ProcessingGroup[] = [];
    const config = PerformanceTierClassifier.getTierConfig(tier);
    
    for (const group of initialGroups) {
      if (optimizedGroups.length === 0) {
        optimizedGroups.push(group);
        continue;
      }
      
      const lastGroup = optimizedGroups[optimizedGroups.length - 1];
      
      // 如果可以合并且不超过Gas限制 / If can merge and doesn't exceed gas limit
      if (lastGroup.estimatedGas + group.estimatedGas <= config.GAS_LIMIT &&
          lastGroup.transactions.length + group.transactions.length <= 50) {
        
        // 检查是否有冲突 / Check for conflicts
        let hasConflict = false;
        for (const dep1 of lastGroup.dependencies) {
          for (const dep2 of group.dependencies) {
            if (this.hasConflict(dep1, dep2)) {
              hasConflict = true;
              break;
            }
          }
          if (hasConflict) break;
        }
        
        if (!hasConflict) {
          // 合并组 / Merge groups
          lastGroup.transactions.push(...group.transactions);
          lastGroup.dependencies.push(...group.dependencies);
          lastGroup.estimatedGas += group.estimatedGas;
          continue;
        }
      }
      
      optimizedGroups.push(group);
    }
    
    return optimizedGroups;
  }

  /**
   * 检查依赖冲突
   * Check dependency conflicts
   */
  private hasConflict(dep1: TransactionDependency, dep2: TransactionDependency): boolean {
    // 检查账户冲突 / Check account conflicts
    const accounts1 = new Set([...dep1.affectedAccounts, ...dep1.affectedContracts]);
    const accounts2 = new Set([...dep2.affectedAccounts, ...dep2.affectedContracts]);
    
    for (const account of accounts1) {
      if (accounts2.has(account)) {
        return true; // 有冲突 / Has conflict
      }
    }
    
    return false; // 无冲突 / No conflict
  }

  /**
   * 处理组
   * Process group
   */
  private async processGroup(group: ProcessingGroup): Promise<ProcessResult[]> {
    const startTime = Date.now();
    
    try {
      // 并行处理组内交易 / Process transactions in group in parallel
      const processingPromises = group.transactions.map(tx => 
        this.processTransaction(tx, group.tier)
      );
      
      const results = await Promise.all(processingPromises);
      
      // 更新组处理统计 / Update group processing statistics
      const executionTime = Date.now() - startTime;
      console.log(`✅ 组 ${group.id} 处理完成，耗时 ${executionTime}ms / Group ${group.id} processing completed in ${executionTime}ms`);
      
      return results;
    } catch (error) {
      console.error(`❌ 组 ${group.id} 处理失败: ${error} / Group ${group.id} processing failed:`, error);
      
      // 返回失败结果 / Return failure results
      return group.transactions.map(tx => ({
        transactionHash: tx.hash,
        success: false,
        gasUsed: BigInt('0'),
        executionTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        tier: group.tier,
        groupId: group.id
      }));
    }
  }

  /**
   * 处理单个交易
   * Process single transaction
   */
  private async processTransaction(tx: any, tier: PerformanceTier): Promise<ProcessResult> {
    const startTime = Date.now();
    
    try {
      // 模拟交易处理 / Simulate transaction processing
      const config = PerformanceTierClassifier.getTierConfig(tier);
      const processingTime = Math.random() * config.TIMEOUT * 0.5; // 随机处理时间 / Random processing time
      
      await new Promise(resolve => setTimeout(resolve, processingTime));
      
      // 模拟Gas使用 / Simulate gas usage
      const gasUsed = tx.gasLimit ? tx.gasLimit * BigInt(Math.floor(Math.random() * 80 + 20)) / BigInt(100) : BigInt('21000');
      
      return {
        transactionHash: tx.hash,
        success: true,
        gasUsed,
        executionTime: Date.now() - startTime,
        tier,
        groupId: `${tier}-group`
      };
    } catch (error) {
      return {
        transactionHash: tx.hash,
        success: false,
        gasUsed: BigInt('0'),
        executionTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        tier,
        groupId: `${tier}-group`
      };
    }
  }

  /**
   * 计算组优先级
   * Calculate group priority
   */
  private calculateGroupPriority(tx: any, tier: PerformanceTier): number {
    let priority = 1;
    
    // 基于层级的基础优先级 / Base priority based on tier
    switch (tier) {
      case PerformanceTier.TIER_1:
        priority += 10;
        break;
      case PerformanceTier.TIER_2:
        priority += 5;
        break;
      case PerformanceTier.TIER_3:
        priority += 1;
        break;
    }
    
    // 基于Gas价格的优先级 / Priority based on gas price
    if (tx.gasPrice) {
      const gasPriceGwei = Number(tx.gasPrice) / 1e9;
      if (gasPriceGwei >= 50) priority += 5;
      else if (gasPriceGwei >= 20) priority += 3;
      else if (gasPriceGwei >= 10) priority += 1;
    }
    
    return priority;
  }

  /**
   * 更新层级状态
   * Update tier status
   */
  private updateTierStatus(tier: PerformanceTier): void {
    const queue = this.tierQueues.get(tier);
    const status = this.tierStatus.get(tier);
    const config = PerformanceTierClassifier.getTierConfig(tier);
    
    if (!queue || !status) return;
    
    status.queueSize = queue.length;
    status.metrics.queueSize = queue.length;
    status.metrics.queueLoad = queue.length / config.QUEUE_SIZE_LIMIT;
    status.isOverloaded = status.metrics.queueLoad > 0.9;
    status.metrics.timestamp = Date.now();
    
    this.tierStatus.set(tier, status);
  }

  /**
   * 更新处理统计
   * Update processing statistics
   */
  private updateProcessingStats(tier: PerformanceTier, results: ProcessResult[], executionTime: number): void {
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;
    
    // 更新全局统计 / Update global statistics
    this.processingStats.totalProcessed += results.length;
    this.processingStats.totalSuccessful += successful;
    this.processingStats.totalFailed += failed;
    
    // 更新层级统计 / Update tier statistics
    const tierMetrics = this.processingStats.tierStats.get(tier) || {
      tier,
      currentTPS: 0,
      averageLatency: 0,
      queueSize: 0,
      queueLoad: 0,
      errorRate: 0,
      successRate: 1.0,
      timestamp: Date.now()
    };
    
    tierMetrics.currentTPS = results.length / (executionTime / 1000);
    tierMetrics.averageLatency = executionTime / results.length;
    tierMetrics.errorRate = failed / results.length;
    tierMetrics.successRate = successful / results.length;
    tierMetrics.timestamp = Date.now();
    
    this.processingStats.tierStats.set(tier, tierMetrics);
    this.processingStats.lastUpdated = Date.now();
  }

  /**
   * 获取处理统计
   * Get processing statistics
   */
  getProcessingStats(): ParallelProcessingStats {
    return { ...this.processingStats };
  }

  /**
   * 获取层级状态
   * Get tier status
   */
  getTierStatus(tier?: PerformanceTier): TierStatus | Map<PerformanceTier, TierStatus> {
    if (tier) {
      return this.tierStatus.get(tier) || null;
    }
    return new Map(this.tierStatus);
  }

  /**
   * 获取队列状态
   * Get queue status
   */
  getQueueStatus(): Map<PerformanceTier, number> {
    const queueStatus = new Map<PerformanceTier, number>();
    
    for (const [tier, queue] of this.tierQueues) {
      queueStatus.set(tier, queue.length);
    }
    
    return queueStatus;
  }
}