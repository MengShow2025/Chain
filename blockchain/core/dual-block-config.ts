/**
 * TitanChain 混合双区块架构配置
 * Hybrid Dual-Block Architecture Configuration
 */

// 区块类型枚举 / Block Type Enumeration
export enum BlockType {
  FAST = 'fast',    // 快速区块 / Fast Block
  BATCH = 'batch'   // 批量区块 / Batch Block
}

// 双区块配置 / Dual Block Configuration
export const DUAL_BLOCK_CONFIG = {
  // 快速区块配置 / Fast Block Configuration
  FAST_BLOCK: {
    GAS_LIMIT: BigInt('5000000'),        // 5M gas限制 / 5M gas limit
    BLOCK_TIME: 1000,                    // 1秒出块时间 / 1 second block time
    TARGET_TPS: 5000,                    // 目标TPS / Target TPS
    MAX_TRANSACTIONS: 1000,              // 最大交易数 / Max transactions per block
    PRIORITY_TYPES: [                    // 优先交易类型 / Priority transaction types
      'transfer',                        // 转账 / Transfer
      'swap',                           // 交换 / Swap
      'basic_defi',                     // 基础DeFi / Basic DeFi
      'simple_contract'                 // 简单合约 / Simple contract
    ],
    // Gas阈值 - 低于此值的交易优先进入快速区块 / Gas threshold - transactions below this go to fast block
    GAS_THRESHOLD: BigInt('100000'),     // 100k gas
    // 合约复杂度阈值 / Contract complexity threshold
    COMPLEXITY_THRESHOLD: 3
  },
  
  // 批量区块配置 / Batch Block Configuration  
  BATCH_BLOCK: {
    GAS_LIMIT: BigInt('50000000'),       // 50M gas限制 / 50M gas limit
    BLOCK_TIME: 5000,                    // 5秒出块时间 / 5 second block time
    TARGET_TPS: 50000,                   // 目标TPS / Target TPS
    MAX_TRANSACTIONS: 10000,             // 最大交易数 / Max transactions per block
    PRIORITY_TYPES: [                    // 优先交易类型 / Priority transaction types
      'complex_contract',                // 复杂合约 / Complex contract
      'batch_operations',                // 批量操作 / Batch operations
      'heavy_computation',               // 重计算 / Heavy computation
      'multi_call'                      // 多重调用 / Multi-call
    ],
    // Gas阈值 - 高于此值的交易进入批量区块 / Gas threshold - transactions above this go to batch block
    GAS_THRESHOLD: BigInt('100000'),     // 100k gas
    // 合约复杂度阈值 / Contract complexity threshold
    COMPLEXITY_THRESHOLD: 3
  }
} as const;

// 交易路由规则 / Transaction Routing Rules
export const ROUTING_RULES = {
  // 基于Gas使用量的路由 / Gas-based routing
  GAS_BASED: {
    FAST_MAX_GAS: DUAL_BLOCK_CONFIG.FAST_BLOCK.GAS_THRESHOLD,
    BATCH_MIN_GAS: DUAL_BLOCK_CONFIG.BATCH_BLOCK.GAS_THRESHOLD
  },
  
  // 基于交易类型的路由 / Transaction type-based routing
  TYPE_BASED: {
    FAST_TYPES: DUAL_BLOCK_CONFIG.FAST_BLOCK.PRIORITY_TYPES,
    BATCH_TYPES: DUAL_BLOCK_CONFIG.BATCH_BLOCK.PRIORITY_TYPES
  },
  
  // 基于合约复杂度的路由 / Contract complexity-based routing
  COMPLEXITY_BASED: {
    FAST_MAX_COMPLEXITY: DUAL_BLOCK_CONFIG.FAST_BLOCK.COMPLEXITY_THRESHOLD,
    BATCH_MIN_COMPLEXITY: DUAL_BLOCK_CONFIG.BATCH_BLOCK.COMPLEXITY_THRESHOLD
  },
  
  // 动态负载均衡 / Dynamic load balancing
  LOAD_BALANCING: {
    FAST_QUEUE_THRESHOLD: 500,           // 快速队列阈值 / Fast queue threshold
    BATCH_QUEUE_THRESHOLD: 2000,         // 批量队列阈值 / Batch queue threshold
    OVERFLOW_REDIRECT: true              // 溢出重定向 / Overflow redirect
  }
} as const;

// 性能监控配置 / Performance Monitoring Configuration
export const PERFORMANCE_MONITORING = {
  // 延迟监控 / Latency monitoring
  LATENCY_TARGETS: {
    FAST_BLOCK_MAX_LATENCY: 1000,        // 快速区块最大延迟(ms) / Fast block max latency (ms)
    BATCH_BLOCK_MAX_LATENCY: 5000        // 批量区块最大延迟(ms) / Batch block max latency (ms)
  },
  
  // 吞吐量监控 / Throughput monitoring
  THROUGHPUT_TARGETS: {
    FAST_BLOCK_MIN_TPS: 3000,            // 快速区块最小TPS / Fast block min TPS
    BATCH_BLOCK_MIN_TPS: 30000           // 批量区块最小TPS / Batch block min TPS
  },
  
  // 队列监控 / Queue monitoring
  QUEUE_MONITORING: {
    MAX_QUEUE_SIZE: 10000,               // 最大队列大小 / Max queue size
    WARNING_THRESHOLD: 7000,             // 警告阈值 / Warning threshold
    CRITICAL_THRESHOLD: 9000             // 临界阈值 / Critical threshold
  }
} as const;

// 区块生产者配置 / Block Producer Configuration
export const BLOCK_PRODUCER_CONFIG = {
  // 快速区块生产者 / Fast block producer
  FAST_PRODUCER: {
    ENABLED: true,                       // 启用快速区块生产 / Enable fast block production
    CONCURRENT_BLOCKS: 1,                // 并发区块数 / Concurrent blocks
    RETRY_ATTEMPTS: 3,                   // 重试次数 / Retry attempts
    TIMEOUT: 800                         // 超时时间(ms) / Timeout (ms)
  },
  
  // 批量区块生产者 / Batch block producer
  BATCH_PRODUCER: {
    ENABLED: true,                       // 启用批量区块生产 / Enable batch block production
    CONCURRENT_BLOCKS: 1,                // 并发区块数 / Concurrent blocks
    RETRY_ATTEMPTS: 2,                   // 重试次数 / Retry attempts
    TIMEOUT: 4000                        // 超时时间(ms) / Timeout (ms)
  }
} as const;

// 区块同步配置 / Block Synchronization Configuration
export const BLOCK_SYNC_CONFIG = {
  // 同步策略 / Synchronization strategy
  SYNC_STRATEGY: 'parallel',             // 'parallel' | 'sequential'
  
  // 状态一致性检查 / State consistency check
  CONSISTENCY_CHECK: {
    ENABLED: true,                       // 启用一致性检查 / Enable consistency check
    CHECK_INTERVAL: 10000,               // 检查间隔(ms) / Check interval (ms)
    MAX_DRIFT: 2                         // 最大漂移区块数 / Max drift blocks
  },
  
  // 区块链分叉处理 / Blockchain fork handling
  FORK_HANDLING: {
    MAX_REORG_DEPTH: 10,                 // 最大重组深度 / Max reorg depth
    CONFIRMATION_BLOCKS: 3               // 确认区块数 / Confirmation blocks
  }
} as const;