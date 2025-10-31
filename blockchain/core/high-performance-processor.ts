import { Transaction, Block } from '../../shared/types/blockchain.js';
import { PERFORMANCE_CONFIG } from '../../shared/constants/blockchain.js';
import { ZeroGasEngine } from './zero-gas-engine.js';
import { TransactionPool } from './transaction-pool.js';

/**
 * 高性能交易处理器
 * 实现并行处理、批量优化和智能调度
 */
export class HighPerformanceProcessor {
  private zeroGasEngine: ZeroGasEngine;
  private transactionPool: TransactionPool;
  private processingQueue: Transaction[] = [];
  private batchProcessor: BatchProcessor;
  private parallelWorkers: Worker[] = [];
  private isProcessing = false;
  // 运行时可调配置，避免修改只读常量
  private runtimeConfig: {
    maxBatchSize: number;
    maxQueueSize: number;
    emergencyThreshold: number;
    normalThreshold: number;
  } = {
    maxBatchSize: PERFORMANCE_CONFIG.MAX_BATCH_SIZE,
    maxQueueSize: PERFORMANCE_CONFIG.MAX_QUEUE_SIZE,
    emergencyThreshold: PERFORMANCE_CONFIG.EMERGENCY_THRESHOLD,
    normalThreshold: PERFORMANCE_CONFIG.NORMAL_THRESHOLD,
  };
  
  // 性能监控
  private metrics = {
    totalProcessed: 0,
    averageLatency: 0,
    throughputPerSecond: 0,
    errorRate: 0,
    queueSize: 0,
    batchEfficiency: 0,
    parallelUtilization: 0
  };
  
  // 处理统计
  private stats = {
    processedTransactions: 0,
    failedTransactions: 0,
    totalProcessingTime: 0,
    batchesProcessed: 0,
    lastThroughputCheck: Date.now(),
    recentThroughput: []
  };
  
  constructor(transactionPool: TransactionPool) {
    this.transactionPool = transactionPool;
    this.zeroGasEngine = new ZeroGasEngine();
    this.batchProcessor = new BatchProcessor();
    
    console.log('Initializing High Performance Processor');
    
    // 初始化并行工作线程
    this.initializeWorkers();
    
    // 启动处理循环
    this.startProcessingLoop();
    
    // 启动性能监控
    this.startPerformanceMonitoring();
  }
  
  /**
   * 初始化并行工作线程
   */
  private initializeWorkers(): void {
    const workerCount = PERFORMANCE_CONFIG.PARALLEL_WORKERS || 4;
    
    for (let i = 0; i < workerCount; i++) {
      // 在实际实现中，这里会创建Web Workers或Worker Threads
      // 目前使用模拟的工作线程
      const worker = new MockWorker(i);
      this.parallelWorkers.push(worker);
    }
    
    console.log(`Initialized ${workerCount} parallel workers`);
  }
  
  /**
   * 启动处理循环
   */
  private startProcessingLoop(): void {
    setInterval(async () => {
      if (!this.isProcessing && this.processingQueue.length > 0) {
        await this.processTransactionBatch();
      }
    }, PERFORMANCE_CONFIG.PROCESSING_INTERVAL || 100);
  }
  
  /**
   * 启动性能监控
   */
  private startPerformanceMonitoring(): void {
    setInterval(() => {
      this.updateMetrics();
    }, 1000); // 每秒更新一次指标
  }
  
  /**
   * 处理交易批次
   */
  async processTransactionBatch(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    const startTime = Date.now();
    
    try {
      // 获取待处理交易
      const batchSize = Math.min(
        this.processingQueue.length,
        PERFORMANCE_CONFIG.MAX_BATCH_SIZE || 1000
      );
      
      const batch = this.processingQueue.splice(0, batchSize);
      
      if (batch.length === 0) {
        this.isProcessing = false;
        return;
      }
      
      console.log(`Processing batch of ${batch.length} transactions`);
      
      // 分类交易
      const { zeroGasTransactions, regularTransactions } = this.categorizeTransactions(batch);
      
      // 并行处理不同类型的交易
      const results = await Promise.allSettled([
        this.processZeroGasTransactions(zeroGasTransactions),
        this.processRegularTransactions(regularTransactions)
      ]);
      
      // 统计处理结果
      let successCount = 0;
      let failureCount = 0;
      
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          successCount += result.value.success;
          failureCount += result.value.failed;
        } else {
          failureCount += batch.length;
        }
      });
      
      // 更新统计信息
      this.stats.processedTransactions += successCount;
      this.stats.failedTransactions += failureCount;
      this.stats.batchesProcessed++;
      
      const processingTime = Date.now() - startTime;
      this.stats.totalProcessingTime += processingTime;
      
      console.log(`Batch processed: ${successCount} success, ${failureCount} failed, ${processingTime}ms`);
      
    } catch (error) {
      console.error('Error processing transaction batch:', error);
      this.stats.failedTransactions += this.processingQueue.length;
    } finally {
      this.isProcessing = false;
    }
  }
  
  /**
   * 分类交易
   */
  private categorizeTransactions(transactions: Transaction[]): {
    zeroGasTransactions: Transaction[];
    regularTransactions: Transaction[];
  } {
    const zeroGasTransactions: Transaction[] = [];
    const regularTransactions: Transaction[] = [];
    
    for (const tx of transactions) {
      if (tx.isZeroGas) {
        zeroGasTransactions.push(tx);
      } else {
        regularTransactions.push(tx);
      }
    }
    
    return { zeroGasTransactions, regularTransactions };
  }
  
  /**
   * 处理0-gas费交易
   */
  private async processZeroGasTransactions(transactions: Transaction[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;
    
    // 使用批量处理优化0-gas费交易
    const batches = this.batchProcessor.createOptimalBatches(transactions);
    
    for (const batch of batches) {
      const results = await Promise.allSettled(
        batch.map(tx => this.zeroGasEngine.processZeroGasTransaction(tx))
      );
      
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value.success) {
          success++;
        } else {
          failed++;
        }
      });
    }
    
    return { success, failed };
  }
  
  /**
   * 处理常规交易
   */
  private async processRegularTransactions(transactions: Transaction[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;
    
    // 使用并行工作线程处理常规交易
    const chunks = this.chunkArray(transactions, this.parallelWorkers.length);
    
    const results = await Promise.allSettled(
      chunks.map((chunk, index) => 
        this.parallelWorkers[index]?.processTransactions(chunk) || Promise.resolve({ success: 0, failed: chunk.length })
      )
    );
    
    results.forEach(result => {
      if (result.status === 'fulfilled') {
        success += result.value.success;
        failed += result.value.failed;
      } else {
        failed += transactions.length;
      }
    });
    
    return { success, failed };
  }
  
  /**
   * 将数组分块
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
  
  /**
   * 添加交易到处理队列
   */
  addTransaction(transaction: Transaction): void {
    // 验证交易
    if (!this.validateTransaction(transaction)) {
      console.warn(`Invalid transaction ${transaction.hash} rejected`);
      return;
    }
    
    // 添加到处理队列
    this.processingQueue.push(transaction);
    
    // 如果队列过大，触发紧急处理
    if (this.processingQueue.length > PERFORMANCE_CONFIG.EMERGENCY_THRESHOLD) {
      this.triggerEmergencyProcessing();
    }
  }
  
  /**
   * 批量添加交易
   */
  addTransactions(transactions: Transaction[]): void {
    const validTransactions = transactions.filter(tx => this.validateTransaction(tx));
    this.processingQueue.push(...validTransactions);
    
    console.log(`Added ${validTransactions.length} transactions to processing queue`);
  }
  
  /**
   * 验证交易
   */
  private validateTransaction(transaction: Transaction): boolean {
    // 基本验证
    if (!transaction.hash || !transaction.from || !transaction.to) {
      return false;
    }
    
    // 验证gas限制
    if (transaction.gas > PERFORMANCE_CONFIG.MAX_GAS_LIMIT) {
      return false;
    }
    
    // 验证交易大小
    const txSize = JSON.stringify(transaction).length;
    if (txSize > PERFORMANCE_CONFIG.MAX_TRANSACTION_SIZE) {
      return false;
    }
    
    return true;
  }
  
  /**
   * 触发紧急处理
   */
  private async triggerEmergencyProcessing(): Promise<void> {
    console.warn('Emergency processing triggered due to queue overflow');
    
    // 增加处理频率
    const emergencyInterval = setInterval(async () => {
      if (this.processingQueue.length < PERFORMANCE_CONFIG.NORMAL_THRESHOLD) {
        clearInterval(emergencyInterval);
        console.log('Emergency processing completed');
        return;
      }
      
      if (!this.isProcessing) {
        await this.processTransactionBatch();
      }
    }, 50); // 更频繁的处理
  }
  
  /**
   * 更新性能指标
   */
  private updateMetrics(): void {
    const now = Date.now();
    const timeDiff = now - this.stats.lastThroughputCheck;
    
    // 计算吞吐量
    if (timeDiff >= 1000) {
      const throughput = (this.stats.processedTransactions * 1000) / timeDiff;
      this.stats.recentThroughput.push(throughput);
      
      // 保持最近10秒的吞吐量数据
      if (this.stats.recentThroughput.length > 10) {
        this.stats.recentThroughput.shift();
      }
      
      this.stats.lastThroughputCheck = now;
    }
    
    // 更新指标
    this.metrics.totalProcessed = this.stats.processedTransactions;
    this.metrics.queueSize = this.processingQueue.length;
    this.metrics.errorRate = this.stats.failedTransactions / 
      (this.stats.processedTransactions + this.stats.failedTransactions) * 100;
    
    if (this.stats.processedTransactions > 0) {
      this.metrics.averageLatency = this.stats.totalProcessingTime / this.stats.batchesProcessed;
    }
    
    if (this.stats.recentThroughput.length > 0) {
      this.metrics.throughputPerSecond = this.stats.recentThroughput.reduce((a, b) => a + b, 0) / 
        this.stats.recentThroughput.length;
    }
    
    // 计算并行利用率
    const activeWorkers = this.parallelWorkers.filter(worker => worker.isBusy()).length;
    this.metrics.parallelUtilization = (activeWorkers / this.parallelWorkers.length) * 100;
    
    // 计算批处理效率
    this.metrics.batchEfficiency = this.batchProcessor.getEfficiency();
  }
  
  /**
   * 获取性能指标
   */
  getMetrics() {
    return { ...this.metrics };
  }
  
  /**
   * 获取处理统计
   */
  getStats() {
    return {
      ...this.stats,
      queueSize: this.processingQueue.length,
      isProcessing: this.isProcessing,
      workerCount: this.parallelWorkers.length,
      zeroGasStats: this.zeroGasEngine.getEngineStats()
    };
  }
  
  /**
   * 获取队列状态
   */
  getQueueStatus() {
    return {
      size: this.processingQueue.length,
      capacity: this.runtimeConfig.maxQueueSize || 10000,
      utilizationPercent: (this.processingQueue.length / (this.runtimeConfig.maxQueueSize || 10000)) * 100,
      isEmergency: this.processingQueue.length > this.runtimeConfig.emergencyThreshold,
      estimatedProcessingTime: this.estimateProcessingTime()
    };
  }
  
  /**
   * 估算处理时间
   */
  private estimateProcessingTime(): number {
    if (this.metrics.throughputPerSecond === 0) {
      return 0;
    }
    
    return (this.processingQueue.length / this.metrics.throughputPerSecond) * 1000;
  }
  
  /**
   * 优化处理参数
   */
  optimizeProcessing(): void {
    const metrics = this.getMetrics();
    
    // 根据队列大小调整批处理大小
    if (metrics.queueSize > this.runtimeConfig.emergencyThreshold) {
      this.runtimeConfig.maxBatchSize = Math.min(
        Math.floor(this.runtimeConfig.maxBatchSize * 1.5),
        2000
      );
    } else if (metrics.queueSize < this.runtimeConfig.normalThreshold) {
      this.runtimeConfig.maxBatchSize = Math.max(
        Math.floor(this.runtimeConfig.maxBatchSize * 0.8),
        500
      );
    }
    
    // 根据错误率调整处理策略
    if (metrics.errorRate > 5) {
      console.warn('High error rate detected, reducing batch size');
      this.runtimeConfig.maxBatchSize = Math.max(500, Math.floor(this.runtimeConfig.maxBatchSize * 0.7));
    }
    
    console.log(`Processing optimized: batch size = ${this.runtimeConfig.maxBatchSize}`);
  }

  /**
   * 处理紧急模式
   */
  async handleEmergencyMode(): Promise<void> {
    console.warn('🚨 Entering emergency mode due to system overload');
    
    const queueStatus = this.getQueueStatus();
    
    // 激活紧急处理策略
    if (queueStatus.utilizationPercent > 90) {
      // 1. 增加处理频率
      await this.triggerEmergencyProcessing();
      
      // 2. 启用紧急限流
      this.emergencyThrottle();
      
      // 3. 优化批处理大小
      this.optimizeProcessing();
      
      // 4. 暂停低优先级交易
      this.pauseLowPriorityTransactions();
      
      // 5. 增加工作线程
      this.scaleUpWorkers();
      
      console.log('Emergency mode activated with enhanced processing');
    }
  }

  /**
   * 紧急限流机制
   */
  emergencyThrottle(): void {
    console.warn('🔥 Emergency throttling activated');
    
    // 限制新交易接收
    const originalMaxQueue = this.runtimeConfig.maxQueueSize || 10000;
    this.runtimeConfig.maxQueueSize = Math.floor(originalMaxQueue * 0.7);
    
    // 提高处理优先级阈值
    const emergencyThreshold = this.runtimeConfig.emergencyThreshold || 8000;
    this.runtimeConfig.emergencyThreshold = Math.floor(emergencyThreshold * 0.5);
    
    // 设置限流恢复定时器
    setTimeout(() => {
      this.runtimeConfig.maxQueueSize = originalMaxQueue;
      this.runtimeConfig.emergencyThreshold = emergencyThreshold;
      console.log('Emergency throttling deactivated');
    }, 60000); // 1分钟后恢复
  }

  /**
   * 获取性能指标（详细版本）
   */
  getPerformanceMetrics(): {
    processing: any;
    queue: any;
    workers: any;
    system: any;
    emergency: any;
  } {
    const queueStatus = this.getQueueStatus();
    const currentMetrics = this.getMetrics();
    
    return {
      processing: {
        totalProcessed: currentMetrics.totalProcessed,
        throughputPerSecond: currentMetrics.throughputPerSecond,
        averageLatency: currentMetrics.averageLatency,
        errorRate: currentMetrics.errorRate,
        batchEfficiency: currentMetrics.batchEfficiency,
        isProcessing: this.isProcessing
      },
      queue: {
        currentSize: queueStatus.size,
        capacity: queueStatus.capacity,
        utilizationPercent: queueStatus.utilizationPercent,
        estimatedProcessingTime: queueStatus.estimatedProcessingTime,
        isEmergency: queueStatus.isEmergency
      },
      workers: {
        totalWorkers: this.parallelWorkers.length,
        activeWorkers: this.parallelWorkers.filter(w => w.isBusy()).length,
        utilization: currentMetrics.parallelUtilization,
        efficiency: this.batchProcessor.getEfficiency()
      },
      system: {
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
        timestamp: Date.now()
      },
      emergency: {
        isEmergencyMode: queueStatus.isEmergency,
        throttleActive: queueStatus.utilizationPercent > 90,
        lastEmergencyTrigger: this.getLastEmergencyTrigger()
      }
    };
  }

  /**
   * 暂停低优先级交易
   */
  private pauseLowPriorityTransactions(): void {
    // 移除低gas价格的交易
    const lowPriorityThreshold = BigInt(1000000000); // 1 Gwei
    
    this.processingQueue = this.processingQueue.filter(tx => {
      if (tx.gasPrice < lowPriorityThreshold && !tx.isZeroGas) {
        // 将低优先级交易放回交易池
        this.transactionPool.addTransaction(tx);
        return false;
      }
      return true;
    });
    
    console.log(`Paused ${this.processingQueue.length} low priority transactions`);
  }

  /**
   * 扩展工作线程
   */
  private scaleUpWorkers(): void {
    const currentWorkers = this.parallelWorkers.length;
    const maxWorkers = (PERFORMANCE_CONFIG.PARALLEL_WORKERS || 4) * 2;
    
    if (currentWorkers < maxWorkers) {
      const additionalWorkers = Math.min(2, maxWorkers - currentWorkers);
      
      for (let i = 0; i < additionalWorkers; i++) {
        const worker = new MockWorker(currentWorkers + i);
        this.parallelWorkers.push(worker);
      }
      
      console.log(`Scaled up to ${this.parallelWorkers.length} workers`);
    }
  }

  /**
   * 获取最后一次紧急触发时间
   */
  private getLastEmergencyTrigger(): number {
    // 这里应该存储实际的紧急触发时间
    return Date.now() - 300000; // 模拟5分钟前
  }
}

/**
 * 批处理优化器
 */
class BatchProcessor {
  private efficiency = 0;
  
  /**
   * 创建最优批次
   */
  createOptimalBatches(transactions: Transaction[]): Transaction[][] {
    const batches: Transaction[][] = [];
    const batchSize = PERFORMANCE_CONFIG.OPTIMAL_BATCH_SIZE || 100;
    
    // 按类型分组
    const groups = this.groupTransactionsByType(transactions);
    
    // 为每个组创建批次
    for (const group of groups) {
      for (let i = 0; i < group.length; i += batchSize) {
        batches.push(group.slice(i, i + batchSize));
      }
    }
    
    // 计算效率
    this.efficiency = this.calculateBatchEfficiency(batches, transactions.length);
    
    return batches;
  }
  
  /**
   * 按类型分组交易
   */
  private groupTransactionsByType(transactions: Transaction[]): Transaction[][] {
    const groups: { [key: string]: Transaction[] } = {};
    
    for (const tx of transactions) {
      let type = 'regular';
      
      if (tx.isZeroGas) {
        if (tx.exchangeBatch) {
          type = 'exchange_batch';
        } else if (tx.contractTier) {
          type = `contract_tier_${tx.contractTier}`;
        } else {
          type = 'zero_gas';
        }
      }
      
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(tx);
    }
    
    return Object.values(groups);
  }
  
  /**
   * 计算批处理效率
   */
  private calculateBatchEfficiency(batches: Transaction[][], totalTransactions: number): number {
    if (batches.length === 0) return 0;
    
    const averageBatchSize = totalTransactions / batches.length;
    const optimalBatchSize = PERFORMANCE_CONFIG.OPTIMAL_BATCH_SIZE || 100;
    
    return Math.min(averageBatchSize / optimalBatchSize, 1) * 100;
  }
  
  /**
   * 获取效率
   */
  getEfficiency(): number {
    return this.efficiency;
  }
}

/**
 * 模拟工作线程
 */
class MockWorker {
  private id: number;
  private busy = false;
  
  constructor(id: number) {
    this.id = id;
  }
  
  /**
   * 处理交易
   */
  async processTransactions(transactions: Transaction[]): Promise<{ success: number; failed: number }> {
    this.busy = true;
    
    try {
      // 模拟处理时间
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
      
      // 模拟处理结果（95%成功率）
      const success = Math.floor(transactions.length * 0.95);
      const failed = transactions.length - success;
      
      return { success, failed };
    } finally {
      this.busy = false;
    }
  }
  
  /**
   * 检查是否忙碌
   */
  isBusy(): boolean {
    return this.busy;
  }
}

// 模拟Worker类
class Worker {
  constructor(id: number) {
    // 模拟实现
  }
  
  async processTransactions(transactions: Transaction[]): Promise<{ success: number; failed: number }> {
    return { success: 0, failed: 0 };
  }
  
  isBusy(): boolean {
    return false;
  }
}