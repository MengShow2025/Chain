/**
 * TitanChain 智能交易路由器
 * Smart Transaction Router for Dual-Block Architecture
 * 
 * 功能特性 / Features:
 * - 智能交易分类和路由 / Smart transaction classification and routing
 * - 动态负载均衡 / Dynamic load balancing
 * - 性能优化路由决策 / Performance-optimized routing decisions
 * - 实时监控和调整 / Real-time monitoring and adjustment
 */

import { Transaction } from '../../shared/types/blockchain';
import { 
  DUAL_BLOCK_CONFIG, 
  ROUTING_RULES, 
  PERFORMANCE_MONITORING,
  BlockType 
} from './dual-block-config';

// 交易分析结果 / Transaction Analysis Result
export interface TransactionAnalysis {
  gasEstimate: bigint;                    // Gas估算 / Gas estimate
  complexity: number;                     // 复杂度评分 / Complexity score
  transactionType: string;                // 交易类型 / Transaction type
  priority: 'high' | 'medium' | 'low';   // 优先级 / Priority
  routingDecision: BlockType;             // 路由决策 / Routing decision
  confidence: number;                     // 决策置信度 / Decision confidence
}

// 路由统计 / Routing Statistics
export interface RoutingStats {
  totalTransactions: number;              // 总交易数 / Total transactions
  fastBlockTransactions: number;          // 快速区块交易数 / Fast block transactions
  batchBlockTransactions: number;         // 批量区块交易数 / Batch block transactions
  averageLatency: number;                 // 平均延迟 / Average latency
  routingAccuracy: number;                // 路由准确率 / Routing accuracy
  loadBalanceRatio: number;               // 负载均衡比率 / Load balance ratio
}

// 队列状态 / Queue Status
export interface QueueStatus {
  fastQueue: {
    size: number;                         // 队列大小 / Queue size
    averageWaitTime: number;              // 平均等待时间 / Average wait time
    throughput: number;                   // 吞吐量 / Throughput
  };
  batchQueue: {
    size: number;                         // 队列大小 / Queue size
    averageWaitTime: number;              // 平均等待时间 / Average wait time
    throughput: number;                   // 吞吐量 / Throughput
  };
}

/**
 * 智能交易路由器类
 * Smart Transaction Router Class
 */
export class SmartTransactionRouter {
  private routingStats: RoutingStats;
  private queueStatus: QueueStatus;
  private performanceHistory: Array<{
    timestamp: number;
    fastBlockLatency: number;
    batchBlockLatency: number;
    fastBlockTPS: number;
    batchBlockTPS: number;
  }>;

  constructor() {
    this.routingStats = {
      totalTransactions: 0,
      fastBlockTransactions: 0,
      batchBlockTransactions: 0,
      averageLatency: 0,
      routingAccuracy: 0,
      loadBalanceRatio: 0.5
    };

    this.queueStatus = {
      fastQueue: {
        size: 0,
        averageWaitTime: 0,
        throughput: 0
      },
      batchQueue: {
        size: 0,
        averageWaitTime: 0,
        throughput: 0
      }
    };

    this.performanceHistory = [];
  }

  /**
   * 分析交易并决定路由
   * Analyze transaction and decide routing
   */
  async analyzeTransaction(transaction: Transaction): Promise<TransactionAnalysis> {
    // 1. Gas使用量分析 / Gas usage analysis
    const gasEstimate = await this.estimateGas(transaction);
    
    // 2. 交易复杂度分析 / Transaction complexity analysis
    const complexity = this.calculateComplexity(transaction);
    
    // 3. 交易类型识别 / Transaction type identification
    const transactionType = this.identifyTransactionType(transaction);
    
    // 4. 优先级评估 / Priority assessment
    const priority = this.assessPriority(transaction, gasEstimate, complexity);
    
    // 5. 路由决策 / Routing decision
    const routingDecision = this.makeRoutingDecision(
      gasEstimate, 
      complexity, 
      transactionType, 
      priority
    );
    
    // 6. 决策置信度计算 / Decision confidence calculation
    const confidence = this.calculateConfidence(
      gasEstimate, 
      complexity, 
      transactionType
    );

    return {
      gasEstimate,
      complexity,
      transactionType,
      priority,
      routingDecision,
      confidence
    };
  }

  /**
   * 估算交易Gas使用量
   * Estimate transaction gas usage
   */
  private async estimateGas(transaction: Transaction): Promise<bigint> {
    // 基础Gas消耗 / Base gas consumption
    let gasEstimate = BigInt('21000'); // 基础转账Gas / Base transfer gas

    // 根据交易数据大小调整 / Adjust based on transaction data size
    if (transaction.data && transaction.data !== '0x') {
      const dataSize = (transaction.data.length - 2) / 2; // 去除0x前缀 / Remove 0x prefix
      gasEstimate += BigInt(dataSize * 16); // 每字节16 gas / 16 gas per byte
    }

    // 合约调用额外Gas / Additional gas for contract calls
    if (transaction.to && transaction.data && transaction.data !== '0x') {
      gasEstimate += BigInt('50000'); // 合约调用基础Gas / Base contract call gas
      
      // 根据数据复杂度调整 / Adjust based on data complexity
      const complexity = this.calculateComplexity(transaction);
      gasEstimate += BigInt(complexity * 10000);
    }

    return gasEstimate;
  }

  /**
   * 计算交易复杂度
   * Calculate transaction complexity
   */
  private calculateComplexity(transaction: Transaction): number {
    let complexity = 1; // 基础复杂度 / Base complexity

    // 数据大小影响复杂度 / Data size affects complexity
    if (transaction.data && transaction.data !== '0x') {
      const dataSize = (transaction.data.length - 2) / 2;
      complexity += Math.floor(dataSize / 100); // 每100字节增加1复杂度 / +1 complexity per 100 bytes
    }

    // 转账金额影响复杂度 / Transfer amount affects complexity
    if (transaction.value && transaction.value > BigInt('0')) {
      complexity += 1;
    }

    // Gas价格影响复杂度 / Gas price affects complexity
    if (transaction.gasPrice && transaction.gasPrice > BigInt('20000000000')) { // > 20 Gwei
      complexity += 1;
    }

    return Math.min(complexity, 10); // 最大复杂度为10 / Max complexity is 10
  }

  /**
   * 识别交易类型
   * Identify transaction type
   */
  private identifyTransactionType(transaction: Transaction): string {
    // 简单转账 / Simple transfer
    if (!transaction.data || transaction.data === '0x') {
      return 'transfer';
    }

    // 根据数据长度和模式识别 / Identify based on data length and patterns
    const dataLength = transaction.data.length - 2; // 去除0x前缀 / Remove 0x prefix

    if (dataLength <= 8) {
      return 'simple_contract';
    } else if (dataLength <= 100) {
      return 'swap';
    } else if (dataLength <= 500) {
      return 'basic_defi';
    } else if (dataLength <= 1000) {
      return 'complex_contract';
    } else {
      return 'batch_operations';
    }
  }

  /**
   * 评估交易优先级
   * Assess transaction priority
   */
  private assessPriority(
    transaction: Transaction, 
    gasEstimate: bigint, 
    complexity: number
  ): 'high' | 'medium' | 'low' {
    // 高优先级条件 / High priority conditions
    if (
      transaction.gasPrice && transaction.gasPrice > BigInt('50000000000') || // > 50 Gwei
      gasEstimate < BigInt('50000') || // < 50k gas
      complexity <= 2
    ) {
      return 'high';
    }

    // 低优先级条件 / Low priority conditions
    if (
      gasEstimate > BigInt('500000') || // > 500k gas
      complexity >= 7
    ) {
      return 'low';
    }

    return 'medium';
  }

  /**
   * 做出路由决策
   * Make routing decision
   */
  private makeRoutingDecision(
    gasEstimate: bigint,
    complexity: number,
    transactionType: string,
    priority: 'high' | 'medium' | 'low'
  ): BlockType {
    // 1. 基于Gas使用量的路由 / Gas-based routing
    if (gasEstimate <= ROUTING_RULES.GAS_BASED.FAST_MAX_GAS) {
      // 检查是否为快速区块优先类型 / Check if fast block priority type
      if (ROUTING_RULES.TYPE_BASED.FAST_TYPES.includes(transactionType)) {
        return BlockType.FAST;
      }
    }

    // 2. 基于复杂度的路由 / Complexity-based routing
    if (complexity <= ROUTING_RULES.COMPLEXITY_BASED.FAST_MAX_COMPLEXITY) {
      return BlockType.FAST;
    }

    // 3. 基于优先级的路由 / Priority-based routing
    if (priority === 'high' && gasEstimate <= BigInt('200000')) {
      return BlockType.FAST;
    }

    // 4. 动态负载均衡 / Dynamic load balancing
    if (this.shouldUseLoadBalancing()) {
      return this.getLoadBalancedRoute();
    }

    // 5. 默认路由到批量区块 / Default route to batch block
    return BlockType.BATCH;
  }

  /**
   * 计算决策置信度
   * Calculate decision confidence
   */
  private calculateConfidence(
    gasEstimate: bigint,
    complexity: number,
    transactionType: string
  ): number {
    let confidence = 0.5; // 基础置信度 / Base confidence

    // Gas估算置信度 / Gas estimate confidence
    if (gasEstimate <= BigInt('50000') || gasEstimate >= BigInt('500000')) {
      confidence += 0.3; // 明确的Gas范围 / Clear gas range
    }

    // 复杂度置信度 / Complexity confidence
    if (complexity <= 2 || complexity >= 7) {
      confidence += 0.2; // 明确的复杂度 / Clear complexity
    }

    // 交易类型置信度 / Transaction type confidence
    const fastTypes = ROUTING_RULES.TYPE_BASED.FAST_TYPES;
    const batchTypes = ROUTING_RULES.TYPE_BASED.BATCH_TYPES;
    
    if (fastTypes.includes(transactionType) || batchTypes.includes(transactionType)) {
      confidence += 0.2; // 明确的类型匹配 / Clear type match
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * 检查是否应该使用负载均衡
   * Check if load balancing should be used
   */
  private shouldUseLoadBalancing(): boolean {
    return (
      this.queueStatus.fastQueue.size > ROUTING_RULES.LOAD_BALANCING.FAST_QUEUE_THRESHOLD ||
      this.queueStatus.batchQueue.size > ROUTING_RULES.LOAD_BALANCING.BATCH_QUEUE_THRESHOLD
    );
  }

  /**
   * 获取负载均衡路由
   * Get load balanced route
   */
  private getLoadBalancedRoute(): BlockType {
    const fastQueueLoad = this.queueStatus.fastQueue.size / ROUTING_RULES.LOAD_BALANCING.FAST_QUEUE_THRESHOLD;
    const batchQueueLoad = this.queueStatus.batchQueue.size / ROUTING_RULES.LOAD_BALANCING.BATCH_QUEUE_THRESHOLD;

    // 选择负载较低的队列 / Choose queue with lower load
    return fastQueueLoad <= batchQueueLoad ? BlockType.FAST : BlockType.BATCH;
  }

  /**
   * 更新队列状态
   * Update queue status
   */
  updateQueueStatus(queueStatus: QueueStatus): void {
    this.queueStatus = { ...queueStatus };
  }

  /**
   * 更新性能历史
   * Update performance history
   */
  updatePerformanceHistory(
    fastBlockLatency: number,
    batchBlockLatency: number,
    fastBlockTPS: number,
    batchBlockTPS: number
  ): void {
    this.performanceHistory.push({
      timestamp: Date.now(),
      fastBlockLatency,
      batchBlockLatency,
      fastBlockTPS,
      batchBlockTPS
    });

    // 保持最近100条记录 / Keep last 100 records
    if (this.performanceHistory.length > 100) {
      this.performanceHistory.shift();
    }
  }

  /**
   * 获取路由统计
   * Get routing statistics
   */
  getRoutingStats(): RoutingStats {
    return { ...this.routingStats };
  }

  /**
   * 获取队列状态
   * Get queue status
   */
  getQueueStatus(): QueueStatus {
    return { ...this.queueStatus };
  }

  /**
   * 获取性能历史
   * Get performance history
   */
  getPerformanceHistory() {
    return [...this.performanceHistory];
  }

  /**
   * 重置统计数据
   * Reset statistics
   */
  resetStats(): void {
    this.routingStats = {
      totalTransactions: 0,
      fastBlockTransactions: 0,
      batchBlockTransactions: 0,
      averageLatency: 0,
      routingAccuracy: 0,
      loadBalanceRatio: 0.5
    };
    this.performanceHistory = [];
  }
}