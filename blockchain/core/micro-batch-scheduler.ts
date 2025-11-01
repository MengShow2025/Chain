import { Transaction } from '../../shared/types/blockchain.js';
import { SEQUENCER_CONFIG, PERFORMANCE_CONFIG } from '../../shared/constants/blockchain.js';
import { TransactionPool } from './transaction-pool.js';
import { HighPerformanceProcessor } from './high-performance-processor.js';

/**
 * 微批调度器
 * 周期性从交易池抓取交易，以微批次灌入高性能处理器队列
 */
export class MicroBatchScheduler {
  private readonly intervalMs: number;
  private readonly maxOrdersPerBatch: number;
  private readonly maxPendingBatches: number;
  private readonly maxGasLimit: bigint;

  private timer: NodeJS.Timeout | null = null;
  private pendingBatchCount: number = 0;
  private running: boolean = false;

  constructor(
    private readonly pool: TransactionPool,
    private readonly processor: HighPerformanceProcessor
  ) {
    this.intervalMs = SEQUENCER_CONFIG.MICROBATCH_INTERVAL_MS || 100;
    this.maxOrdersPerBatch = SEQUENCER_CONFIG.MAX_ORDERS_PER_BATCH || 250;
    this.maxPendingBatches = SEQUENCER_CONFIG.MAX_PENDING_BATCHES || 50;
    this.maxGasLimit = PERFORMANCE_CONFIG.MAX_GAS_LIMIT || BigInt(30_000_000);
  }

  /** 启动微批调度 */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.timer = setInterval(() => this.scheduleOnce(), this.intervalMs);
    console.log(
      `MicroBatchScheduler started: interval=${this.intervalMs}ms, maxOrders=${this.maxOrdersPerBatch}`
    );
  }

  /** 停止微批调度 */
  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.pendingBatchCount = 0;
    console.log('MicroBatchScheduler stopped');
  }

  /** 单次调度循环 */
  private scheduleOnce(): void {
    // 基于处理队列状态进行背压控制
    const queue = this.processor.getQueueStatus();
    if (queue.isEmergency || queue.utilizationPercent >= 90) {
      // 队列过载时跳过本次调度
      return;
    }

    if (this.pendingBatchCount >= this.maxPendingBatches) {
      // 待处理批次过多，避免持续灌入
      return;
    }

    // 从交易池抓取微批，优先0-gas交易，随后按gasPrice排序的常规交易
    const batch: Transaction[] = this.pool.getTransactionsForBlock(
      this.maxGasLimit,
      this.maxOrdersPerBatch
    );

    if (batch.length === 0) {
      return;
    }

    // 灌入高性能处理器队列，由其内部并行工作线程处理
    this.processor.addTransactions(batch);
    this.pendingBatchCount++;

    // 简单的递减：当队列不在处理或批次完成时，处理器统计会更新；此处以队列估算递减
    // 为避免依赖内部事件，这里根据队列估算：若队列利用率下降则尝试递减
    const postQueue = this.processor.getQueueStatus();
    if (postQueue.utilizationPercent < 70 && this.pendingBatchCount > 0) {
      this.pendingBatchCount = Math.max(0, this.pendingBatchCount - 1);
    }

    // 可选：输出轻量日志用于观测
    console.log(`MicroBatch scheduled: size=${batch.length}, pendingBatches=${this.pendingBatchCount}`);
  }

  /** 获取调度器状态 */
  getStatus() {
    return {
      running: this.running,
      intervalMs: this.intervalMs,
      maxOrdersPerBatch: this.maxOrdersPerBatch,
      maxPendingBatches: this.maxPendingBatches,
      pendingBatchCount: this.pendingBatchCount
    };
  }
}