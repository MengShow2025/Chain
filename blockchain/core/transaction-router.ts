/**
 * TitanChain 智能交易路由系统
 * Smart Transaction Routing System
 */

import { Transaction } from '../../shared/types/blockchain.js';
import { BlockType, DUAL_BLOCK_CONFIG, ROUTING_RULES, PERFORMANCE_MONITORING } from './dual-block-config.js';

// 交易复杂度分析结果 / Transaction Complexity Analysis Result
interface ComplexityAnalysis {
  gasEstimate: bigint;                   // Gas估算 / Gas estimate
  contractCalls: number;                 // 合约调用数 / Contract calls count
  storageOperations: number;             // 存储操作数 / Storage operations count
  computationIntensity: number;          // 计算强度 / Computation intensity
  complexityScore: number;               // 复杂度评分 / Complexity score
}

// 路由决策结果 / Routing Decision Result
interface RoutingDecision {
  blockType: BlockType;                  // 目标区块类型 / Target block type
  priority: number;                      // 优先级 / Priority
  reason: string;                        // 路由原因 / Routing reason
  estimatedLatency: number;              // 预估延迟 / Estimated latency
  confidence: number;                    // 决策置信度 / Decision confidence
}

// 队列状态 / Queue Status
interface QueueStatus {
  fastQueueSize: number;                 // 快速队列大小 / Fast queue size
  batchQueueSize: number;                // 批量队列大小 / Batch queue size
  fastQueueLoad: number;                 // 快速队列负载 / Fast queue load
  batchQueueLoad: number;                // 批量队列负载 / Batch queue load
}

/**
 * 智能交易路由器
 * Smart Transaction Router
 */
export class TransactionRouter {
  private queueStatus: QueueStatus;
  private routingStats: Map<BlockType, number>;
  private performanceMetrics: Map<string, number>;

  constructor() {
    this.queueStatus = {
      fastQueueSize: 0,
      batchQueueSize: 0,
      fastQueueLoad: 0,
      batchQueueLoad: 0
    };
    
    this.routingStats = new Map([
      [BlockType.FAST, 0],
      [BlockType.BATCH, 0]
    ]);
    
    this.performanceMetrics = new Map();
    
    console.log('🚦 智能交易路由器已初始化 / Smart Transaction Router initialized');
  }

  /**
   * 路由交易到合适的区块类型
   * Route transaction to appropriate block type
   */
  async routeTransaction(tx: Transaction): Promise<RoutingDecision> {
    try {
      console.log(`🔍 开始路由交易 ${tx.hash} / Starting to route transaction ${tx.hash}`);
      
      // 1. 分析交易复杂度 / Analyze transaction complexity
      const complexity = await this.analyzeComplexity(tx);
      console.log(`📊 交易复杂度分析: 评分=${complexity.complexityScore}, Gas=${complexity.gasEstimate} / Complexity analysis: score=${complexity.complexityScore}, gas=${complexity.gasEstimate}`);
      
      // 2. 基于规则的初步路由 / Rule-based initial routing
      let blockType = this.applyRoutingRules(tx, complexity);
      console.log(`📋 规则路由结果: ${blockType} / Rule-based routing result: ${blockType}`);
      
      // 3. 动态负载均衡调整 / Dynamic load balancing adjustment
      blockType = this.applyLoadBalancing(blockType, complexity);
      console.log(`⚖️ 负载均衡调整后: ${blockType} / After load balancing: ${blockType}`);
      
      // 4. 计算优先级和预估延迟 / Calculate priority and estimated latency
      const priority = this.calculatePriority(tx, complexity, blockType);
      const estimatedLatency = this.estimateLatency(blockType, complexity);
      const confidence = this.calculateConfidence(tx, complexity, blockType);
      
      const decision: RoutingDecision = {
        blockType,
        priority,
        reason: this.generateRoutingReason(tx, complexity, blockType),
        estimatedLatency,
        confidence
      };
      
      // 5. 更新统计信息 / Update statistics
      this.updateRoutingStats(blockType);
      
      console.log(`✅ 交易路由决策完成: ${JSON.stringify(decision)} / Transaction routing decision completed`);
      return decision;
      
    } catch (error) {
      console.error(`❌ 交易路由失败: ${error} / Transaction routing failed:`, error);
      
      // 默认路由到批量区块 / Default route to batch block
      return {
        blockType: BlockType.BATCH,
        priority: 1,
        reason: 'Routing error - defaulted to batch block',
        estimatedLatency: PERFORMANCE_MONITORING.LATENCY_TARGETS.BATCH_BLOCK_MAX_LATENCY,
        confidence: 0.1
      };
    }
  }

  /**
   * 分析交易复杂度
   * Analyze transaction complexity
   */
  private async analyzeComplexity(tx: Transaction): Promise<ComplexityAnalysis> {
    let contractCalls = 0;
    let storageOperations = 0;
    let computationIntensity = 1;
    
    // 分析交易数据 / Analyze transaction data
    if (tx.data && tx.data !== '0x') {
      const dataLength = tx.data.length;
      
      // 估算合约调用数 / Estimate contract calls
      contractCalls = Math.floor(dataLength / 100) + 1;
      
      // 估算存储操作数 / Estimate storage operations
      storageOperations = Math.floor(dataLength / 200);
      
      // 计算计算强度 / Calculate computation intensity
      computationIntensity = Math.min(Math.floor(dataLength / 50), 10);
    }
    
    // 基于目标地址判断交易类型 / Determine transaction type based on target address
    const isContractCall = tx.to !== null && tx.data && tx.data !== '0x';
    const isSimpleTransfer = tx.to !== null && (!tx.data || tx.data === '0x');
    
    // 计算复杂度评分 / Calculate complexity score
    let complexityScore = 0;
    
    if (isSimpleTransfer) {
      complexityScore = 1; // 简单转账 / Simple transfer
    } else if (isContractCall) {
      complexityScore = Math.min(
        2 + contractCalls + storageOperations + computationIntensity,
        10
      );
    } else {
      complexityScore = 5; // 合约部署或其他 / Contract deployment or other
    }
    
    return {
      gasEstimate: tx.gasLimit || BigInt('21000'),
      contractCalls,
      storageOperations,
      computationIntensity,
      complexityScore
    };
  }

  /**
   * 应用路由规则
   * Apply routing rules
   */
  private applyRoutingRules(tx: Transaction, complexity: ComplexityAnalysis): BlockType {
    // 1. 基于Gas使用量的路由 / Gas-based routing
    if (complexity.gasEstimate <= ROUTING_RULES.GAS_BASED.FAST_MAX_GAS) {
      return BlockType.FAST;
    }
    
    // 2. 基于复杂度评分的路由 / Complexity-based routing
    if (complexity.complexityScore <= ROUTING_RULES.COMPLEXITY_BASED.FAST_MAX_COMPLEXITY) {
      return BlockType.FAST;
    }
    
    // 3. 基于交易类型的路由 / Transaction type-based routing
    const txType = this.identifyTransactionType(tx);
    if (ROUTING_RULES.TYPE_BASED.FAST_TYPES.includes(txType)) {
      return BlockType.FAST;
    }
    
    // 默认路由到批量区块 / Default to batch block
    return BlockType.BATCH;
  }

  /**
   * 应用动态负载均衡
   * Apply dynamic load balancing
   */
  private applyLoadBalancing(initialBlockType: BlockType, complexity: ComplexityAnalysis): BlockType {
    if (!ROUTING_RULES.LOAD_BALANCING.OVERFLOW_REDIRECT) {
      return initialBlockType;
    }
    
    // 检查队列负载 / Check queue load
    if (initialBlockType === BlockType.FAST) {
      if (this.queueStatus.fastQueueSize >= ROUTING_RULES.LOAD_BALANCING.FAST_QUEUE_THRESHOLD) {
        // 快速队列过载，考虑重定向到批量区块 / Fast queue overloaded, consider redirect to batch
        if (complexity.complexityScore <= 5) { // 只有中等复杂度的交易才重定向 / Only redirect medium complexity transactions
          console.log(`⚠️ 快速队列过载，重定向到批量区块 / Fast queue overloaded, redirecting to batch block`);
          return BlockType.BATCH;
        }
      }
    } else if (initialBlockType === BlockType.BATCH) {
      if (this.queueStatus.batchQueueSize >= ROUTING_RULES.LOAD_BALANCING.BATCH_QUEUE_THRESHOLD) {
        // 批量队列过载，考虑重定向到快速区块 / Batch queue overloaded, consider redirect to fast
        if (complexity.gasEstimate <= ROUTING_RULES.GAS_BASED.FAST_MAX_GAS) {
          console.log(`⚠️ 批量队列过载，重定向到快速区块 / Batch queue overloaded, redirecting to fast block`);
          return BlockType.FAST;
        }
      }
    }
    
    return initialBlockType;
  }

  /**
   * 识别交易类型
   * Identify transaction type
   */
  private identifyTransactionType(tx: Transaction): string {
    // 简单转账 / Simple transfer
    if (tx.to !== null && (!tx.data || tx.data === '0x')) {
      return 'transfer';
    }
    
    // 合约调用 / Contract call
    if (tx.to !== null && tx.data && tx.data !== '0x') {
      // 基于函数选择器识别类型 / Identify type based on function selector
      const functionSelector = tx.data.slice(0, 10);
      
      switch (functionSelector) {
        case '0xa9059cbb': // transfer(address,uint256)
        case '0x23b872dd': // transferFrom(address,address,uint256)
          return 'transfer';
        case '0x095ea7b3': // approve(address,uint256)
          return 'basic_defi';
        case '0x38ed1739': // swapExactTokensForTokens
        case '0x7ff36ab5': // swapExactETHForTokens
          return 'swap';
        default:
          return 'complex_contract';
      }
    }
    
    // 合约部署 / Contract deployment
    if (tx.to === null) {
      return 'complex_contract';
    }
    
    return 'unknown';
  }

  /**
   * 计算交易优先级
   * Calculate transaction priority
   */
  private calculatePriority(tx: Transaction, complexity: ComplexityAnalysis, blockType: BlockType): number {
    let priority = 1;
    
    // 基于Gas价格的优先级 / Priority based on gas price
    const gasPrice = tx.gasPrice || BigInt('1000000000');
    const gasPriceGwei = Number(gasPrice) / 1e9;
    
    if (gasPriceGwei >= 20) priority += 3;
    else if (gasPriceGwei >= 10) priority += 2;
    else if (gasPriceGwei >= 5) priority += 1;
    
    // 基于复杂度的优先级调整 / Priority adjustment based on complexity
    if (blockType === BlockType.FAST && complexity.complexityScore <= 2) {
      priority += 2; // 简单交易在快速区块中优先级更高 / Simple transactions have higher priority in fast block
    }
    
    // 基于队列状态的优先级调整 / Priority adjustment based on queue status
    if (blockType === BlockType.FAST && this.queueStatus.fastQueueLoad > 0.8) {
      priority += 1; // 高负载时提高优先级 / Increase priority during high load
    }
    
    return Math.min(priority, 10); // 最大优先级为10 / Max priority is 10
  }

  /**
   * 估算交易延迟
   * Estimate transaction latency
   */
  private estimateLatency(blockType: BlockType, complexity: ComplexityAnalysis): number {
    const baseLatency = blockType === BlockType.FAST 
      ? DUAL_BLOCK_CONFIG.FAST_BLOCK.BLOCK_TIME
      : DUAL_BLOCK_CONFIG.BATCH_BLOCK.BLOCK_TIME;
    
    // 基于队列负载调整延迟 / Adjust latency based on queue load
    const queueLoad = blockType === BlockType.FAST 
      ? this.queueStatus.fastQueueLoad
      : this.queueStatus.batchQueueLoad;
    
    const loadMultiplier = 1 + (queueLoad * 0.5); // 负载越高延迟越大 / Higher load means higher latency
    
    return Math.floor(baseLatency * loadMultiplier);
  }

  /**
   * 计算决策置信度
   * Calculate decision confidence
   */
  private calculateConfidence(tx: Transaction, complexity: ComplexityAnalysis, blockType: BlockType): number {
    let confidence = 0.5; // 基础置信度 / Base confidence
    
    // 基于规则匹配度的置信度 / Confidence based on rule matching
    if (blockType === BlockType.FAST) {
      if (complexity.gasEstimate <= ROUTING_RULES.GAS_BASED.FAST_MAX_GAS) confidence += 0.3;
      if (complexity.complexityScore <= ROUTING_RULES.COMPLEXITY_BASED.FAST_MAX_COMPLEXITY) confidence += 0.2;
    } else {
      if (complexity.gasEstimate > ROUTING_RULES.GAS_BASED.FAST_MAX_GAS) confidence += 0.3;
      if (complexity.complexityScore > ROUTING_RULES.COMPLEXITY_BASED.FAST_MAX_COMPLEXITY) confidence += 0.2;
    }
    
    return Math.min(confidence, 1.0);
  }

  /**
   * 生成路由原因
   * Generate routing reason
   */
  private generateRoutingReason(tx: Transaction, complexity: ComplexityAnalysis, blockType: BlockType): string {
    const reasons: string[] = [];
    
    if (blockType === BlockType.FAST) {
      if (complexity.gasEstimate <= ROUTING_RULES.GAS_BASED.FAST_MAX_GAS) {
        reasons.push(`Low gas usage (${complexity.gasEstimate})`);
      }
      if (complexity.complexityScore <= ROUTING_RULES.COMPLEXITY_BASED.FAST_MAX_COMPLEXITY) {
        reasons.push(`Low complexity score (${complexity.complexityScore})`);
      }
      reasons.push('Suitable for fast block processing');
    } else {
      if (complexity.gasEstimate > ROUTING_RULES.GAS_BASED.FAST_MAX_GAS) {
        reasons.push(`High gas usage (${complexity.gasEstimate})`);
      }
      if (complexity.complexityScore > ROUTING_RULES.COMPLEXITY_BASED.FAST_MAX_COMPLEXITY) {
        reasons.push(`High complexity score (${complexity.complexityScore})`);
      }
      reasons.push('Requires batch block processing');
    }
    
    return reasons.join('; ');
  }

  /**
   * 更新路由统计信息
   * Update routing statistics
   */
  private updateRoutingStats(blockType: BlockType): void {
    const currentCount = this.routingStats.get(blockType) || 0;
    this.routingStats.set(blockType, currentCount + 1);
  }

  /**
   * 更新队列状态
   * Update queue status
   */
  updateQueueStatus(status: QueueStatus): void {
    this.queueStatus = { ...status };
    console.log(`📊 队列状态更新: 快速=${status.fastQueueSize}, 批量=${status.batchQueueSize} / Queue status updated: fast=${status.fastQueueSize}, batch=${status.batchQueueSize}`);
  }

  /**
   * 获取路由统计信息
   * Get routing statistics
   */
  getRoutingStats(): Map<BlockType, number> {
    return new Map(this.routingStats);
  }

  /**
   * 获取性能指标
   * Get performance metrics
   */
  getPerformanceMetrics(): Map<string, number> {
    const totalRouted = Array.from(this.routingStats.values()).reduce((sum, count) => sum + count, 0);
    const fastRatio = (this.routingStats.get(BlockType.FAST) || 0) / totalRouted;
    const batchRatio = (this.routingStats.get(BlockType.BATCH) || 0) / totalRouted;
    
    return new Map([
      ['total_routed', totalRouted],
      ['fast_ratio', fastRatio],
      ['batch_ratio', batchRatio],
      ['fast_queue_load', this.queueStatus.fastQueueLoad],
      ['batch_queue_load', this.queueStatus.batchQueueLoad]
    ]);
  }
}