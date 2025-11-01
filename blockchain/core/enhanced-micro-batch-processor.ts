import { EventEmitter } from 'events';
import { Order, MatchResult, BalanceDiff } from '../matching/matching-engine.js';
import { MessageBus, Message, MessagePriority } from '../messaging/message-bus.js';
import { casClient, BatchData } from '../../shared/da/cas-client.js';
import { computeMerkleRoot } from '../../shared/utils/merkle.js';

/**
 * 微批次接口
 */
export interface MicroBatch {
  id: string;
  timestamp: number;
  orders: Order[];
  status: BatchStatus;
  metadata: BatchMetadata;
  windowStart: number;
  windowEnd: number;
}

/**
 * 批次元数据
 */
export interface BatchMetadata {
  windowStart: number;
  windowEnd: number;
  orderCount: number;
  totalVolume: bigint;
  priority: BatchPriority;
  cid?: string;
  merkleRoot?: string;
}

/**
 * 批次状态枚举
 */
export enum BatchStatus {
  COLLECTING = 'collecting',
  READY = 'ready',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

/**
 * 批次优先级枚举
 */
export enum BatchPriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  URGENT = 4
}

/**
 * 时间窗口接口
 */
export interface TimeWindow {
  id: string;
  startTime: number;
  endTime: number;
  orders: Order[];
  priority: BatchPriority;
}

/**
 * 批次处理器配置
 */
export interface BatchProcessorConfig {
  windowSizeMs: number;
  maxBatchSize: number;
  maxMemoryMB: number;
  priorityEnabled: boolean;
  persistenceEnabled: boolean;
  adaptiveWindowSize: boolean;
  minWindowSize: number;
  maxWindowSize: number;
}

/**
 * 批次处理器指标
 */
export interface BatchProcessorMetrics {
  totalBatches: number;
  avgBatchSize: number;
  avgProcessingTime: number;
  successRate: number;
  memoryUsage: number;
  cpuUsage: number;
  currentWindowSize: number;
  queueDepth: number;
}

/**
 * 批次结果接口
 */
export interface BatchResult {
  batchId: string;
  success: boolean;
  matches: MatchResult[];
  balanceDiffs: BalanceDiff[];
  processingTime: number;
  error?: string;
  cid?: string;
  ordersRoot?: string;
  matchesRoot?: string;
  balanceDiffsRoot?: string;
  auditLogRoot?: string;
  orders?: Order[];
  auditLog?: any[];
}

/**
 * 时间窗口管理器
 */
class TimeWindowManager {
  private windowSize: number;
  private minWindowSize: number;
  private maxWindowSize: number;
  private adaptiveEnabled: boolean;
  private currentWindow: TimeWindow | null = null;
  private windowHistory: TimeWindow[] = [];
  private maxHistorySize = 100;

  constructor(config: BatchProcessorConfig) {
    this.windowSize = config.windowSizeMs;
    this.minWindowSize = config.minWindowSize;
    this.maxWindowSize = config.maxWindowSize;
    this.adaptiveEnabled = config.adaptiveWindowSize;
  }

  startNewWindow(): TimeWindow {
    const now = Date.now();
    const window: TimeWindow = {
      id: this.generateWindowId(),
      startTime: now,
      endTime: now + this.windowSize,
      orders: [],
      priority: BatchPriority.NORMAL
    };

    this.currentWindow = window;
    return window;
  }

  shouldCloseWindow(window: TimeWindow, maxBatchSize: number): boolean {
    const now = Date.now();
    return now >= window.endTime || window.orders.length >= maxBatchSize;
  }

  closeWindow(window: TimeWindow): void {
    if (this.windowHistory.length >= this.maxHistorySize) {
      this.windowHistory.shift();
    }
    this.windowHistory.push(window);
    this.currentWindow = null;

    // 自适应窗口大小调整
    if (this.adaptiveEnabled) {
      this.adjustWindowSize();
    }
  }

  getCurrentWindow(): TimeWindow | null {
    return this.currentWindow;
  }

  private adjustWindowSize(): void {
    if (this.windowHistory.length < 5) return;

    const recentWindows = this.windowHistory.slice(-5);
    const avgOrderCount = recentWindows.reduce((sum, w) => sum + w.orders.length, 0) / recentWindows.length;
    const avgDuration = recentWindows.reduce((sum, w) => sum + (w.endTime - w.startTime), 0) / recentWindows.length;

    // 根据订单密度调整窗口大小
    if (avgOrderCount > 800 && this.windowSize > this.minWindowSize) {
      this.windowSize = Math.max(this.minWindowSize, this.windowSize - 10);
    } else if (avgOrderCount < 200 && this.windowSize < this.maxWindowSize) {
      this.windowSize = Math.min(this.maxWindowSize, this.windowSize + 10);
    }
  }

  private generateWindowId(): string {
    return `window_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getWindowSize(): number {
    return this.windowSize;
  }
}

/**
 * 动态批次大小调整器
 */
class DynamicBatchSizer {
  private baseSize: number = 1000;
  private maxSize: number = 10000;
  private loadFactor: number = 1.0;
  private performanceHistory: number[] = [];

  calculateOptimalSize(currentLoad: number, avgProcessingTime: number): number {
    this.performanceHistory.push(avgProcessingTime);
    if (this.performanceHistory.length > 10) {
      this.performanceHistory.shift();
    }

    const adjustedSize = this.baseSize * this.loadFactor;

    // 根据系统负载调整
    if (currentLoad > 0.8) {
      return Math.max(adjustedSize * 0.7, 100);
    } else if (currentLoad < 0.3) {
      return Math.min(adjustedSize * 1.3, this.maxSize);
    }

    // 根据处理时间调整
    if (this.performanceHistory.length >= 5) {
      const avgTime = this.performanceHistory.reduce((a, b) => a + b, 0) / this.performanceHistory.length;
      if (avgTime > 100) { // 如果平均处理时间超过100ms
        return Math.max(adjustedSize * 0.8, 100);
      }
    }

    return Math.min(adjustedSize, this.maxSize);
  }

  updateLoadFactor(successRate: number): void {
    if (successRate > 0.95) {
      this.loadFactor = Math.min(1.2, this.loadFactor + 0.1);
    } else if (successRate < 0.85) {
      this.loadFactor = Math.max(0.5, this.loadFactor - 0.1);
    }
  }
}

/**
 * 增强版微批处理器
 */
export class EnhancedMicroBatchProcessor extends EventEmitter {
  private config: BatchProcessorConfig;
  private windowManager: TimeWindowManager;
  private batchSizer: DynamicBatchSizer;
  private messageBus: MessageBus;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private processingTimer: NodeJS.Timeout | null = null;
  private batchHistory: MicroBatch[] = [];
  private metrics: BatchProcessorMetrics;
  private memoryMonitor: NodeJS.Timeout | null = null;

  constructor(config: BatchProcessorConfig, messageBus: MessageBus) {
    super();
    this.config = config;
    this.windowManager = new TimeWindowManager(config);
    this.batchSizer = new DynamicBatchSizer();
    this.messageBus = messageBus;
    
    this.metrics = {
      totalBatches: 0,
      avgBatchSize: 0,
      avgProcessingTime: 0,
      successRate: 1.0,
      memoryUsage: 0,
      cpuUsage: 0,
      currentWindowSize: config.windowSizeMs,
      queueDepth: 0
    };

    console.log('EnhancedMicroBatchProcessor initialized');
  }

  /**
   * 启动处理器
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    this.isPaused = false;
    
    // 启动处理循环
    this.processingTimer = setInterval(() => {
      if (!this.isPaused) {
        this.processCurrentWindow().catch(error => {
          console.error('Window processing error:', error);
          this.emit('error', error);
        });
      }
    }, 10); // 10ms检查间隔

    // 启动内存监控
    this.startMemoryMonitoring();

    // 订阅消息总线事件
    this.setupMessageBusSubscriptions();

    console.log('EnhancedMicroBatchProcessor started');
    this.emit('started');
  }

  /**
   * 停止处理器
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = null;
    }

    if (this.memoryMonitor) {
      clearInterval(this.memoryMonitor);
      this.memoryMonitor = null;
    }

    // 处理剩余的窗口
    const currentWindow = this.windowManager.getCurrentWindow();
    if (currentWindow && currentWindow.orders.length > 0) {
      await this.processBatch(this.createBatchFromWindow(currentWindow));
    }

    console.log('EnhancedMicroBatchProcessor stopped');
    this.emit('stopped');
  }

  /**
   * 暂停处理器
   */
  async pause(): Promise<void> {
    this.isPaused = true;
    console.log('EnhancedMicroBatchProcessor paused');
    this.emit('paused');
  }

  /**
   * 恢复处理器
   */
  async resume(): Promise<void> {
    this.isPaused = false;
    console.log('EnhancedMicroBatchProcessor resumed');
    this.emit('resumed');
  }

  /**
   * 添加订单到当前窗口
   */
  async addOrder(order: Order): Promise<void> {
    if (!this.isRunning || this.isPaused) {
      throw new Error('Processor is not running or is paused');
    }

    let currentWindow = this.windowManager.getCurrentWindow();
    
    // 如果没有当前窗口或窗口应该关闭，创建新窗口
    if (!currentWindow || this.windowManager.shouldCloseWindow(currentWindow, this.config.maxBatchSize)) {
      if (currentWindow) {
        // 处理当前窗口
        await this.processBatch(this.createBatchFromWindow(currentWindow));
        this.windowManager.closeWindow(currentWindow);
      }
      currentWindow = this.windowManager.startNewWindow();
    }

    // 添加订单到当前窗口
    currentWindow.orders.push(order);
    
    // 根据订单类型调整窗口优先级
    if (order.type === 'market' || parseFloat(order.quantity) > 10000) {
      currentWindow.priority = Math.max(currentWindow.priority, BatchPriority.HIGH);
    }

    this.emit('orderAdded', { orderId: order.id, windowId: currentWindow.id });
  }

  /**
   * 处理当前窗口
   */
  private async processCurrentWindow(): Promise<void> {
    const currentWindow = this.windowManager.getCurrentWindow();
    if (!currentWindow) return;

    if (this.windowManager.shouldCloseWindow(currentWindow, this.config.maxBatchSize)) {
      const batch = this.createBatchFromWindow(currentWindow);
      await this.processBatch(batch);
      this.windowManager.closeWindow(currentWindow);
    }
  }

  /**
   * 从窗口创建批次
   */
  private createBatchFromWindow(window: TimeWindow): MicroBatch {
    const totalVolume = window.orders.reduce((sum, order) => {
      return sum + BigInt(Math.floor(parseFloat(order.quantity) * parseFloat(order.price)));
    }, BigInt(0));

    return {
      id: `batch_${window.id}`,
      timestamp: Date.now(),
      orders: [...window.orders],
      status: BatchStatus.READY,
      windowStart: window.startTime,
      windowEnd: window.endTime,
      metadata: {
        windowStart: window.startTime,
        windowEnd: window.endTime,
        orderCount: window.orders.length,
        totalVolume,
        priority: window.priority
      }
    };
  }

  /**
   * 处理批次
   */
  async processBatch(batch: MicroBatch): Promise<BatchResult> {
    const startTime = Date.now();
    batch.status = BatchStatus.PROCESSING;

    try {
      // 生成CID和Merkle根
      const batchData: BatchData = {
        orders: batch.orders,
        matches: [],
        balanceDiffs: [],
        auditLog: []
      };

      const cid = await this.generateCID(batchData);
      const merkleRoot = computeMerkleRoot(batch.orders.map(o => JSON.stringify(o)));
      
      batch.metadata.cid = cid;
      batch.metadata.merkleRoot = merkleRoot;

      // 发出batchReady事件
      this.emit('batchReady', batch);

      // 发布批次到消息总线
      await this.messageBus.publish('batch.ready', batch, {
        type: 'BATCH_READY',
        priority: this.mapBatchPriorityToMessagePriority(batch.metadata.priority)
      });

      batch.status = BatchStatus.COMPLETED;
      const processingTime = Date.now() - startTime;

      // 更新指标
      this.updateMetrics(batch, processingTime, true);

      // 添加到历史记录
      this.addToHistory(batch);

      const result: BatchResult = {
        batchId: batch.id,
        success: true,
        matches: [],
        balanceDiffs: [],
        processingTime,
        cid
      };

      this.emit('batchProcessed', result);
      return result;

    } catch (error) {
      batch.status = BatchStatus.FAILED;
      const processingTime = Date.now() - startTime;
      
      this.updateMetrics(batch, processingTime, false);

      const result: BatchResult = {
        batchId: batch.id,
        success: false,
        matches: [],
        balanceDiffs: [],
        processingTime,
        error: error instanceof Error ? error.message : String(error)
      };

      this.emit('batchFailed', result);
      return result;
    }
  }

  /**
   * 生成CID
   */
  private async generateCID(batchData: BatchData): Promise<string> {
    const serialized = new TextEncoder().encode(JSON.stringify(batchData));
    const cid = await casClient.store(serialized, { 
      mimeType: 'application/json',
      tags: ['batch-data', 'micro-batch']
    });
    return cid.toString();
  }

  /**
   * 映射批次优先级到消息优先级
   */
  private mapBatchPriorityToMessagePriority(batchPriority: BatchPriority): MessagePriority {
    switch (batchPriority) {
      case BatchPriority.LOW: return MessagePriority.LOW;
      case BatchPriority.NORMAL: return MessagePriority.NORMAL;
      case BatchPriority.HIGH: return MessagePriority.HIGH;
      case BatchPriority.URGENT: return MessagePriority.CRITICAL;
      default: return MessagePriority.NORMAL;
    }
  }

  /**
   * 更新指标
   */
  private updateMetrics(batch: MicroBatch, processingTime: number, success: boolean): void {
    this.metrics.totalBatches++;
    this.metrics.avgBatchSize = (this.metrics.avgBatchSize * (this.metrics.totalBatches - 1) + batch.orders.length) / this.metrics.totalBatches;
    this.metrics.avgProcessingTime = (this.metrics.avgProcessingTime * (this.metrics.totalBatches - 1) + processingTime) / this.metrics.totalBatches;
    
    const successCount = Math.floor(this.metrics.successRate * (this.metrics.totalBatches - 1)) + (success ? 1 : 0);
    this.metrics.successRate = successCount / this.metrics.totalBatches;
    
    this.metrics.currentWindowSize = this.windowManager.getWindowSize();
    
    // 更新动态批次大小调整器
    this.batchSizer.updateLoadFactor(this.metrics.successRate);
  }

  /**
   * 添加到历史记录
   */
  private addToHistory(batch: MicroBatch): void {
    this.batchHistory.push(batch);
    if (this.batchHistory.length > 1000) {
      this.batchHistory.shift();
    }
  }

  /**
   * 启动内存监控
   */
  private startMemoryMonitoring(): void {
    this.memoryMonitor = setInterval(() => {
      const memUsage = process.memoryUsage();
      this.metrics.memoryUsage = memUsage.heapUsed / 1024 / 1024; // MB
      
      if (this.metrics.memoryUsage > this.config.maxMemoryMB * 0.9) {
        console.warn(`High memory usage: ${this.metrics.memoryUsage.toFixed(2)}MB`);
        this.emit('highMemoryUsage', this.metrics.memoryUsage);
      }
    }, 5000);
  }

  /**
   * 设置消息总线订阅
   */
  private setupMessageBusSubscriptions(): void {
    this.messageBus.subscribe({
      topic: 'batch.result',
      handler: {
        handle: async (message: Message) => {
          const result = message.payload as BatchResult;
          this.emit('batchResult', result);
        }
      }
    });
  }

  /**
   * 获取当前批次
   */
  getCurrentBatch(): MicroBatch | null {
    const currentWindow = this.windowManager.getCurrentWindow();
    return currentWindow ? this.createBatchFromWindow(currentWindow) : null;
  }

  /**
   * 获取批次历史
   */
  getBatchHistory(limit: number = 10): MicroBatch[] {
    return this.batchHistory.slice(-limit);
  }

  /**
   * 获取指标
   */
  getMetrics(): BatchProcessorMetrics {
    return { ...this.metrics };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<BatchProcessorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.windowManager = new TimeWindowManager(this.config);
    console.log('Configuration updated:', newConfig);
    this.emit('configUpdated', this.config);
  }

  /**
   * 获取配置
   */
  getConfig(): BatchProcessorConfig {
    return { ...this.config };
  }
}