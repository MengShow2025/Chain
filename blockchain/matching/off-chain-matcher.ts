import { EventEmitter } from 'events';
import { Order, MatchResult, BalanceDiff, MatchingEngine } from './matching-engine.js';
import { EnhancedMicroBatchProcessor, MicroBatch, BatchStatus, BatchResult } from '../core/enhanced-micro-batch-processor.js';
import { MessageBus, Message, MessagePriority } from '../messaging/message-bus.js';
import { casClient, BatchData } from '../../shared/da/cas-client.js';
import { computeMerkleRoot } from '../../shared/utils/merkle.js';
import { BatchCommit } from '../../shared/types/blockchain.js';

/**
 * 链下撮合引擎配置
 */
export interface OffChainMatcherConfig {
  // 微批处理配置
  batchWindowMs: number;
  maxBatchSize: number;
  maxMemoryMB: number;
  
  // 撮合引擎配置
  maxOrdersPerBatch: number;
  maxMatchesPerBatch: number;
  
  // 性能配置
  enableParallelProcessing: boolean;
  workerThreads: number;
  
  // 存储配置
  enablePersistence: boolean;
  enableCaching: boolean;
}

/**
 * 撮合统计信息
 */
export interface MatchingStats {
  totalOrders: number;
  totalMatches: number;
  totalBatches: number;
  avgBatchSize: number;
  avgProcessingTime: number;
  throughputTPS: number;
  memoryUsage: number;
  successRate: number;
}

/**
 * 链下撮合引擎
 * 集成微批处理器和撮合引擎，实现高性能链下订单撮合
 */
export class OffChainMatcher extends EventEmitter {
  private config: OffChainMatcherConfig;
  private microBatchProcessor: EnhancedMicroBatchProcessor;
  private matchingEngine: MatchingEngine;
  private messageBus: MessageBus;
  
  private isRunning: boolean = false;
  private stats: MatchingStats;
  private processingQueue: MicroBatch[] = [];
  private completedBatches: BatchResult[] = [];
  
  // 性能监控
  private startTime: number = 0;
  private lastStatsUpdate: number = 0;
  private orderCount: number = 0;
  private matchCount: number = 0;
  private batchCount: number = 0;

  constructor(config: OffChainMatcherConfig, messageBus: MessageBus) {
    super();
    this.config = config;
    this.messageBus = messageBus;
    
    // 初始化统计信息
    this.stats = {
      totalOrders: 0,
      totalMatches: 0,
      totalBatches: 0,
      avgBatchSize: 0,
      avgProcessingTime: 0,
      throughputTPS: 0,
      memoryUsage: 0,
      successRate: 0
    };
    
    // 初始化微批处理器
    this.microBatchProcessor = new EnhancedMicroBatchProcessor({
      windowSizeMs: config.batchWindowMs,
      maxBatchSize: config.maxBatchSize,
      maxMemoryMB: config.maxMemoryMB,
      priorityEnabled: true,
      persistenceEnabled: config.enablePersistence,
      adaptiveWindowSize: true,
      minWindowSize: Math.max(50, config.batchWindowMs / 2),
      maxWindowSize: Math.min(200, config.batchWindowMs * 2)
    }, messageBus);
    
    // 初始化撮合引擎
    this.matchingEngine = new MatchingEngine();
    
    this.setupEventHandlers();
    console.log('OffChainMatcher initialized with config:', config);
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    // 监听微批处理器事件
    this.microBatchProcessor.on('batchReady', this.handleBatchReady.bind(this));
    this.microBatchProcessor.on('batchCompleted', this.handleBatchCompleted.bind(this));
    this.microBatchProcessor.on('batchFailed', this.handleBatchFailed.bind(this));
    
    // 订阅消息总线主题
    this.messageBus.subscribe({
      topic: 'orderReceived',
      handler: {
        handle: async (message) => {
          await this.handleOrderReceived(message);
        }
      }
    });
    
    this.messageBus.subscribe({
      topic: 'cancelOrder',
      handler: {
        handle: async (message) => {
          await this.handleCancelOrder(message);
        }
      }
    });
  }

  /**
   * 启动链下撮合引擎
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('OffChainMatcher is already running');
      return;
    }

    try {
      this.isRunning = true;
      this.startTime = Date.now();
      
      // 启动微批处理器
      await this.microBatchProcessor.start();
      
      // 启动撮合引擎批次处理（停止默认处理，使用我们的控制）
      this.matchingEngine.stopBatchProcessing();
      
      // 启动统计更新定时器
      this.startStatsUpdater();
      
      this.emit('started');
      console.log('OffChainMatcher started successfully');
      
    } catch (error) {
      this.isRunning = false;
      console.error('Failed to start OffChainMatcher:', error);
      throw error;
    }
  }

  /**
   * 停止链下撮合引擎
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      this.isRunning = false;
      
      // 停止微批处理器
      await this.microBatchProcessor.stop();
      
      // 清理撮合引擎
      this.matchingEngine.cleanup();
      
      this.emit('stopped');
      console.log('OffChainMatcher stopped successfully');
      
    } catch (error) {
      console.error('Failed to stop OffChainMatcher:', error);
      throw error;
    }
  }

  /**
   * 处理接收到的订单
   */
  private async handleOrderReceived(message: Message): Promise<void> {
    try {
      const order = message.payload as Order;
      
      console.log(`Received order: ${order.id} (${order.side} ${order.quantity} ${order.symbol})`);
      
      // 验证订单
      this.validateOrder(order);
      
      // 添加到微批处理器
      await this.microBatchProcessor.addOrder(order);
      
      this.orderCount++;
      this.emit('orderAdded', order);
      
    } catch (error) {
      console.error('Failed to handle order:', error);
      this.emit('orderRejected', { order: message.payload, error: error.message });
    }
  }

  /**
   * 处理订单取消
   */
  private async handleCancelOrder(message: Message): Promise<void> {
    try {
      const { orderId, account } = message.payload;
      
      // 从撮合引擎取消订单
      await this.matchingEngine.cancelOrder(orderId, account);
      
      this.emit('orderCancelled', { orderId, account });
      
    } catch (error) {
      console.error('Failed to cancel order:', error);
      this.emit('orderCancelFailed', { orderId: message.payload.orderId, error: error.message });
    }
  }

  /**
   * 处理批次就绪事件
   */
  private async handleBatchReady(batch: MicroBatch): Promise<void> {
    try {
      console.log(`Processing batch ${batch.id} with ${batch.orders.length} orders`);
      
      // 将批次添加到处理队列
      this.processingQueue.push(batch);
      
      // 处理批次
      await this.processBatch(batch);
      
    } catch (error) {
      console.error('Failed to handle batch ready:', error);
      batch.status = BatchStatus.FAILED;
    }
  }

  /**
   * 处理批次完成事件
   */
  private handleBatchCompleted(result: BatchResult): void {
    this.completedBatches.push(result);
    this.batchCount++;
    this.matchCount += result.matches.length;
    
    console.log(`Stats updated: totalOrders=${this.orderCount}, totalBatches=${this.batchCount}, totalMatches=${this.matchCount}`);
    
    // 立即更新统计信息
    this.updateStats();
    
    // 发布BatchResult到消息总线，供BatchCommit生成器使用
    if (this.messageBus) {
      this.messageBus.publish('batch.result', result, 'NORMAL');
    }
    
    // 保持历史记录在合理范围内
    if (this.completedBatches.length > 1000) {
      this.completedBatches.shift();
    }
    
    this.emit('batchCompleted', result);
    console.log(`Batch ${result.batchId} completed with ${result.matches.length} matches`);
  }

  /**
   * 处理批次失败事件
   */
  private handleBatchFailed(result: BatchResult): void {
    this.emit('batchFailed', result);
    console.error(`Batch ${result.batchId} failed:`, result.error);
  }

  /**
   * 处理单个批次
   */
  private async processBatch(batch: MicroBatch): Promise<void> {
    const startTime = Date.now();
    batch.status = BatchStatus.PROCESSING;

    try {
      // 清空撮合引擎的结果缓存
      this.matchingEngine.cleanup();
      
      // 将订单添加到撮合引擎
      const addOrderPromises = batch.orders.map(order => 
        this.matchingEngine.addOrder(order)
      );
      await Promise.all(addOrderPromises);
      
      // 手动触发一次批次处理
      await this.triggerMatching(batch);
      
      // 生成批次结果
      const result = await this.generateBatchResult(batch, startTime);
      
      batch.status = BatchStatus.COMPLETED;
      
      // 直接调用批次完成处理器来更新统计信息
      this.handleBatchCompleted(result);
      
      this.emit('batchCompleted', result);
      
    } catch (error) {
      batch.status = BatchStatus.FAILED;
      const result: BatchResult = {
        batchId: batch.id,
        success: false,
        matches: [],
        balanceDiffs: [],
        processingTime: Date.now() - startTime,
        error: error.message
      };
      
      // 直接调用批次失败处理器
      this.handleBatchFailed(result);
      
      this.emit('batchFailed', result);
      throw error;
    }
  }

  /**
   * 触发撮合处理
   */
  private async triggerMatching(batch: MicroBatch): Promise<void> {
    // 手动触发撮合引擎处理待处理订单
    await this.matchingEngine.processPendingOrders();
    
    // 等待一小段时间确保处理完成
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  /**
   * 生成批次结果
   */
  private async generateBatchResult(batch: MicroBatch, startTime: number): Promise<BatchResult> {
    const processingTime = Date.now() - startTime;
    
    // 获取撮合引擎的实际批次结果
    const batchResults = this.matchingEngine.getCurrentBatchResults();
    
    // 生成批次数据
    const batchData: BatchData = {
      orders: batch.orders,
      matches: batchResults.matches,
      balanceDiffs: batchResults.balanceDiffs,
      auditLog: batchResults.auditLogs
    };
    
    // 计算Merkle根
    const ordersRoot = computeMerkleRoot(batch.orders.map(o => JSON.stringify(o)));
    const matchesRoot = computeMerkleRoot(batchResults.matches.map(m => JSON.stringify(m)));
    const balanceDiffsRoot = computeMerkleRoot(batchResults.balanceDiffs.map(d => JSON.stringify(d)));
    const auditLogRoot = computeMerkleRoot(batchResults.auditLogs.map(l => JSON.stringify(l)));
    
    // 生成CID并存储到CAS
    const serialized = new TextEncoder().encode(JSON.stringify(batchData));
    const cid = await casClient.store(serialized, { 
      mimeType: 'application/json',
      tags: ['batch-result', 'off-chain-matcher']
    });
    
    const result: BatchResult = {
      batchId: batch.id,
      success: true,
      orders: batch.orders,
      matches: batchResults.matches,
      balanceDiffs: batchResults.balanceDiffs,
      auditLog: batchResults.auditLogs,
      processingTime,
      cid: cid.toString(),
      ordersRoot,
      matchesRoot,
      balanceDiffsRoot,
      auditLogRoot
    };
    
    // 清空撮合引擎的当前批次结果，为下一个批次做准备
    this.matchingEngine.clearCurrentBatchResults();
    
    console.log(`BatchResult generated: ${batch.id}, matches: ${batchResults.matches.length}, balanceDiffs: ${batchResults.balanceDiffs.length}`);
    
    return result;
  }

  /**
   * 验证订单
   */
  private validateOrder(order: Order): void {
    if (!order.id || !order.symbol || !order.side || !order.type || 
        !order.price || !order.quantity || !order.account) {
      throw new Error('Invalid order: missing required fields');
    }
    
    if (order.side !== 'buy' && order.side !== 'sell') {
      throw new Error('Invalid order side');
    }
    
    if (order.type !== 'market' && order.type !== 'limit') {
      throw new Error('Invalid order type');
    }
    
    if (parseFloat(order.price) <= 0 || parseFloat(order.quantity) <= 0) {
      throw new Error('Invalid order: price and quantity must be positive');
    }
  }

  /**
   * 启动统计更新器
   */
  private startStatsUpdater(): void {
    setInterval(() => {
      this.updateStats();
    }, 5000); // 每5秒更新一次统计信息
  }

  /**
   * 更新统计信息
   */
  private updateStats(): void {
    const now = Date.now();
    const elapsed = (now - this.startTime) / 1000; // 秒
    
    this.stats = {
      totalOrders: this.orderCount,
      totalMatches: this.matchCount,
      totalBatches: this.batchCount,
      avgBatchSize: this.batchCount > 0 ? this.orderCount / this.batchCount : 0,
      avgProcessingTime: this.calculateAvgProcessingTime(),
      throughputTPS: elapsed > 0 ? this.orderCount / elapsed : 0,
      memoryUsage: this.getMemoryUsage(),
      successRate: this.calculateSuccessRate()
    };
    
    this.lastStatsUpdate = now;
    this.emit('statsUpdated', this.stats);
  }

  /**
   * 计算平均处理时间
   */
  private calculateAvgProcessingTime(): number {
    if (this.completedBatches.length === 0) return 0;
    
    const totalTime = this.completedBatches.reduce((sum, batch) => sum + batch.processingTime, 0);
    return totalTime / this.completedBatches.length;
  }

  /**
   * 获取内存使用情况
   */
  private getMemoryUsage(): number {
    const used = process.memoryUsage();
    return Math.round(used.heapUsed / 1024 / 1024 * 100) / 100; // MB
  }

  /**
   * 计算成功率
   */
  private calculateSuccessRate(): number {
    if (this.completedBatches.length === 0) return 100;
    
    const successfulBatches = this.completedBatches.filter(batch => batch.success).length;
    return (successfulBatches / this.completedBatches.length) * 100;
  }

  /**
   * 获取统计信息
   */
  getStats(): MatchingStats {
    return { ...this.stats };
  }

  /**
   * 获取处理队列状态
   */
  getQueueStatus(): { pending: number, processing: number, completed: number } {
    const pending = this.processingQueue.filter(b => b.status === BatchStatus.READY).length;
    const processing = this.processingQueue.filter(b => b.status === BatchStatus.PROCESSING).length;
    const completed = this.completedBatches.length;
    
    return { pending, processing, completed };
  }

  /**
   * 获取最近的批次结果
   */
  getRecentBatches(limit: number = 10): BatchResult[] {
    return this.completedBatches.slice(-limit);
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    await this.stop();
    this.processingQueue = [];
    this.completedBatches = [];
    this.removeAllListeners();
  }
}