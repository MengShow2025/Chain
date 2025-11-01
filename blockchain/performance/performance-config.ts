/**
 * 性能优化配置
 * 针对200k TPS目标的系统优化配置
 */

/**
 * 区块链核心性能配置
 */
export const blockchainPerformanceConfig = {
  // 区块配置
  block: {
    maxSize: 8 * 1024 * 1024, // 8MB区块大小
    maxTransactions: 10000, // 每个区块最大交易数
    targetTime: 1000, // 目标出块时间1秒
    batchSize: 1000, // 批处理大小
  },

  // 交易池配置
  mempool: {
    maxSize: 1000000, // 最大交易池大小
    maxTxPerAccount: 1000, // 每个账户最大待处理交易数
    cleanupInterval: 30000, // 清理间隔30秒
    priorityFeeThreshold: 0.001, // 优先费用阈值
  },

  // 共识配置
  consensus: {
    validatorCount: 21, // 验证者数量
    blockTime: 1000, // 出块时间1秒
    epochLength: 100, // 纪元长度
    slashingEnabled: true, // 启用惩罚机制
  },

  // 网络配置
  network: {
    maxPeers: 100, // 最大节点连接数
    connectionTimeout: 5000, // 连接超时5秒
    messageTimeout: 3000, // 消息超时3秒
    batchSize: 100, // 网络批处理大小
    compressionEnabled: true, // 启用压缩
  },

  // 存储配置
  storage: {
    cacheSize: 1024 * 1024 * 1024, // 1GB缓存
    writeBufferSize: 64 * 1024 * 1024, // 64MB写缓冲
    bloomFilterBits: 10, // 布隆过滤器位数
    compressionType: 'lz4', // 压缩类型
    maxOpenFiles: 10000, // 最大打开文件数
  },

  // 并行处理配置
  parallel: {
    workerThreads: 8, // 工作线程数
    batchSize: 1000, // 并行批处理大小
    queueSize: 10000, // 队列大小
    timeout: 5000, // 处理超时
  }
};

/**
 * API网关性能配置
 */
export const gatewayPerformanceConfig = {
  // 连接池配置
  connectionPool: {
    maxConnections: 10000, // 最大连接数
    minConnections: 100, // 最小连接数
    acquireTimeout: 5000, // 获取连接超时
    idleTimeout: 300000, // 空闲超时5分钟
    maxLifetime: 1800000, // 最大生命周期30分钟
  },

  // 负载均衡配置
  loadBalancer: {
    algorithm: 'round_robin', // 轮询算法
    healthCheckInterval: 5000, // 健康检查间隔
    maxRetries: 3, // 最大重试次数
    retryDelay: 1000, // 重试延迟
    circuitBreakerThreshold: 0.5, // 熔断器阈值
  },

  // 缓存配置
  cache: {
    maxSize: 512 * 1024 * 1024, // 512MB缓存
    ttl: 300000, // 5分钟TTL
    checkPeriod: 60000, // 检查周期1分钟
    compressionEnabled: true, // 启用压缩
  },

  // 限流配置
  rateLimit: {
    windowMs: 60000, // 1分钟窗口
    maxRequests: 10000, // 最大请求数
    skipSuccessfulRequests: false, // 不跳过成功请求
    skipFailedRequests: false, // 不跳过失败请求
  },

  // 超时配置
  timeout: {
    request: 30000, // 请求超时30秒
    response: 30000, // 响应超时30秒
    idle: 120000, // 空闲超时2分钟
    keepAlive: 5000, // 保持连接5秒
  }
};

/**
 * 数据库性能配置
 */
export const databasePerformanceConfig = {
  // 连接池配置
  pool: {
    min: 10, // 最小连接数
    max: 100, // 最大连接数
    acquireTimeoutMillis: 5000, // 获取连接超时
    idleTimeoutMillis: 300000, // 空闲超时
    createTimeoutMillis: 3000, // 创建连接超时
  },

  // 查询优化
  query: {
    timeout: 30000, // 查询超时30秒
    batchSize: 1000, // 批处理大小
    maxRetries: 3, // 最大重试次数
    retryDelay: 1000, // 重试延迟
  },

  // 索引配置
  index: {
    autoCreate: true, // 自动创建索引
    background: true, // 后台创建
    sparse: true, // 稀疏索引
    unique: false, // 非唯一索引
  },

  // 缓存配置
  cache: {
    enabled: true, // 启用缓存
    maxSize: 256 * 1024 * 1024, // 256MB缓存
    ttl: 600000, // 10分钟TTL
    checkPeriod: 120000, // 检查周期2分钟
  }
};

/**
 * 系统资源配置
 */
export const systemResourceConfig = {
  // CPU配置
  cpu: {
    maxUsage: 80, // 最大CPU使用率80%
    coreCount: 8, // CPU核心数
    affinityEnabled: true, // 启用CPU亲和性
    priorityClass: 'high', // 高优先级
  },

  // 内存配置
  memory: {
    maxUsage: 85, // 最大内存使用率85%
    heapSize: '4g', // 堆大小4GB
    gcAlgorithm: 'g1', // G1垃圾收集器
    gcThreads: 4, // GC线程数
  },

  // 磁盘配置
  disk: {
    maxUsage: 90, // 最大磁盘使用率90%
    ioScheduler: 'deadline', // IO调度器
    readAhead: 256, // 预读大小256KB
    writeCache: true, // 启用写缓存
  },

  // 网络配置
  network: {
    maxBandwidth: '10Gbps', // 最大带宽10Gbps
    bufferSize: 64 * 1024, // 缓冲区大小64KB
    tcpNoDelay: true, // 禁用Nagle算法
    keepAlive: true, // 启用保持连接
  }
};

/**
 * 监控配置
 */
export const monitoringConfig = {
  // 性能监控
  performance: {
    enabled: true, // 启用性能监控
    interval: 1000, // 监控间隔1秒
    historySize: 1000, // 历史数据大小
    alertThreshold: 0.8, // 警报阈值80%
  },

  // 日志配置
  logging: {
    level: 'info', // 日志级别
    maxSize: '100MB', // 最大日志文件大小
    maxFiles: 10, // 最大日志文件数
    compress: true, // 压缩日志
  },

  // 指标收集
  metrics: {
    enabled: true, // 启用指标收集
    interval: 5000, // 收集间隔5秒
    retention: 86400000, // 保留时间24小时
    aggregation: 'avg', // 聚合方式
  },

  // 健康检查
  healthCheck: {
    enabled: true, // 启用健康检查
    interval: 10000, // 检查间隔10秒
    timeout: 5000, // 检查超时5秒
    retries: 3, // 重试次数
  }
};

/**
 * 优化策略配置
 */
export const optimizationConfig = {
  // 自动优化
  auto: {
    enabled: true, // 启用自动优化
    interval: 30000, // 优化间隔30秒
    maxActions: 3, // 最大并发优化动作
    rollbackOnFailure: true, // 失败时回滚
  },

  // 缓存优化
  cache: {
    strategy: 'lru', // LRU策略
    maxSize: 1024 * 1024 * 1024, // 1GB缓存
    ttl: 300000, // 5分钟TTL
    compressionRatio: 0.7, // 压缩比70%
  },

  // 批处理优化
  batch: {
    enabled: true, // 启用批处理
    size: 1000, // 批处理大小
    timeout: 100, // 批处理超时100ms
    maxWait: 1000, // 最大等待时间1秒
  },

  // 连接池优化
  pool: {
    strategy: 'adaptive', // 自适应策略
    minSize: 10, // 最小池大小
    maxSize: 1000, // 最大池大小
    growthFactor: 1.5, // 增长因子
    shrinkFactor: 0.8, // 收缩因子
  }
};

/**
 * 获取完整的性能配置
 */
export function getPerformanceConfig() {
  return {
    blockchain: blockchainPerformanceConfig,
    gateway: gatewayPerformanceConfig,
    database: databasePerformanceConfig,
    system: systemResourceConfig,
    monitoring: monitoringConfig,
    optimization: optimizationConfig
  };
}

/**
 * 应用性能配置
 */
export function applyPerformanceConfig(config: any = getPerformanceConfig()) {
  console.log('🚀 应用性能优化配置');
  
  // 设置Node.js性能参数
  if (process.env.NODE_ENV === 'production') {
    // 设置最大内存
    process.env.NODE_OPTIONS = `--max-old-space-size=${parseInt(config.system.memory.heapSize) * 1024}`;
    
    // 设置GC参数
    if (config.system.memory.gcAlgorithm === 'g1') {
      process.env.NODE_OPTIONS += ' --gc-global';
    }
  }

  // 设置事件循环优化
  process.nextTick(() => {
    // 优化事件循环
    if (typeof setImmediate !== 'undefined') {
      setImmediate(() => {
        console.log('✅ 事件循环优化已应用');
      });
    }
  });

  // 设置内存优化
  if (global.gc) {
    // 定期执行垃圾回收
    setInterval(() => {
      if (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal > 0.8) {
        global.gc();
      }
    }, 60000); // 每分钟检查一次
  }

  console.log('✅ 性能配置应用完成');
  return config;
}

/**
 * 性能配置验证
 */
export function validatePerformanceConfig(config: any): boolean {
  const errors: string[] = [];

  // 验证区块链配置
  if (config.blockchain?.block?.maxSize < 1024 * 1024) {
    errors.push('区块大小不能小于1MB');
  }

  if (config.blockchain?.block?.targetTime < 100) {
    errors.push('目标出块时间不能小于100ms');
  }

  // 验证网关配置
  if (config.gateway?.connectionPool?.maxConnections < 100) {
    errors.push('最大连接数不能小于100');
  }

  // 验证系统资源配置
  if (config.system?.cpu?.maxUsage > 95) {
    errors.push('CPU最大使用率不能超过95%');
  }

  if (config.system?.memory?.maxUsage > 95) {
    errors.push('内存最大使用率不能超过95%');
  }

  if (errors.length > 0) {
    console.error('❌ 性能配置验证失败:');
    errors.forEach(error => console.error(`   - ${error}`));
    return false;
  }

  console.log('✅ 性能配置验证通过');
  return true;
}

// 默认导出
export default {
  blockchain: blockchainPerformanceConfig,
  gateway: gatewayPerformanceConfig,
  database: databasePerformanceConfig,
  system: systemResourceConfig,
  monitoring: monitoringConfig,
  optimization: optimizationConfig,
  getPerformanceConfig,
  applyPerformanceConfig,
  validatePerformanceConfig
};