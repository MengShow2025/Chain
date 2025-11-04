/**
 * TitanChain 性能分层配置
 * Performance Tiers Configuration
 */

// 性能层级枚举 / Performance Tier Enumeration
export enum PerformanceTier {
  TIER_1 = 'tier_1',  // 超高频交易 / Ultra-high frequency trading
  TIER_2 = 'tier_2',  // 标准交易 / Standard trading
  TIER_3 = 'tier_3'   // 批量处理 / Batch processing
}

// 性能层级配置 / Performance Tier Configuration
export const PERFORMANCE_TIERS = {
  // 第一层：超高频交易 / Tier 1: Ultra-high frequency trading
  TIER_1: {
    MAX_LATENCY: 100,           // 100ms最大延迟 / 100ms max latency
    GAS_LIMIT: BigInt('50000'), // 50k gas限制 / 50k gas limit
    PRIORITY: 'highest',        // 最高优先级 / Highest priority
    TARGET_TPS: 10000,          // 目标TPS / Target TPS
    TRANSACTION_TYPES: [        // 支持的交易类型 / Supported transaction types
      'simple_transfer',        // 简单转账 / Simple transfer
      'token_transfer',         // 代币转账 / Token transfer
      'basic_swap'              // 基础交换 / Basic swap
    ],
    PROCESSING_MODE: 'immediate', // 立即处理 / Immediate processing
    QUEUE_SIZE_LIMIT: 1000,     // 队列大小限制 / Queue size limit
    TIMEOUT: 50                 // 50ms超时 / 50ms timeout
  },
  
  // 第二层：标准交易 / Tier 2: Standard trading
  TIER_2: {
    MAX_LATENCY: 1000,            // 1秒最大延迟 / 1 second max latency
    GAS_LIMIT: BigInt('500000'),  // 500k gas限制 / 500k gas limit
    PRIORITY: 'high',             // 高优先级 / High priority
    TARGET_TPS: 5000,             // 目标TPS / Target TPS
    TRANSACTION_TYPES: [          // 支持的交易类型 / Supported transaction types
      'defi_operations',          // DeFi操作 / DeFi operations
      'nft_trading',              // NFT交易 / NFT trading
      'staking_operations',       // 质押操作 / Staking operations
      'governance_voting'         // 治理投票 / Governance voting
    ],
    PROCESSING_MODE: 'batched',   // 批量处理 / Batched processing
    QUEUE_SIZE_LIMIT: 5000,       // 队列大小限制 / Queue size limit
    TIMEOUT: 800                  // 800ms超时 / 800ms timeout
  },
  
  // 第三层：批量处理 / Tier 3: Batch processing
  TIER_3: {
    MAX_LATENCY: 5000,            // 5秒最大延迟 / 5 seconds max latency
    GAS_LIMIT: BigInt('5000000'), // 5M gas限制 / 5M gas limit
    PRIORITY: 'normal',           // 普通优先级 / Normal priority
    TARGET_TPS: 50000,            // 目标TPS / Target TPS
    TRANSACTION_TYPES: [          // 支持的交易类型 / Supported transaction types
      'complex_contract',         // 复杂合约 / Complex contract
      'batch_operations',         // 批量操作 / Batch operations
      'heavy_computation',        // 重计算 / Heavy computation
      'multi_call',               // 多重调用 / Multi-call
      'contract_deployment'       // 合约部署 / Contract deployment
    ],
    PROCESSING_MODE: 'scheduled', // 计划处理 / Scheduled processing
    QUEUE_SIZE_LIMIT: 20000,      // 队列大小限制 / Queue size limit
    TIMEOUT: 4000                 // 4秒超时 / 4 seconds timeout
  }
} as const;

// 性能层级路由规则 / Performance Tier Routing Rules
export const TIER_ROUTING_RULES = {
  // 基于Gas使用量的路由 / Gas-based routing
  GAS_BASED: {
    TIER_1_MAX_GAS: PERFORMANCE_TIERS.TIER_1.GAS_LIMIT,
    TIER_2_MAX_GAS: PERFORMANCE_TIERS.TIER_2.GAS_LIMIT,
    TIER_3_MAX_GAS: PERFORMANCE_TIERS.TIER_3.GAS_LIMIT
  },
  
  // 基于交易类型的路由 / Transaction type-based routing
  TYPE_BASED: {
    TIER_1_TYPES: PERFORMANCE_TIERS.TIER_1.TRANSACTION_TYPES,
    TIER_2_TYPES: PERFORMANCE_TIERS.TIER_2.TRANSACTION_TYPES,
    TIER_3_TYPES: PERFORMANCE_TIERS.TIER_3.TRANSACTION_TYPES
  },
  
  // 基于优先级的路由 / Priority-based routing
  PRIORITY_BASED: {
    HIGHEST: PerformanceTier.TIER_1,
    HIGH: PerformanceTier.TIER_2,
    NORMAL: PerformanceTier.TIER_3
  },
  
  // 动态负载均衡 / Dynamic load balancing
  LOAD_BALANCING: {
    TIER_1_QUEUE_THRESHOLD: 800,    // 第一层队列阈值 / Tier 1 queue threshold
    TIER_2_QUEUE_THRESHOLD: 4000,   // 第二层队列阈值 / Tier 2 queue threshold
    TIER_3_QUEUE_THRESHOLD: 15000,  // 第三层队列阈值 / Tier 3 queue threshold
    OVERFLOW_REDIRECT: true,        // 溢出重定向 / Overflow redirect
    LOAD_FACTOR_THRESHOLD: 0.8      // 负载因子阈值 / Load factor threshold
  }
} as const;

// 性能监控配置 / Performance Monitoring Configuration
export const TIER_MONITORING = {
  // 延迟监控 / Latency monitoring
  LATENCY_TARGETS: {
    TIER_1_MAX_LATENCY: PERFORMANCE_TIERS.TIER_1.MAX_LATENCY,
    TIER_2_MAX_LATENCY: PERFORMANCE_TIERS.TIER_2.MAX_LATENCY,
    TIER_3_MAX_LATENCY: PERFORMANCE_TIERS.TIER_3.MAX_LATENCY
  },
  
  // 吞吐量监控 / Throughput monitoring
  THROUGHPUT_TARGETS: {
    TIER_1_MIN_TPS: PERFORMANCE_TIERS.TIER_1.TARGET_TPS * 0.8,
    TIER_2_MIN_TPS: PERFORMANCE_TIERS.TIER_2.TARGET_TPS * 0.8,
    TIER_3_MIN_TPS: PERFORMANCE_TIERS.TIER_3.TARGET_TPS * 0.8
  },
  
  // 队列监控 / Queue monitoring
  QUEUE_MONITORING: {
    WARNING_THRESHOLD: 0.7,         // 警告阈值 / Warning threshold
    CRITICAL_THRESHOLD: 0.9,        // 临界阈值 / Critical threshold
    MONITORING_INTERVAL: 1000       // 监控间隔(ms) / Monitoring interval (ms)
  },
  
  // 性能指标 / Performance metrics
  METRICS: {
    LATENCY_PERCENTILES: [50, 90, 95, 99], // 延迟百分位 / Latency percentiles
    TPS_WINDOW_SIZE: 10000,                 // TPS窗口大小 / TPS window size
    ERROR_RATE_THRESHOLD: 0.01              // 错误率阈值 / Error rate threshold
  }
} as const;

// 性能层级接口定义 / Performance Tier Interface Definitions
export interface TierConfiguration {
  readonly MAX_LATENCY: number;
  readonly GAS_LIMIT: bigint;
  readonly PRIORITY: string;
  readonly TARGET_TPS: number;
  readonly TRANSACTION_TYPES: readonly string[];
  readonly PROCESSING_MODE: string;
  readonly QUEUE_SIZE_LIMIT: number;
  readonly TIMEOUT: number;
}

export interface TierMetrics {
  tier: PerformanceTier;
  currentTPS: number;
  averageLatency: number;
  queueSize: number;
  queueLoad: number;
  errorRate: number;
  successRate: number;
  timestamp: number;
}

export interface TierStatus {
  tier: PerformanceTier;
  isActive: boolean;
  isOverloaded: boolean;
  queueSize: number;
  processingCount: number;
  lastProcessedTime: number;
  metrics: TierMetrics;
}

// 性能层级分类器 / Performance Tier Classifier
export class PerformanceTierClassifier {
  /**
   * 根据交易特征分类到性能层级
   * Classify transaction to performance tier based on characteristics
   */
  static classifyTransaction(tx: any): PerformanceTier {
    // 1. 基于Gas使用量分类 / Classify based on gas usage
    if (tx.gasLimit <= TIER_ROUTING_RULES.GAS_BASED.TIER_1_MAX_GAS) {
      return PerformanceTier.TIER_1;
    }
    
    if (tx.gasLimit <= TIER_ROUTING_RULES.GAS_BASED.TIER_2_MAX_GAS) {
      return PerformanceTier.TIER_2;
    }
    
    // 2. 基于交易类型分类 / Classify based on transaction type
    const txType = this.identifyTransactionType(tx);
    
    if (TIER_ROUTING_RULES.TYPE_BASED.TIER_1_TYPES.includes(txType)) {
      return PerformanceTier.TIER_1;
    }
    
    if (TIER_ROUTING_RULES.TYPE_BASED.TIER_2_TYPES.includes(txType)) {
      return PerformanceTier.TIER_2;
    }
    
    // 默认分类到第三层 / Default to tier 3
    return PerformanceTier.TIER_3;
  }
  
  /**
   * 识别交易类型
   * Identify transaction type
   */
  private static identifyTransactionType(tx: any): string {
    // 简单转账 / Simple transfer
    if (tx.to !== null && (!tx.data || tx.data === '0x')) {
      return 'simple_transfer';
    }
    
    // 合约调用 / Contract call
    if (tx.to !== null && tx.data && tx.data !== '0x') {
      const functionSelector = tx.data.slice(0, 10);
      
      switch (functionSelector) {
        case '0xa9059cbb': // transfer(address,uint256)
          return 'token_transfer';
        case '0x38ed1739': // swapExactTokensForTokens
          return 'basic_swap';
        case '0x095ea7b3': // approve(address,uint256)
          return 'defi_operations';
        default:
          return 'complex_contract';
      }
    }
    
    // 合约部署 / Contract deployment
    if (tx.to === null) {
      return 'contract_deployment';
    }
    
    return 'unknown';
  }
  
  /**
   * 获取层级配置
   * Get tier configuration
   */
  static getTierConfig(tier: PerformanceTier): TierConfiguration {
    switch (tier) {
      case PerformanceTier.TIER_1:
        return PERFORMANCE_TIERS.TIER_1;
      case PerformanceTier.TIER_2:
        return PERFORMANCE_TIERS.TIER_2;
      case PerformanceTier.TIER_3:
        return PERFORMANCE_TIERS.TIER_3;
      default:
        return PERFORMANCE_TIERS.TIER_3;
    }
  }
}