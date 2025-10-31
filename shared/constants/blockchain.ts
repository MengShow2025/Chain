// TitanChain 区块链常量定义

// 网络配置
export const NETWORK_CONFIG = {
  CHAIN_ID: 7777,
  NETWORK_NAME: 'TitanChain',
  CURRENCY_NAME: 'TTN',
  CURRENCY_SYMBOL: 'TTN',
  CURRENCY_DECIMALS: 18,
  RPC_URL: 'http://localhost:8545',
  EXPLORER_URL: 'http://localhost:3000',
} as const;

// 共识机制配置
export const CONSENSUS_CONFIG = {
  MAX_VALIDATORS: 108, // 最大验证节点数
  MAX_CANDIDATES: 2000, // 最大候补节点数
  EPOCH_BLOCKS: 21600, // 每个epoch的区块数 (约6小时)
  BLOCK_TIME: 3, // 目标出块时间(秒)
  MIN_VALIDATOR_STAKE: BigInt('1000000000000000000000'), // 最小验证节点质押 (1000 TTN)
  MIN_DELEGATOR_STAKE: BigInt('100000000000000000000'), // 最小委托质押 (100 TTN)
  UNBONDING_PERIOD: 604800, // 解绑期 (7天)
  SLASH_FRACTION_DOUBLE_SIGN: 0.05, // 双签惩罚比例
  SLASH_FRACTION_DOWNTIME: 0.01, // 离线惩罚比例
} as const;

// 性能目标
export const PERFORMANCE_CONFIG = {
  TARGET_TPS: 200000, // 目标TPS
  MAX_BLOCK_SIZE: 1024 * 1024 * 10, // 最大区块大小 (10MB)
  MAX_GAS_LIMIT: BigInt('30000000'), // 最大Gas限制
  BASE_FEE: BigInt('1000000000'), // 基础费用 (1 Gwei)
  PRIORITY_FEE_CAP: BigInt('2000000000'), // 优先费用上限 (2 Gwei)
  
  // 高性能处理器配置
  PARALLEL_WORKERS: 4, // 并行工作线程数
  PROCESSING_INTERVAL: 100, // 处理间隔 (毫秒)
  MAX_BATCH_SIZE: 1000, // 最大批处理大小
  OPTIMAL_BATCH_SIZE: 100, // 最优批处理大小
  
  // 队列管理
  MAX_QUEUE_SIZE: 10000, // 最大队列大小
  EMERGENCY_THRESHOLD: 8000, // 紧急处理阈值
  NORMAL_THRESHOLD: 2000, // 正常处理阈值
  
  // 交易限制
  MAX_TRANSACTION_SIZE: 1024 * 32, // 最大交易大小 (32KB)
  MAX_PENDING_TRANSACTIONS: 50000, // 最大待处理交易数
  MIN_GAS_PRICE: BigInt('1000000000'), // 最小Gas价格 (1 Gwei)
  MAX_TRANSACTIONS_PER_BLOCK: 10000, // 每个区块最大交易数
} as const;

// 代币经济学
export const TOKEN_CONFIG = {
  TOTAL_SUPPLY: BigInt('1000000000000000000000000000'), // 总供应量 (10亿 TTN)
  PRE_MINED_RATIO: 0.3, // 预挖比例 30%
  BLOCK_REWARD_RATIO: 0.7, // 区块奖励比例 70%
  INITIAL_BLOCK_REWARD: BigInt('5000000000000000000'), // 初始区块奖励 (5 TTN)
  REWARD_DECAY_RATE: 0.98, // 奖励衰减率 (每年2%)
  VALIDATOR_COMMISSION_MAX: 0.2, // 验证节点最大佣金比例 20%
} as const;

// 0-gas费机制配置
export const ZERO_GAS_CONFIG = {
  EXCHANGE_BATCH_FREE: true, // 交易所批量交易免费
  CONTRACT_TIER_FEES: {
    1: BigInt('100000000000000'), // 一级合约费用 (0.0001 TTN)
    2: BigInt('500000000000000'), // 二级合约费用 (0.0005 TTN)
    3: BigInt('1000000000000000'), // 三级合约费用 (0.001 TTN)
  },
  PLATFORM_FEE_RATIO: 0.2, // 平台收费比例 20%
  PUBLISHER_FEE_RATIO: 0.8, // 发布者收费比例 80%
  
  // 批量交易配置
  BATCH_SIZE_THRESHOLD: 100, // 批量交易最小数量
  BATCH_VOLUME_THRESHOLD: BigInt('1000000000000000000'), // 批量交易最小总量 (1 TTN)
} as const;

// 流动性共享配置
export const LIQUIDITY_CONFIG = {
  ORDER_BOOK_UPDATE_INTERVAL: 100, // 订单簿更新间隔 (毫秒)
  MAX_PRICE_DEVIATION: 0.05, // 最大价格偏差 5%
  MIN_LIQUIDITY_THRESHOLD: BigInt('10000000000000000000'), // 最小流动性阈值 (10 TTN)
  FEE_DISTRIBUTION: {
    EXECUTING_EXCHANGE: 0.7, // 执行交易所 70%
    LIQUIDITY_PROVIDER: 0.2, // 流动性提供者 20%
    PLATFORM: 0.1, // 平台 10%
  },
} as const;

// 验证节点状态
export const VALIDATOR_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  JAILED: 'jailed',
  CANDIDATE: 'candidate',
} as const;

// 交易状态
export const TRANSACTION_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  FAILED: 'failed',
} as const;

// 网络健康状态
export const NETWORK_HEALTH = {
  EXCELLENT: 'excellent', // TPS > 150k, 延迟 < 50ms
  GOOD: 'good', // TPS > 100k, 延迟 < 100ms
  WARNING: 'warning', // TPS > 50k, 延迟 < 200ms
  CRITICAL: 'critical', // TPS < 50k, 延迟 > 200ms
} as const;

// API 端点
export const API_ENDPOINTS = {
  // 区块链数据
  NETWORK_STATS: '/api/v1/network/stats',
  BLOCKS: '/api/v1/blocks',
  TRANSACTIONS: '/api/v1/transactions',
  ADDRESSES: '/api/v1/addresses',
  CONTRACTS: '/api/v1/contracts',
  
  // 验证节点
  VALIDATORS: '/api/v1/validators',
  CANDIDATES: '/api/v1/candidates',
  STAKING: '/api/v1/staking',
  
  // 钱包
  WALLET_CONNECT: '/api/v1/wallet/connect',
  WALLET_BALANCE: '/api/v1/wallet/balance',
  WALLET_TRANSACTIONS: '/api/v1/wallet/transactions',
  
  // 流动性
  LIQUIDITY_POOLS: '/api/v1/liquidity/pools',
  ORDER_BOOK: '/api/v1/liquidity/orderbook',
  TRADING_PAIRS: '/api/v1/liquidity/pairs',
} as const;

// 错误代码
export const ERROR_CODES = {
  INVALID_TRANSACTION: 'INVALID_TRANSACTION',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  VALIDATOR_NOT_FOUND: 'VALIDATOR_NOT_FOUND',
  STAKING_AMOUNT_TOO_LOW: 'STAKING_AMOUNT_TOO_LOW',
  NETWORK_CONGESTION: 'NETWORK_CONGESTION',
  CONTRACT_EXECUTION_FAILED: 'CONTRACT_EXECUTION_FAILED',
} as const;

// 事件类型
export const EVENT_TYPES = {
  BLOCK_CREATED: 'block_created',
  TRANSACTION_CONFIRMED: 'transaction_confirmed',
  VALIDATOR_JOINED: 'validator_joined',
  VALIDATOR_LEFT: 'validator_left',
  STAKING_REWARD: 'staking_reward',
  LIQUIDITY_UPDATED: 'liquidity_updated',
} as const;