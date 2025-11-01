import { EventEmitter } from 'events';
import { BatchCommit, Block, Transaction } from '../../shared/types/blockchain.js';
import { MessageBus, Message, MessagePriority } from '../messaging/message-bus.js';
import { casClient, BatchData } from '../../shared/da/cas-client.js';
import { computeMerkleRoot } from '../../shared/utils/merkle.js';
import { Order, MatchResult, BalanceDiff } from '../matching/matching-engine.js';

/**
 * 验证层级枚举
 */
export enum ValidationLayer {
  L0_DATA_INTEGRITY = 'L0_DATA_INTEGRITY',
  L1_MATCHING_LOGIC = 'L1_MATCHING_LOGIC', 
  L2_STATE_TRANSITION = 'L2_STATE_TRANSITION',
  L3_FINAL_CONSISTENCY = 'L3_FINAL_CONSISTENCY'
}

/**
 * 验证结果接口
 */
export interface ValidationResult {
  layer: ValidationLayer;
  batchId: string;
  success: boolean;
  timestamp: number;
  processingTime: number;
  error?: string;
  details?: any;
}

/**
 * 并行验证器配置
 */
export interface ParallelValidatorConfig {
  // 并发配置
  maxConcurrentDownloads: number;
  maxConcurrentValidations: number;
  downloadTimeout: number;
  validationTimeout: number;
  
  // 重放配置
  enableDeterministicReplay: boolean;
  replayBufferSize: number;
  
  // 挑战窗口配置
  challengeWindowMs: number;
  challengeEnabled: boolean;
  
  // 性能配置
  enableCaching: boolean;
  cacheSize: number;
  enableMetrics: boolean;
}

/**
 * 批次验证状态
 */
export interface BatchValidationState {
  batchId: string;
  batchCommit: BatchCommit;
  downloadStartTime: number;
  downloadEndTime?: number;
  validationStartTime?: number;
  validationEndTime?: number;
  currentLayer: ValidationLayer;
  layerResults: Map<ValidationLayer, ValidationResult>;
  challengeWindowStart?: number;
  isInChallengeWindow: boolean;
  downloadedData?: BatchData;
  replayState?: any;
}

/**
 * 验证器统计信息
 */
export interface ValidatorMetrics {
  totalBatches: number;
  successfulValidations: number;
  failedValidations: number;
  avgDownloadTime: number;
  avgValidationTime: number;
  avgThroughput: number;
  currentConcurrency: number;
  cacheHitRate: number;
  challengeCount: number;
  challengeSuccessRate: number;
}

/**
 * 确定性重放器
 */
class DeterministicReplayer {
  private replayBuffer: Map<string, any> = new Map();
  private bufferSize: number;

  constructor(bufferSize: number = 1000) {
    this.bufferSize = bufferSize;
  }

  /**
   * 准备重放状态
   */
  prepareReplay(batchId: string, initialState: any): void {
    this.replayBuffer.set(batchId, {
      initialState: JSON.parse(JSON.stringify(initialState)),
      operations: [],
      currentState: JSON.parse(JSON.stringify(initialState))
    });

    // 清理旧的重放状态
    if (this.replayBuffer.size > this.bufferSize) {
      const oldestKey = this.replayBuffer.keys().next().value;
      this.replayBuffer.delete(oldestKey);
    }
  }

  /**
   * 执行确定性重放
   */
  async executeReplay(batchId: string, orders: Order[], matches: MatchResult[]): Promise<any> {
    const replayState = this.replayBuffer.get(batchId);
    if (!replayState) {
      throw new Error(`Replay state not found for batch ${batchId}`);
    }

    // 重置到初始状态
    replayState.currentState = JSON.parse(JSON.stringify(replayState.initialState));
    replayState.operations = [];

    // 按确定性顺序重放操作
    const sortedOrders = [...orders].sort((a, b) => {
      // 按时间戳和订单ID排序确保确定性
      if (a.timestamp !== b.timestamp) {
        return a.timestamp - b.timestamp;
      }
      return a.id.localeCompare(b.id);
    });

    for (const order of sortedOrders) {
      const operation = this.applyOrderOperation(replayState.currentState, order);
      replayState.operations.push(operation);
    }

    // 验证撮合结果的确定性
    for (const match of matches) {
      const operation = this.applyMatchOperation(replayState.currentState, match);
      replayState.operations.push(operation);
    }

    return replayState.currentState;
  }

  private applyOrderOperation(state: any, order: Order): any {
    // 模拟订单操作对状态的影响
    return {
      type: 'order',
      orderId: order.id,
      timestamp: Date.now(),
      stateChange: {
        // 这里应该包含实际的状态变更逻辑
        orderBook: 'updated',
        balances: 'checked'
      }
    };
  }

  private applyMatchOperation(state: any, match: MatchResult): any {
    // 模拟撮合操作对状态的影响
    return {
      type: 'match',
      matchId: match.id,
      timestamp: Date.now(),
      stateChange: {
        // 这里应该包含实际的状态变更逻辑
        balances: 'updated',
        positions: 'updated'
      }
    };
  }

  getReplayState(batchId: string): any {
    return this.replayBuffer.get(batchId);
  }

  clearReplayState(batchId: string): void {
    this.replayBuffer.delete(batchId);
  }
}

/**
 * 分层验证器
 */
class LayeredValidator {
  /**
   * L0层：数据完整性验证
   */
  async validateL0DataIntegrity(batchCommit: BatchCommit, batchData: BatchData): Promise<ValidationResult> {
    const startTime = Date.now();
    
    try {
      // 验证Merkle根
      const ordersRoot = await computeMerkleRoot(batchData.orders.map(o => JSON.stringify(o)));
      const matchesRoot = await computeMerkleRoot(batchData.matches.map(m => JSON.stringify(m)));
      const balanceDiffsRoot = await computeMerkleRoot(batchData.balanceDiffs.map(b => JSON.stringify(b)));

      const rootsMatch = 
        ordersRoot === batchCommit.ordersRoot &&
        matchesRoot === batchCommit.matchesRoot &&
        balanceDiffsRoot === batchCommit.balanceDiffsRoot;

      // 验证数据完整性
      const dataIntegrityValid = 
        batchData.orders.length > 0 &&
        batchData.matches.length >= 0 &&
        batchData.balanceDiffs.length >= 0;

      const success = rootsMatch && dataIntegrityValid;

      return {
        layer: ValidationLayer.L0_DATA_INTEGRITY,
        batchId: batchCommit.batchId,
        success,
        timestamp: Date.now(),
        processingTime: Date.now() - startTime,
        details: {
          rootsMatch,
          dataIntegrityValid,
          ordersCount: batchData.orders.length,
          matchesCount: batchData.matches.length,
          balanceDiffsCount: batchData.balanceDiffs.length
        }
      };
    } catch (error) {
      return {
        layer: ValidationLayer.L0_DATA_INTEGRITY,
        batchId: batchCommit.batchId,
        success: false,
        timestamp: Date.now(),
        processingTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * L1层：订单匹配逻辑验证
   */
  async validateL1MatchingLogic(batchCommit: BatchCommit, batchData: BatchData): Promise<ValidationResult> {
    const startTime = Date.now();
    
    try {
      let validMatches = 0;
      let totalMatches = batchData.matches.length;

      // 验证每个撮合结果的逻辑正确性
      for (const match of batchData.matches) {
        const buyOrder = batchData.orders.find(o => o.id === match.buyOrderId);
        const sellOrder = batchData.orders.find(o => o.id === match.sellOrderId);

        if (buyOrder && sellOrder) {
          // 验证价格匹配逻辑
          const priceValid = buyOrder.price >= sellOrder.price;
          // 验证数量匹配逻辑
          const quantityValid = match.quantity <= Math.min(buyOrder.quantity, sellOrder.quantity);
          // 验证交易对匹配
          const pairValid = buyOrder.symbol === sellOrder.symbol;

          if (priceValid && quantityValid && pairValid) {
            validMatches++;
          }
        }
      }

      const success = validMatches === totalMatches;

      return {
        layer: ValidationLayer.L1_MATCHING_LOGIC,
        batchId: batchCommit.batchId,
        success,
        timestamp: Date.now(),
        processingTime: Date.now() - startTime,
        details: {
          validMatches,
          totalMatches,
          successRate: totalMatches > 0 ? validMatches / totalMatches : 1
        }
      };
    } catch (error) {
      return {
        layer: ValidationLayer.L1_MATCHING_LOGIC,
        batchId: batchCommit.batchId,
        success: false,
        timestamp: Date.now(),
        processingTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * L2层：状态转换验证
   */
  async validateL2StateTransition(batchCommit: BatchCommit, batchData: BatchData, replayState: any): Promise<ValidationResult> {
    const startTime = Date.now();
    
    try {
      let validTransitions = 0;
      let totalTransitions = batchData.balanceDiffs.length;

      // 验证每个余额变更的状态转换
      for (const balanceDiff of batchData.balanceDiffs) {
        // 验证余额变更的合理性
        const balanceChangeValid = 
          balanceDiff.amount !== 0n &&
          balanceDiff.userId &&
          balanceDiff.asset;

        // 验证状态转换的一致性
        const stateTransitionValid = this.validateStateTransition(balanceDiff, replayState);

        if (balanceChangeValid && stateTransitionValid) {
          validTransitions++;
        }
      }

      const success = validTransitions === totalTransitions;

      return {
        layer: ValidationLayer.L2_STATE_TRANSITION,
        batchId: batchCommit.batchId,
        success,
        timestamp: Date.now(),
        processingTime: Date.now() - startTime,
        details: {
          validTransitions,
          totalTransitions,
          successRate: totalTransitions > 0 ? validTransitions / totalTransitions : 1
        }
      };
    } catch (error) {
      return {
        layer: ValidationLayer.L2_STATE_TRANSITION,
        batchId: batchCommit.batchId,
        success: false,
        timestamp: Date.now(),
        processingTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * L3层：最终一致性验证
   */
  async validateL3FinalConsistency(batchCommit: BatchCommit, batchData: BatchData): Promise<ValidationResult> {
    const startTime = Date.now();
    
    try {
      // 验证总体一致性
      const orderVolume = batchData.orders.reduce((sum, order) => sum + order.quantity, 0);
      const matchVolume = batchData.matches.reduce((sum, match) => sum + match.quantity, 0);
      
      // 验证余额守恒
      const balanceSum = batchData.balanceDiffs.reduce((sum, diff) => sum + Number(diff.amount), 0);
      const balanceConservation = Math.abs(balanceSum) < 1e-10; // 允许浮点误差

      // 验证批次完整性
      const batchIntegrity = 
        batchCommit.batchId &&
        batchCommit.timestamp > 0 &&
        batchCommit.cid;

      const success = balanceConservation && batchIntegrity;

      return {
        layer: ValidationLayer.L3_FINAL_CONSISTENCY,
        batchId: batchCommit.batchId,
        success,
        timestamp: Date.now(),
        processingTime: Date.now() - startTime,
        details: {
          orderVolume,
          matchVolume,
          balanceSum,
          balanceConservation,
          batchIntegrity
        }
      };
    } catch (error) {
      return {
        layer: ValidationLayer.L3_FINAL_CONSISTENCY,
        batchId: batchCommit.batchId,
        success: false,
        timestamp: Date.now(),
        processingTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private validateStateTransition(balanceDiff: BalanceDiff, replayState: any): boolean {
    // 这里应该包含实际的状态转换验证逻辑
    // 目前返回简单的验证结果
    return balanceDiff.amount !== 0n && balanceDiff.userId !== '';
  }
}

/**
 * 并行验证器主类
 */
export class ParallelValidator extends EventEmitter {
  private config: ParallelValidatorConfig;
  private messageBus: MessageBus;
  private replayer: DeterministicReplayer;
  private layeredValidator: LayeredValidator;
  
  private isRunning: boolean = false;
  private validationStates: Map<string, BatchValidationState> = new Map();
  private downloadQueue: BatchCommit[] = [];
  private validationQueue: BatchValidationState[] = [];
  private challengeQueue: BatchValidationState[] = [];
  
  private metrics: ValidatorMetrics;
  private cache: Map<string, BatchData> = new Map();
  private activeDownloads: Set<string> = new Set();
  private activeValidations: Set<string> = new Set();

  constructor(config: ParallelValidatorConfig, messageBus: MessageBus) {
    super();
    this.config = config;
    this.messageBus = messageBus;
    this.replayer = new DeterministicReplayer(config.replayBufferSize);
    this.layeredValidator = new LayeredValidator();
    
    this.metrics = {
      totalBatches: 0,
      successfulValidations: 0,
      failedValidations: 0,
      avgDownloadTime: 0,
      avgValidationTime: 0,
      avgThroughput: 0,
      currentConcurrency: 0,
      cacheHitRate: 0,
      challengeCount: 0,
      challengeSuccessRate: 0
    };

    this.setupMessageBusSubscriptions();
  }

  /**
   * 启动并行验证器
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('ParallelValidator is already running');
      return;
    }

    try {
      this.isRunning = true;
      
      // 启动处理循环
      this.startProcessingLoops();
      
      this.emit('started');
      console.log('ParallelValidator started successfully');
      
    } catch (error) {
      this.isRunning = false;
      console.error('Failed to start ParallelValidator:', error);
      throw error;
    }
  }

  /**
   * 停止并行验证器
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      this.isRunning = false;
      
      // 等待当前验证完成
      await this.waitForActiveValidations();
      
      this.emit('stopped');
      console.log('ParallelValidator stopped successfully');
      
    } catch (error) {
      console.error('Failed to stop ParallelValidator:', error);
      throw error;
    }
  }

  /**
   * 提交批次进行验证
   */
  async submitBatchForValidation(batchCommit: BatchCommit): Promise<void> {
    if (!this.isRunning) {
      throw new Error('ParallelValidator is not running');
    }

    // 创建验证状态
    const validationState: BatchValidationState = {
      batchId: batchCommit.batchId,
      batchCommit,
      downloadStartTime: Date.now(),
      currentLayer: ValidationLayer.L0_DATA_INTEGRITY,
      layerResults: new Map(),
      isInChallengeWindow: false
    };

    this.validationStates.set(batchCommit.batchId, validationState);
    this.downloadQueue.push(batchCommit);
    this.metrics.totalBatches++;

    this.emit('batchSubmitted', { batchId: batchCommit.batchId });
  }

  /**
   * 设置消息总线订阅
   */
  private setupMessageBusSubscriptions(): void {
    this.messageBus.subscribe({
      topic: 'batchCommitGenerated',
      handler: {
        handle: async (message: Message) => {
          const batchCommit = message.payload as BatchCommit;
          await this.submitBatchForValidation(batchCommit);
        }
      }
    });

    this.messageBus.subscribe({
      topic: 'challengeSubmitted',
      handler: {
        handle: async (message: Message) => {
          await this.handleChallenge(message);
        }
      }
    });
  }

  /**
   * 启动处理循环
   */
  private startProcessingLoops(): void {
    // 下载处理循环
    setInterval(() => {
      this.processDownloadQueue();
    }, 100);

    // 验证处理循环
    setInterval(() => {
      this.processValidationQueue();
    }, 50);

    // 挑战窗口处理循环
    setInterval(() => {
      this.processChallengeWindow();
    }, 1000);

    // 指标更新循环
    setInterval(() => {
      this.updateMetrics();
    }, 5000);
  }

  /**
   * 处理下载队列
   */
  private async processDownloadQueue(): Promise<void> {
    while (
      this.downloadQueue.length > 0 && 
      this.activeDownloads.size < this.config.maxConcurrentDownloads
    ) {
      const batchCommit = this.downloadQueue.shift()!;
      this.downloadBatchData(batchCommit);
    }
  }

  /**
   * 下载批次数据
   */
  private async downloadBatchData(batchCommit: BatchCommit): Promise<void> {
    const batchId = batchCommit.batchId;
    this.activeDownloads.add(batchId);

    try {
      const validationState = this.validationStates.get(batchId);
      if (!validationState) {
        throw new Error(`Validation state not found for batch ${batchId}`);
      }

      // 检查缓存
      let batchData = this.cache.get(batchCommit.cid);
      
      if (!batchData) {
        // 从DA存储下载
        batchData = await casClient.get(batchCommit.cid);
        
        if (this.config.enableCaching) {
          this.cache.set(batchCommit.cid, batchData);
          
          // 清理缓存
          if (this.cache.size > this.config.cacheSize) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
          }
        }
      }

      validationState.downloadedData = batchData;
      validationState.downloadEndTime = Date.now();
      validationState.validationStartTime = Date.now();

      // 准备确定性重放
      if (this.config.enableDeterministicReplay) {
        this.replayer.prepareReplay(batchId, {});
      }

      // 添加到验证队列
      this.validationQueue.push(validationState);

      this.emit('batchDownloaded', { batchId });

    } catch (error) {
      console.error(`Failed to download batch data for ${batchId}:`, error);
      this.handleValidationFailure(batchId, error);
    } finally {
      this.activeDownloads.delete(batchId);
    }
  }

  /**
   * 处理验证队列
   */
  private async processValidationQueue(): Promise<void> {
    while (
      this.validationQueue.length > 0 && 
      this.activeValidations.size < this.config.maxConcurrentValidations
    ) {
      const validationState = this.validationQueue.shift()!;
      this.validateBatch(validationState);
    }
  }

  /**
   * 验证批次
   */
  private async validateBatch(validationState: BatchValidationState): Promise<void> {
    const batchId = validationState.batchId;
    this.activeValidations.add(batchId);

    try {
      const { batchCommit, downloadedData } = validationState;
      
      if (!downloadedData) {
        throw new Error(`No downloaded data for batch ${batchId}`);
      }

      // 执行分层验证
      const layers = [
        ValidationLayer.L0_DATA_INTEGRITY,
        ValidationLayer.L1_MATCHING_LOGIC,
        ValidationLayer.L2_STATE_TRANSITION,
        ValidationLayer.L3_FINAL_CONSISTENCY
      ];

      let allLayersValid = true;

      for (const layer of layers) {
        validationState.currentLayer = layer;
        let result: ValidationResult;

        switch (layer) {
          case ValidationLayer.L0_DATA_INTEGRITY:
            result = await this.layeredValidator.validateL0DataIntegrity(batchCommit, downloadedData);
            break;
          case ValidationLayer.L1_MATCHING_LOGIC:
            result = await this.layeredValidator.validateL1MatchingLogic(batchCommit, downloadedData);
            break;
          case ValidationLayer.L2_STATE_TRANSITION:
            const replayState = this.config.enableDeterministicReplay 
              ? await this.replayer.executeReplay(batchId, downloadedData.orders, downloadedData.matches)
              : {};
            result = await this.layeredValidator.validateL2StateTransition(batchCommit, downloadedData, replayState);
            break;
          case ValidationLayer.L3_FINAL_CONSISTENCY:
            result = await this.layeredValidator.validateL3FinalConsistency(batchCommit, downloadedData);
            break;
          default:
            throw new Error(`Unknown validation layer: ${layer}`);
        }

        validationState.layerResults.set(layer, result);

        if (!result.success) {
          allLayersValid = false;
          console.warn(`Validation failed at layer ${layer} for batch ${batchId}:`, result.error);
        }

        this.emit('layerValidated', { batchId, layer, result });
      }

      validationState.validationEndTime = Date.now();

      if (allLayersValid) {
        await this.handleValidationSuccess(validationState);
      } else {
        await this.handleValidationFailure(batchId, new Error('Layer validation failed'));
      }

    } catch (error) {
      console.error(`Failed to validate batch ${batchId}:`, error);
      await this.handleValidationFailure(batchId, error);
    } finally {
      this.activeValidations.delete(batchId);
    }
  }

  /**
   * 处理验证成功
   */
  private async handleValidationSuccess(validationState: BatchValidationState): Promise<void> {
    const batchId = validationState.batchId;
    
    // 启动挑战窗口
    if (this.config.challengeEnabled) {
      validationState.challengeWindowStart = Date.now();
      validationState.isInChallengeWindow = true;
      this.challengeQueue.push(validationState);
    }

    this.metrics.successfulValidations++;

    // 发布验证成功消息
    await this.messageBus.publish({
      topic: 'batchValidated',
      payload: {
        batchId,
        success: true,
        validationResults: Array.from(validationState.layerResults.values()),
        challengeWindowStart: validationState.challengeWindowStart
      },
      priority: MessagePriority.HIGH,
      timestamp: Date.now()
    });

    this.emit('batchValidated', { batchId, success: true });
  }

  /**
   * 处理验证失败
   */
  private async handleValidationFailure(batchId: string, error: any): Promise<void> {
    this.metrics.failedValidations++;

    // 发布验证失败消息
    await this.messageBus.publish({
      topic: 'batchValidationFailed',
      payload: {
        batchId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      priority: MessagePriority.HIGH,
      timestamp: Date.now()
    });

    // 清理状态
    this.validationStates.delete(batchId);
    this.replayer.clearReplayState(batchId);

    this.emit('batchValidated', { batchId, success: false, error });
  }

  /**
   * 处理挑战窗口
   */
  private processChallengeWindow(): void {
    const now = Date.now();
    const expiredChallenges: BatchValidationState[] = [];

    for (const validationState of this.challengeQueue) {
      if (validationState.challengeWindowStart && 
          now - validationState.challengeWindowStart >= this.config.challengeWindowMs) {
        expiredChallenges.push(validationState);
      }
    }

    // 处理过期的挑战窗口
    for (const validationState of expiredChallenges) {
      this.finalizeBatchValidation(validationState);
      const index = this.challengeQueue.indexOf(validationState);
      if (index > -1) {
        this.challengeQueue.splice(index, 1);
      }
    }
  }

  /**
   * 最终确认批次验证
   */
  private async finalizeBatchValidation(validationState: BatchValidationState): Promise<void> {
    const batchId = validationState.batchId;

    // 发布最终确认消息
    await this.messageBus.publish({
      topic: 'batchFinalized',
      payload: {
        batchId,
        finalizedAt: Date.now(),
        validationResults: Array.from(validationState.layerResults.values())
      },
      priority: MessagePriority.NORMAL,
      timestamp: Date.now()
    });

    // 清理状态
    this.validationStates.delete(batchId);
    this.replayer.clearReplayState(batchId);

    this.emit('batchFinalized', { batchId });
  }

  /**
   * 处理挑战
   */
  private async handleChallenge(message: Message): Promise<void> {
    const { batchId, challengeData } = message.payload;
    
    this.metrics.challengeCount++;

    const validationState = this.validationStates.get(batchId);
    if (!validationState || !validationState.isInChallengeWindow) {
      console.warn(`Challenge received for invalid or expired batch: ${batchId}`);
      return;
    }

    try {
      // 重新执行验证以响应挑战
      await this.validateBatch(validationState);
      this.metrics.challengeSuccessRate = this.metrics.challengeSuccessRate * 0.9 + 0.1;
      
    } catch (error) {
      console.error(`Challenge validation failed for batch ${batchId}:`, error);
      this.metrics.challengeSuccessRate = this.metrics.challengeSuccessRate * 0.9;
    }
  }

  /**
   * 等待活跃验证完成
   */
  private async waitForActiveValidations(): Promise<void> {
    while (this.activeDownloads.size > 0 || this.activeValidations.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * 更新指标
   */
  private updateMetrics(): void {
    this.metrics.currentConcurrency = this.activeDownloads.size + this.activeValidations.size;
    
    if (this.config.enableCaching) {
      // 计算缓存命中率（简化实现）
      this.metrics.cacheHitRate = Math.min(this.cache.size / this.config.cacheSize, 1);
    }

    // 计算平均吞吐量
    const totalValidations = this.metrics.successfulValidations + this.metrics.failedValidations;
    if (totalValidations > 0) {
      this.metrics.avgThroughput = totalValidations / ((Date.now() - (this as any).startTime) / 1000);
    }
  }

  /**
   * 获取验证状态
   */
  getValidationState(batchId: string): BatchValidationState | undefined {
    return this.validationStates.get(batchId);
  }

  /**
   * 获取指标
   */
  getMetrics(): ValidatorMetrics {
    return { ...this.metrics };
  }

  /**
   * 获取队列状态
   */
  getQueueStatus(): {
    downloadQueue: number;
    validationQueue: number;
    challengeQueue: number;
    activeDownloads: number;
    activeValidations: number;
  } {
    return {
      downloadQueue: this.downloadQueue.length,
      validationQueue: this.validationQueue.length,
      challengeQueue: this.challengeQueue.length,
      activeDownloads: this.activeDownloads.size,
      activeValidations: this.activeValidations.size
    };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<ParallelValidatorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.validationStates.clear();
    this.downloadQueue.length = 0;
    this.validationQueue.length = 0;
    this.challengeQueue.length = 0;
    this.cache.clear();
    this.activeDownloads.clear();
    this.activeValidations.clear();
  }
}