/**
 * Smart Sharding Matching Engine / 智能分片撮合引擎
 * Implements intelligent sharding strategy based on trading pairs and users / 实现基于交易对和用户的智能分片策略
 * Supports cross-shard atomic matching and load balancing / 支持跨分片原子撮合和负载均衡
 */

import { EventEmitter } from 'events';
import { TitanCore, ZeroCopyOrder, ChainOrderBook } from '../core/titan-core';
import { Transaction } from '../../shared/types/blockchain';

// Define MatchResult interface locally since matching-engine may not exist / 本地定义MatchResult接口，因为matching-engine可能不存在
export interface MatchResult {
  id: string;
  buyOrderId: string;
  sellOrderId: string;
  price: string;
  quantity: string;
  timestamp: number;
  buyAccount: string;
  sellAccount: string;
}

/**
 * Shard Type Enumeration / 分片类型枚举
 */
export enum ShardType {
  TRADING_PAIR = 'trading_pair',    // Shard by trading pair / 按交易对分片
  USER_BASED = 'user_based',        // Shard by user / 按用户分片
  HYBRID = 'hybrid',                // Hybrid sharding / 混合分片
  DYNAMIC = 'dynamic'               // Dynamic sharding / 动态分片
}

/**
 * Shard Status Interface / 分片状态接口
 */
export interface ShardStatus {
  id: string;
  type: ShardType;
  load: number;              // Current load (0-1) / 当前负载 (0-1)
  tps: number;              // Current TPS / 当前TPS
  latency: number;          // Average latency (ms) / 平均延迟(ms)
  orderCount: number;       // Order count / 订单数量
  tradingPairs: string[];   // Handled trading pairs / 处理的交易对
  isHealthy: boolean;       // Health status / 健康状态
  lastUpdate: number;       // Last update time / 最后更新时间
}

/**
 * Cross-shard matching request / 跨分片撮合请求
 */
export interface CrossShardMatch {
  id: string;
  takerShardId: string;
  makerShardId: string;
  takerOrder: ZeroCopyOrder;
  makerOrder: ZeroCopyOrder;
  matchPrice: number;
  matchQuantity: number;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
}

/**
 * Load balance strategy / 负载均衡策略
 */
export enum LoadBalanceStrategy {
  ROUND_ROBIN = 'round_robin',
  LEAST_LOADED = 'least_loaded',
  WEIGHTED = 'weighted',
  CONSISTENT_HASH = 'consistent_hash'
}

/**
 * Shard instance / 分片实例
 * Each shard contains independent TitanCore engine / 每个分片包含独立的TitanCore引擎
 */
export class Shard extends EventEmitter {
  public readonly id: string;
  public readonly type: ShardType;
  private titanCore: TitanCore;
  private assignedTradingPairs: Set<string> = new Set();
  private assignedUsers: Set<bigint> = new Set();
  private metrics: {
    processedOrders: number;
    processedMatches: number;
    avgProcessingTime: number;
    peakTPS: number;
    currentTPS: number;
  } = {
    processedOrders: 0,
    processedMatches: 0,
    avgProcessingTime: 0,
    peakTPS: 0,
    currentTPS: 0
  };
  private tpsWindow: number[] = [];
  private readonly TPS_WINDOW_SIZE = 60; // 60秒窗口

  constructor(id: string, type: ShardType) {
    super();
    this.id = id;
    this.type = type;
    this.titanCore = new TitanCore();
    
    this.setupEventHandlers();
    console.log(`Shard ${id} created with type ${type}`);
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    this.titanCore.on('orderAdded', (data) => {
      this.metrics.processedOrders++;
      this.updateTPS();
      this.emit('orderProcessed', { shardId: this.id, ...data });
    });

    this.titanCore.on('tradeExecuted', (data) => {
      this.metrics.processedMatches++;
      this.emit('tradeExecuted', { shardId: this.id, ...data });
    });
  }

  /**
   * 启动分片
   */
  public async start(): Promise<void> {
    await this.titanCore.start();
    console.log(`Shard ${this.id} started`);
    this.emit('started', this.id);
  }

  /**
   * 停止分片
   */
  public async stop(): Promise<void> {
    await this.titanCore.stop();
    console.log(`Shard ${this.id} stopped`);
    this.emit('stopped', this.id);
  }

  /**
   * 分配交易对到分片
   */
  public assignTradingPair(tradingPair: string): void {
    this.assignedTradingPairs.add(tradingPair);
    console.log(`Trading pair ${tradingPair} assigned to shard ${this.id}`);
  }

  /**
   * 移除交易对分配
   */
  public unassignTradingPair(tradingPair: string): void {
    this.assignedTradingPairs.delete(tradingPair);
    console.log(`Trading pair ${tradingPair} unassigned from shard ${this.id}`);
  }

  /**
   * 分配用户到分片
   */
  public assignUser(userId: bigint): void {
    this.assignedUsers.add(userId);
  }

  /**
   * 检查是否可以处理订单
   */
  public canProcessOrder(order: ZeroCopyOrder, tradingPair: string): boolean {
    switch (this.type) {
      case ShardType.TRADING_PAIR:
        return this.assignedTradingPairs.has(tradingPair);
      case ShardType.USER_BASED:
        return this.assignedUsers.has(order.userId);
      case ShardType.HYBRID:
        return this.assignedTradingPairs.has(tradingPair) || this.assignedUsers.has(order.userId);
      case ShardType.DYNAMIC:
        return true; // 动态分片可以处理任何订单
      default:
        return false;
    }
  }

  /**
   * 处理订单
   */
  public async processOrder(orderData: any): Promise<{ orderId: bigint; matches: MatchResult[] }> {
    const startTime = performance.now();
    
    try {
      const result = await this.titanCore.submitOrder(orderData);
      
      const processingTime = performance.now() - startTime;
      this.updateProcessingTime(processingTime);
      
      return result;
    } catch (error) {
      console.error(`Shard ${this.id} failed to process order:`, error);
      throw error;
    }
  }

  /**
   * 获取分片状态
   */
  public getStatus(): ShardStatus {
    const load = this.calculateLoad();
    const latency = this.metrics.avgProcessingTime;
    
    return {
      id: this.id,
      type: this.type,
      load,
      tps: this.metrics.currentTPS,
      latency,
      orderCount: this.metrics.processedOrders,
      tradingPairs: Array.from(this.assignedTradingPairs),
      isHealthy: load < 0.9 && latency < 100, // 负载<90%且延迟<100ms为健康
      lastUpdate: Date.now()
    };
  }

  /**
   * 计算当前负载
   */
  private calculateLoad(): number {
    const maxTPS = 100000; // 假设每个分片最大TPS为10万
    return Math.min(this.metrics.currentTPS / maxTPS, 1.0);
  }

  /**
   * 更新TPS统计
   */
  private updateTPS(): void {
    const now = Date.now();
    this.tpsWindow.push(now);
    
    // 移除超过窗口时间的记录
    const windowStart = now - this.TPS_WINDOW_SIZE * 1000;
    this.tpsWindow = this.tpsWindow.filter(time => time > windowStart);
    
    // 计算当前TPS
    this.metrics.currentTPS = this.tpsWindow.length / this.TPS_WINDOW_SIZE;
    
    // 更新峰值TPS
    if (this.metrics.currentTPS > this.metrics.peakTPS) {
      this.metrics.peakTPS = this.metrics.currentTPS;
    }
  }

  /**
   * 更新处理时间统计
   */
  private updateProcessingTime(processingTime: number): void {
    const alpha = 0.1; // 指数移动平均的平滑因子
    this.metrics.avgProcessingTime = this.metrics.avgProcessingTime * (1 - alpha) + processingTime * alpha;
  }

  /**
   * 获取TitanCore实例
   */
  public getTitanCore(): TitanCore {
    return this.titanCore;
  }
}

/**
 * 跨分片协调器
 * 处理跨分片的原子撮合
 */
export class CrossShardCoordinator extends EventEmitter {
  private pendingMatches: Map<string, CrossShardMatch> = new Map();
  private shards: Map<string, Shard> = new Map();
  private matchTimeout: number = 5000; // 5秒超时

  constructor(shards: Map<string, Shard>) {
    super();
    this.shards = shards;
    console.log('CrossShardCoordinator initialized');
  }

  /**
   * 执行跨分片撮合
   */
  public async executeCrossShardMatch(
    takerOrder: ZeroCopyOrder,
    makerOrder: ZeroCopyOrder,
    takerShardId: string,
    makerShardId: string
  ): Promise<MatchResult | null> {
    const matchId = `cross_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const crossMatch: CrossShardMatch = {
      id: matchId,
      takerShardId,
      makerShardId,
      takerOrder,
      makerOrder,
      matchPrice: makerOrder.price,
      matchQuantity: Math.min(takerOrder.remaining, makerOrder.remaining),
      timestamp: Date.now(),
      status: 'pending'
    };

    this.pendingMatches.set(matchId, crossMatch);

    try {
      // 两阶段提交协议
      const prepared = await this.preparePhase(crossMatch);
      if (!prepared) {
        crossMatch.status = 'failed';
        this.pendingMatches.delete(matchId);
        return null;
      }

      const committed = await this.commitPhase(crossMatch);
      if (!committed) {
        await this.abortPhase(crossMatch);
        crossMatch.status = 'failed';
        this.pendingMatches.delete(matchId);
        return null;
      }

      crossMatch.status = 'confirmed';
      this.pendingMatches.delete(matchId);

      const matchResult: MatchResult = {
        id: matchId,
        buyOrderId: takerOrder.side === 'buy' ? takerOrder.id.toString() : makerOrder.id.toString(),
        sellOrderId: takerOrder.side === 'sell' ? takerOrder.id.toString() : makerOrder.id.toString(),
        price: crossMatch.matchPrice.toString(),
        quantity: crossMatch.matchQuantity.toString(),
        timestamp: crossMatch.timestamp,
        buyAccount: takerOrder.side === 'buy' ? takerOrder.userId.toString() : makerOrder.userId.toString(),
        sellAccount: takerOrder.side === 'sell' ? takerOrder.userId.toString() : makerOrder.userId.toString()
      };

      this.emit('crossShardMatchExecuted', matchResult);
      return matchResult;

    } catch (error) {
      console.error(`Cross-shard match ${matchId} failed:`, error);
      crossMatch.status = 'failed';
      this.pendingMatches.delete(matchId);
      return null;
    }
  }

  /**
   * 准备阶段 - 锁定订单
   */
  private async preparePhase(crossMatch: CrossShardMatch): Promise<boolean> {
    const takerShard = this.shards.get(crossMatch.takerShardId);
    const makerShard = this.shards.get(crossMatch.makerShardId);

    if (!takerShard || !makerShard) {
      return false;
    }

    try {
      // 在两个分片上锁定订单
      // 这里简化处理，实际需要实现订单锁定机制
      console.log(`Preparing cross-shard match ${crossMatch.id}`);
      return true;
    } catch (error) {
      console.error('Prepare phase failed:', error);
      return false;
    }
  }

  /**
   * 提交阶段 - 执行撮合
   */
  private async commitPhase(crossMatch: CrossShardMatch): Promise<boolean> {
    try {
      // 更新订单状态
      crossMatch.takerOrder.filled += crossMatch.matchQuantity;
      crossMatch.makerOrder.filled += crossMatch.matchQuantity;

      console.log(`Committed cross-shard match ${crossMatch.id}`);
      return true;
    } catch (error) {
      console.error('Commit phase failed:', error);
      return false;
    }
  }

  /**
   * 中止阶段 - 回滚操作
   */
  private async abortPhase(crossMatch: CrossShardMatch): Promise<void> {
    try {
      // 释放锁定的订单
      console.log(`Aborted cross-shard match ${crossMatch.id}`);
    } catch (error) {
      console.error('Abort phase failed:', error);
    }
  }
}

/**
 * 负载均衡器
 * 实现智能的分片选择和负载分配
 */
export class LoadBalancer {
  private shards: Map<string, Shard> = new Map();
  private strategy: LoadBalanceStrategy = LoadBalanceStrategy.LEAST_LOADED;
  private roundRobinIndex: number = 0;
  private consistentHashRing: Map<number, string> = new Map();

  constructor(strategy: LoadBalanceStrategy = LoadBalanceStrategy.LEAST_LOADED) {
    this.strategy = strategy;
    this.initializeConsistentHash();
  }

  /**
   * 添加分片
   */
  public addShard(shard: Shard): void {
    this.shards.set(shard.id, shard);
    this.updateConsistentHash();
    console.log(`Shard ${shard.id} added to load balancer`);
  }

  /**
   * 移除分片
   */
  public removeShard(shardId: string): void {
    this.shards.delete(shardId);
    this.updateConsistentHash();
    console.log(`Shard ${shardId} removed from load balancer`);
  }

  /**
   * 选择最佳分片处理订单
   */
  public selectShard(orderData: any, tradingPair: string): Shard | null {
    const availableShards = Array.from(this.shards.values())
      .filter(shard => shard.canProcessOrder(orderData, tradingPair));

    if (availableShards.length === 0) {
      return null;
    }

    switch (this.strategy) {
      case LoadBalanceStrategy.ROUND_ROBIN:
        return this.selectRoundRobin(availableShards);
      case LoadBalanceStrategy.LEAST_LOADED:
        return this.selectLeastLoaded(availableShards);
      case LoadBalanceStrategy.WEIGHTED:
        return this.selectWeighted(availableShards);
      case LoadBalanceStrategy.CONSISTENT_HASH:
        return this.selectConsistentHash(orderData.userId, availableShards);
      default:
        return availableShards[0];
    }
  }

  /**
   * 轮询选择
   */
  private selectRoundRobin(shards: Shard[]): Shard {
    const shard = shards[this.roundRobinIndex % shards.length];
    this.roundRobinIndex++;
    return shard;
  }

  /**
   * 选择负载最低的分片
   */
  private selectLeastLoaded(shards: Shard[]): Shard {
    return shards.reduce((best, current) => {
      const bestLoad = best.getStatus().load;
      const currentLoad = current.getStatus().load;
      return currentLoad < bestLoad ? current : best;
    });
  }

  /**
   * 加权选择
   */
  private selectWeighted(shards: Shard[]): Shard {
    // 基于负载的反向权重
    const weights = shards.map(shard => {
      const load = shard.getStatus().load;
      return Math.max(0.1, 1.0 - load); // 负载越低权重越高
    });

    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < shards.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return shards[i];
      }
    }

    return shards[shards.length - 1];
  }

  /**
   * 一致性哈希选择
   */
  private selectConsistentHash(userId: bigint, shards: Shard[]): Shard {
    const hash = this.hash(userId.toString());
    const availableHashes = Array.from(this.consistentHashRing.keys())
      .filter(h => {
        const shardId = this.consistentHashRing.get(h);
        return shards.some(s => s.id === shardId);
      })
      .sort((a, b) => a - b);

    // 找到第一个大于等于hash的节点
    for (const nodeHash of availableHashes) {
      if (nodeHash >= hash) {
        const shardId = this.consistentHashRing.get(nodeHash)!;
        return shards.find(s => s.id === shardId)!;
      }
    }

    // 如果没找到，选择第一个节点（环形）
    const firstNodeHash = availableHashes[0];
    const shardId = this.consistentHashRing.get(firstNodeHash)!;
    return shards.find(s => s.id === shardId)!;
  }

  /**
   * 初始化一致性哈希环
   */
  private initializeConsistentHash(): void {
    this.consistentHashRing.clear();
  }

  /**
   * 更新一致性哈希环
   */
  private updateConsistentHash(): void {
    this.consistentHashRing.clear();
    
    // 为每个分片创建多个虚拟节点
    const virtualNodes = 150;
    for (const [shardId] of this.shards) {
      for (let i = 0; i < virtualNodes; i++) {
        const hash = this.hash(`${shardId}_${i}`);
        this.consistentHashRing.set(hash, shardId);
      }
    }
  }

  /**
   * 简单哈希函数
   */
  private hash(key: string): number {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Get all shard status / 获取所有分片状态
   */
  public getAllShardStatus(): ShardStatus[] {
    return Array.from(this.shards.values()).map(shard => shard.getStatus());
  }

  /**
   * Get shard by ID / 根据ID获取分片
   */
  public getShard(shardId: string): Shard | undefined {
    return this.shards.get(shardId);
  }

  /**
   * Get all shards / 获取所有分片
   */
  public getAllShards(): Shard[] {
    return Array.from(this.shards.values());
  }

  /**
   * Get shard count / 获取分片数量
   */
  public getShardCount(): number {
    return this.shards.size;
  }
}

/**
 * 智能分片管理器
 * 统一管理所有分片和负载均衡
 */
export class SmartShardingManager extends EventEmitter {
  private shards: Map<string, Shard> = new Map();
  private loadBalancer: LoadBalancer;
  private crossShardCoordinator: CrossShardCoordinator;
  private isRunning: boolean = false;
  private autoScaling: boolean = true;
  private maxShards: number = 64;
  private minShards: number = 4;

  constructor(
    initialShardCount: number = 8,
    strategy: LoadBalanceStrategy = LoadBalanceStrategy.LEAST_LOADED
  ) {
    super();
    this.loadBalancer = new LoadBalancer(strategy);
    this.crossShardCoordinator = new CrossShardCoordinator(this.shards);
    
    // 初始化分片
    this.initializeShards(initialShardCount);
    
    console.log(`SmartShardingManager initialized with ${initialShardCount} shards`);
  }

  /**
   * 初始化分片
   */
  private initializeShards(count: number): void {
    for (let i = 0; i < count; i++) {
      const shardId = `shard_${i}`;
      const shard = new Shard(shardId, ShardType.DYNAMIC);
      
      this.shards.set(shardId, shard);
      this.loadBalancer.addShard(shard);
      
      // 设置事件处理
      shard.on('orderProcessed', (data) => this.emit('orderProcessed', data));
      shard.on('tradeExecuted', (data) => this.emit('tradeExecuted', data));
    }
  }

  /**
   * 启动分片管理器
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('SmartShardingManager is already running');
    }

    // 启动所有分片
    const startPromises = Array.from(this.shards.values()).map(shard => shard.start());
    await Promise.all(startPromises);

    this.isRunning = true;
    
    // 启动自动扩缩容监控
    if (this.autoScaling) {
      this.startAutoScaling();
    }

    console.log('SmartShardingManager started');
    this.emit('started');
  }

  /**
   * 停止分片管理器
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    // 停止所有分片
    const stopPromises = Array.from(this.shards.values()).map(shard => shard.stop());
    await Promise.all(stopPromises);

    this.isRunning = false;
    console.log('SmartShardingManager stopped');
    this.emit('stopped');
  }

  /**
   * 处理订单
   */
  public async processOrder(orderData: any, tradingPair: string): Promise<{ orderId: bigint; matches: MatchResult[] }> {
    if (!this.isRunning) {
      throw new Error('SmartShardingManager is not running');
    }

    const shard = this.loadBalancer.selectShard(orderData, tradingPair);
    if (!shard) {
      throw new Error('No available shard for processing order');
    }

    return await shard.processOrder(orderData);
  }

  /**
   * 添加新分片
   */
  public async addShard(shardType: ShardType = ShardType.DYNAMIC): Promise<string> {
    if (this.shards.size >= this.maxShards) {
      throw new Error(`Maximum shard limit reached: ${this.maxShards}`);
    }

    const shardId = `shard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const shard = new Shard(shardId, shardType);
    
    this.shards.set(shardId, shard);
    this.loadBalancer.addShard(shard);
    
    // 设置事件处理
    shard.on('orderProcessed', (data) => this.emit('orderProcessed', data));
    shard.on('tradeExecuted', (data) => this.emit('tradeExecuted', data));
    
    if (this.isRunning) {
      await shard.start();
    }

    console.log(`New shard ${shardId} added`);
    this.emit('shardAdded', shardId);
    
    return shardId;
  }

  /**
   * 移除分片
   */
  public async removeShard(shardId: string): Promise<boolean> {
    if (this.shards.size <= this.minShards) {
      console.warn(`Cannot remove shard: minimum shard limit reached: ${this.minShards}`);
      return false;
    }

    const shard = this.shards.get(shardId);
    if (!shard) {
      return false;
    }

    await shard.stop();
    this.shards.delete(shardId);
    this.loadBalancer.removeShard(shardId);

    console.log(`Shard ${shardId} removed`);
    this.emit('shardRemoved', shardId);
    
    return true;
  }

  /**
   * 启动自动扩缩容
   */
  private startAutoScaling(): void {
    setInterval(() => {
      this.checkAutoScaling();
    }, 30000); // 每30秒检查一次
  }

  /**
   * 检查自动扩缩容
   */
  private checkAutoScaling(): void {
    const shardStatuses = this.loadBalancer.getAllShardStatus();
    const avgLoad = shardStatuses.reduce((sum, status) => sum + status.load, 0) / shardStatuses.length;
    const maxLoad = Math.max(...shardStatuses.map(status => status.load));

    // 扩容条件：平均负载>70%或最大负载>90%
    if ((avgLoad > 0.7 || maxLoad > 0.9) && this.shards.size < this.maxShards) {
      this.addShard().then(shardId => {
        console.log(`Auto-scaling: Added shard ${shardId} (avgLoad: ${avgLoad.toFixed(2)}, maxLoad: ${maxLoad.toFixed(2)})`);
      });
    }
    
    // 缩容条件：平均负载<30%且最大负载<50%
    else if (avgLoad < 0.3 && maxLoad < 0.5 && this.shards.size > this.minShards) {
      // 找到负载最低的分片进行移除
      const leastLoadedShard = shardStatuses.reduce((min, current) => 
        current.load < min.load ? current : min
      );
      
      this.removeShard(leastLoadedShard.id).then(removed => {
        if (removed) {
          console.log(`Auto-scaling: Removed shard ${leastLoadedShard.id} (avgLoad: ${avgLoad.toFixed(2)})`);
        }
      });
    }
  }

  /**
   * 获取系统状态
   */
  public getSystemStatus(): any {
    const shardStatuses = this.loadBalancer.getAllShardStatus();
    const totalTPS = shardStatuses.reduce((sum, status) => sum + status.tps, 0);
    const avgLatency = shardStatuses.reduce((sum, status) => sum + status.latency, 0) / shardStatuses.length;
    const avgLoad = shardStatuses.reduce((sum, status) => sum + status.load, 0) / shardStatuses.length;

    return {
      isRunning: this.isRunning,
      totalShards: this.shards.size,
      healthyShards: shardStatuses.filter(s => s.isHealthy).length,
      totalTPS,
      avgLatency,
      avgLoad,
      autoScaling: this.autoScaling,
      shardStatuses
    };
  }

  /**
   * 设置自动扩缩容
   */
  public setAutoScaling(enabled: boolean): void {
    this.autoScaling = enabled;
    console.log(`Auto-scaling ${enabled ? 'enabled' : 'disabled'}`);
  }
}