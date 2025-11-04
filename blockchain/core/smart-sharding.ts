/**
 * Smart Sharding System for TitanChain
 * Implements dynamic sharding with load balancing and auto-scaling
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';

// Types and Interfaces /类型和接口
export interface ShardInfo {
  id: string;
  nodeId: string;
  capacity: number;
  currentLoad: number;
  status: 'active' | 'inactive' | 'syncing' | 'error';
  lastHeartbeat: number;
  transactions: string[];
  blockHeight: number;
}

export interface CrossShardTransaction {
  id: string;
  fromShard: string;
  toShard: string;
  data: any;
  timestamp: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retryCount: number;
}

export interface ShardingConfig {
  minShards: number;
  maxShards: number;
  targetLoadPerShard: number;
  rebalanceThreshold: number;
  heartbeatInterval: number;
  syncTimeout: number;
  maxRetries: number;
}

export interface HashRingNode {
  id: string;
  hash: string;
  shard: ShardInfo;
  virtualNodes: number;
}

// Consistent Hash Ring Implementation /一致性哈希环实现
export class ConsistentHashRing {
  private ring: Map<string, HashRingNode> = new Map();
  private sortedHashes: string[] = [];
  private virtualNodeCount: number = 150;

  constructor(virtualNodeCount: number = 150) {
    this.virtualNodeCount = virtualNodeCount;
  }

  // Add shard to hash ring /添加分片到哈希环
  addShard(shard: ShardInfo): void {
    for (let i = 0; i < this.virtualNodeCount; i++) {
      const virtualNodeId = `${shard.id}:${i}`;
      const hash = this.hash(virtualNodeId);
      
      const node: HashRingNode = {
        id: virtualNodeId,
        hash,
        shard,
        virtualNodes: this.virtualNodeCount
      };
      
      this.ring.set(hash, node);
    }
    
    this.sortedHashes = Array.from(this.ring.keys()).sort();
  }

  // Remove shard from hash ring /从哈希环移除分片
  removeShard(shardId: string): void {
    const hashesToRemove: string[] = [];
    
    for (const [hash, node] of this.ring.entries()) {
      if (node.shard.id === shardId) {
        hashesToRemove.push(hash);
      }
    }
    
    hashesToRemove.forEach(hash => this.ring.delete(hash));
    this.sortedHashes = Array.from(this.ring.keys()).sort();
  }

  // Get shard for given key /获取给定键的分片
  getShard(key: string): ShardInfo | null {
    if (this.sortedHashes.length === 0) return null;
    
    const keyHash = this.hash(key);
    
    // Find the first hash greater than or equal to keyHash /找到第一个大于等于keyHash的哈希
    let index = this.binarySearch(keyHash);
    if (index === this.sortedHashes.length) {
      index = 0; // Wrap around /环绕
    }
    
    const hash = this.sortedHashes[index];
    const node = this.ring.get(hash);
    
    return node ? node.shard : null;
  }

  // Get all shards /获取所有分片
  getAllShards(): ShardInfo[] {
    const shards = new Map<string, ShardInfo>();
    
    for (const node of this.ring.values()) {
      shards.set(node.shard.id, node.shard);
    }
    
    return Array.from(shards.values());
  }

  private hash(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  private binarySearch(target: string): number {
    let left = 0;
    let right = this.sortedHashes.length;
    
    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (this.sortedHashes[mid] < target) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }
    
    return left;
  }
}

// Load Balancer for Shards /分片负载均衡器
export class ShardLoadBalancer {
  private shards: Map<string, ShardInfo> = new Map();
  private loadHistory: Map<string, number[]> = new Map();
  private readonly historySize = 10;

  // Add shard to load balancer /添加分片到负载均衡器
  addShard(shard: ShardInfo): void {
    this.shards.set(shard.id, shard);
    this.loadHistory.set(shard.id, []);
  }

  // Remove shard from load balancer /从负载均衡器移除分片
  removeShard(shardId: string): void {
    this.shards.delete(shardId);
    this.loadHistory.delete(shardId);
  }

  // Update shard load /更新分片负载
  updateShardLoad(shardId: string, load: number): void {
    const shard = this.shards.get(shardId);
    if (shard) {
      shard.currentLoad = load;
      
      // Update load history /更新负载历史
      const history = this.loadHistory.get(shardId) || [];
      history.push(load);
      
      if (history.length > this.historySize) {
        history.shift();
      }
      
      this.loadHistory.set(shardId, history);
    }
  }

  // Get least loaded shard /获取负载最小的分片
  getLeastLoadedShard(): ShardInfo | null {
    let leastLoaded: ShardInfo | null = null;
    let minLoad = Infinity;

    for (const shard of this.shards.values()) {
      if (shard.status === 'active' && shard.currentLoad < minLoad) {
        minLoad = shard.currentLoad;
        leastLoaded = shard;
      }
    }

    return leastLoaded;
  }

  // Get average load across all shards /获取所有分片的平均负载
  getAverageLoad(): number {
    const activeShards = Array.from(this.shards.values())
      .filter(shard => shard.status === 'active');
    
    if (activeShards.length === 0) return 0;
    
    const totalLoad = activeShards.reduce((sum, shard) => sum + shard.currentLoad, 0);
    return totalLoad / activeShards.length;
  }

  // Check if rebalancing is needed /检查是否需要重新平衡
  needsRebalancing(threshold: number): boolean {
    const activeShards = Array.from(this.shards.values())
      .filter(shard => shard.status === 'active');
    
    if (activeShards.length < 2) return false;
    
    const loads = activeShards.map(shard => shard.currentLoad);
    const maxLoad = Math.max(...loads);
    const minLoad = Math.min(...loads);
    
    return (maxLoad - minLoad) > threshold;
  }
}

// Auto Scaler for Dynamic Shard Management /动态分片管理的自动扩缩容器
export class ShardAutoScaler {
  private config: ShardingConfig;
  private loadBalancer: ShardLoadBalancer;
  private eventEmitter: EventEmitter;

  constructor(config: ShardingConfig, loadBalancer: ShardLoadBalancer) {
    this.config = config;
    this.loadBalancer = loadBalancer;
    this.eventEmitter = new EventEmitter();
  }

  // Check if scaling is needed /检查是否需要扩缩容
  checkScaling(): { action: 'scale_up' | 'scale_down' | 'none'; reason: string } {
    const averageLoad = this.loadBalancer.getAverageLoad();
    const activeShards = this.loadBalancer.getAllShards().filter(s => s.status === 'active');
    
    // Scale up conditions /扩容条件
    if (averageLoad > this.config.targetLoadPerShard && 
        activeShards.length < this.config.maxShards) {
      return {
        action: 'scale_up',
        reason: `Average load ${averageLoad} exceeds target ${this.config.targetLoadPerShard}`
      };
    }
    
    // Scale down conditions /缩容条件
    if (averageLoad < this.config.targetLoadPerShard * 0.5 && 
        activeShards.length > this.config.minShards) {
      return {
        action: 'scale_down',
        reason: `Average load ${averageLoad} is below 50% of target ${this.config.targetLoadPerShard}`
      };
    }
    
    return { action: 'none', reason: 'Load is within acceptable range' };
  }

  // Emit scaling event /发出扩缩容事件
  emitScalingEvent(action: string, reason: string): void {
    this.eventEmitter.emit('scaling', { action, reason, timestamp: Date.now() });
  }

  // Subscribe to scaling events /订阅扩缩容事件
  onScaling(callback: (event: any) => void): void {
    this.eventEmitter.on('scaling', callback);
  }
}

// Cross-Shard Coordinator /跨分片协调器
export class CrossShardCoordinator {
  private pendingTransactions: Map<string, CrossShardTransaction> = new Map();
  private shardManager: ShardManager;
  private eventEmitter: EventEmitter;
  private config: ShardingConfig;

  constructor(shardManager: ShardManager, config: ShardingConfig) {
    this.shardManager = shardManager;
    this.config = config;
    this.eventEmitter = new EventEmitter();
  }

  // Process cross-shard transaction /处理跨分片交易
  async processCrossShardTransaction(transaction: CrossShardTransaction): Promise<boolean> {
    try {
      transaction.status = 'processing';
      this.pendingTransactions.set(transaction.id, transaction);

      // Validate source and destination shards /验证源分片和目标分片
      const fromShard = this.shardManager.getShard(transaction.fromShard);
      const toShard = this.shardManager.getShard(transaction.toShard);

      if (!fromShard || !toShard) {
        throw new Error(`Invalid shard reference: ${transaction.fromShard} -> ${transaction.toShard}`);
      }

      // Execute two-phase commit /执行两阶段提交
      const prepared = await this.prepareTransaction(transaction);
      if (prepared) {
        await this.commitTransaction(transaction);
        transaction.status = 'completed';
        this.eventEmitter.emit('transaction_completed', transaction);
        return true;
      } else {
        await this.abortTransaction(transaction);
        transaction.status = 'failed';
        this.eventEmitter.emit('transaction_failed', transaction);
        return false;
      }
    } catch (error) {
      console.error(`Cross-shard transaction failed: ${error}`);
      transaction.status = 'failed';
      transaction.retryCount++;
      
      if (transaction.retryCount < this.config.maxRetries) {
        // Retry after delay /延迟后重试
        setTimeout(() => {
          this.processCrossShardTransaction(transaction);
        }, 1000 * Math.pow(2, transaction.retryCount));
      }
      
      return false;
    } finally {
      this.pendingTransactions.delete(transaction.id);
    }
  }

  private async prepareTransaction(transaction: CrossShardTransaction): Promise<boolean> {
    // Simulate preparation phase /模拟准备阶段
    console.log(`Preparing cross-shard transaction ${transaction.id}`);
    return true;
  }

  private async commitTransaction(transaction: CrossShardTransaction): Promise<void> {
    // Simulate commit phase /模拟提交阶段
    console.log(`Committing cross-shard transaction ${transaction.id}`);
  }

  private async abortTransaction(transaction: CrossShardTransaction): Promise<void> {
    // Simulate abort phase /模拟中止阶段
    console.log(`Aborting cross-shard transaction ${transaction.id}`);
  }

  // Get pending transactions /获取待处理交易
  getPendingTransactions(): CrossShardTransaction[] {
    return Array.from(this.pendingTransactions.values());
  }

  // Subscribe to transaction events /订阅交易事件
  onTransactionEvent(event: string, callback: (transaction: CrossShardTransaction) => void): void {
    this.eventEmitter.on(event, callback);
  }
}

// Main Shard Manager /主分片管理器
export class ShardManager {
  private shards: Map<string, ShardInfo> = new Map();
  private hashRing: ConsistentHashRing;
  private loadBalancer: ShardLoadBalancer;
  private autoScaler: ShardAutoScaler;
  private crossShardCoordinator: CrossShardCoordinator;
  private config: ShardingConfig;
  private eventEmitter: EventEmitter;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(config: ShardingConfig) {
    this.config = config;
    this.hashRing = new ConsistentHashRing();
    this.loadBalancer = new ShardLoadBalancer();
    this.autoScaler = new ShardAutoScaler(config, this.loadBalancer);
    this.crossShardCoordinator = new CrossShardCoordinator(this, config);
    this.eventEmitter = new EventEmitter();
  }

  // Initialize shard manager /初始化分片管理器
  async initialize(): Promise<void> {
    console.log('Initializing Smart Sharding System...');
    
    // Create initial shards /创建初始分片
    for (let i = 0; i < this.config.minShards; i++) {
      await this.createShard(`shard-${i}`, `node-${i}`);
    }

    // Start heartbeat monitoring /启动心跳监控
    this.startHeartbeatMonitoring();

    // Setup auto-scaling /设置自动扩缩容
    this.setupAutoScaling();

    console.log(`Smart Sharding System initialized with ${this.config.minShards} shards`);
  }

  // Create new shard /创建新分片
  async createShard(shardId: string, nodeId: string): Promise<ShardInfo> {
    const shard: ShardInfo = {
      id: shardId,
      nodeId,
      capacity: 1000,
      currentLoad: 0,
      status: 'active',
      lastHeartbeat: Date.now(),
      transactions: [],
      blockHeight: 0
    };

    this.shards.set(shardId, shard);
    this.hashRing.addShard(shard);
    this.loadBalancer.addShard(shard);

    this.eventEmitter.emit('shard_created', shard);
    console.log(`Created shard: ${shardId} on node: ${nodeId}`);

    return shard;
  }

  // Remove shard /移除分片
  async removeShard(shardId: string): Promise<boolean> {
    const shard = this.shards.get(shardId);
    if (!shard) return false;

    // Migrate data before removal /移除前迁移数据
    await this.migrateShard(shardId);

    this.shards.delete(shardId);
    this.hashRing.removeShard(shardId);
    this.loadBalancer.removeShard(shardId);

    this.eventEmitter.emit('shard_removed', shard);
    console.log(`Removed shard: ${shardId}`);

    return true;
  }

  // Get shard by ID /通过ID获取分片
  getShard(shardId: string): ShardInfo | undefined {
    return this.shards.get(shardId);
  }

  // Get shard for transaction /获取交易的分片
  getShardForTransaction(transactionId: string): ShardInfo | null {
    return this.hashRing.getShard(transactionId);
  }

  // Get all shards /获取所有分片
  getAllShards(): ShardInfo[] {
    return Array.from(this.shards.values());
  }

  // Update shard status /更新分片状态
  updateShardStatus(shardId: string, status: ShardInfo['status']): void {
    const shard = this.shards.get(shardId);
    if (shard) {
      shard.status = status;
      shard.lastHeartbeat = Date.now();
      this.eventEmitter.emit('shard_status_updated', shard);
    }
  }

  // Process transaction /处理交易
  async processTransaction(transactionId: string, transactionData: any): Promise<boolean> {
    const shard = this.getShardForTransaction(transactionId);
    if (!shard) {
      console.error(`No shard available for transaction: ${transactionId}`);
      return false;
    }

    // Add transaction to shard /将交易添加到分片
    shard.transactions.push(transactionId);
    shard.currentLoad++;

    // Update load balancer /更新负载均衡器
    this.loadBalancer.updateShardLoad(shard.id, shard.currentLoad);

    console.log(`Transaction ${transactionId} assigned to shard ${shard.id}`);
    return true;
  }

  // Process cross-shard transaction /处理跨分片交易
  async processCrossShardTransaction(fromShardId: string, toShardId: string, transactionData: any): Promise<boolean> {
    const transaction: CrossShardTransaction = {
      id: crypto.randomUUID(),
      fromShard: fromShardId,
      toShard: toShardId,
      data: transactionData,
      timestamp: Date.now(),
      status: 'pending',
      retryCount: 0
    };

    return await this.crossShardCoordinator.processCrossShardTransaction(transaction);
  }

  // Migrate shard data /迁移分片数据
  private async migrateShard(shardId: string): Promise<void> {
    const shard = this.shards.get(shardId);
    if (!shard) return;

    console.log(`Migrating data from shard: ${shardId}`);
    
    // Find target shards for migration /找到迁移的目标分片
    const activeShards = Array.from(this.shards.values())
      .filter(s => s.id !== shardId && s.status === 'active');

    if (activeShards.length === 0) {
      console.error('No active shards available for migration');
      return;
    }

    // Redistribute transactions /重新分配交易
    for (const transactionId of shard.transactions) {
      const targetShard = this.hashRing.getShard(transactionId);
      if (targetShard && targetShard.id !== shardId) {
        targetShard.transactions.push(transactionId);
        targetShard.currentLoad++;
      }
    }

    console.log(`Migration completed for shard: ${shardId}`);
  }

  // Start heartbeat monitoring /启动心跳监控
  private startHeartbeatMonitoring(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      
      for (const shard of this.shards.values()) {
        if (now - shard.lastHeartbeat > this.config.heartbeatInterval * 2) {
          console.warn(`Shard ${shard.id} missed heartbeat`);
          shard.status = 'error';
          this.eventEmitter.emit('shard_heartbeat_missed', shard);
        }
      }
    }, this.config.heartbeatInterval);
  }

  // Setup auto-scaling /设置自动扩缩容
  private setupAutoScaling(): void {
    this.autoScaler.onScaling(async (event) => {
      console.log(`Auto-scaling event: ${event.action} - ${event.reason}`);
      
      if (event.action === 'scale_up') {
        const newShardId = `shard-${Date.now()}`;
        const newNodeId = `node-${Date.now()}`;
        await this.createShard(newShardId, newNodeId);
      } else if (event.action === 'scale_down') {
        const shards = this.getAllShards().filter(s => s.status === 'active');
        if (shards.length > this.config.minShards) {
          const leastLoadedShard = shards.reduce((min, shard) => 
            shard.currentLoad < min.currentLoad ? shard : min
          );
          await this.removeShard(leastLoadedShard.id);
        }
      }
    });

    // Check scaling every 30 seconds /每30秒检查一次扩缩容
    setInterval(() => {
      const scalingDecision = this.autoScaler.checkScaling();
      if (scalingDecision.action !== 'none') {
        this.autoScaler.emitScalingEvent(scalingDecision.action, scalingDecision.reason);
      }
    }, 30000);
  }

  // Get system statistics /获取系统统计信息
  getStatistics(): any {
    const shards = this.getAllShards();
    const activeShards = shards.filter(s => s.status === 'active');
    
    return {
      totalShards: shards.length,
      activeShards: activeShards.length,
      averageLoad: this.loadBalancer.getAverageLoad(),
      totalTransactions: shards.reduce((sum, s) => sum + s.transactions.length, 0),
      pendingCrossShardTransactions: this.crossShardCoordinator.getPendingTransactions().length,
      systemHealth: activeShards.length >= this.config.minShards ? 'healthy' : 'degraded'
    };
  }

  // Subscribe to events /订阅事件
  on(event: string, callback: (...args: any[]) => void): void {
    this.eventEmitter.on(event, callback);
  }

  // Cleanup resources /清理资源
  async shutdown(): Promise<void> {
    console.log('Shutting down Smart Sharding System...');
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Gracefully shutdown all shards /优雅关闭所有分片
    for (const shard of this.shards.values()) {
      shard.status = 'inactive';
    }

    console.log('Smart Sharding System shutdown complete');
  }
}

// Default configuration /默认配置
export const DEFAULT_SHARDING_CONFIG: ShardingConfig = {
  minShards: 3,
  maxShards: 10,
  targetLoadPerShard: 100,
  rebalanceThreshold: 50,
  heartbeatInterval: 5000,
  syncTimeout: 30000,
  maxRetries: 3
};

// Factory function to create shard manager /创建分片管理器的工厂函数
export function createShardManager(config: Partial<ShardingConfig> = {}): ShardManager {
  const finalConfig = { ...DEFAULT_SHARDING_CONFIG, ...config };
  return new ShardManager(finalConfig);
}

export default ShardManager;