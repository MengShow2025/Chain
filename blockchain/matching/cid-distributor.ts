import { BatchCommit } from '../../shared/types/blockchain.js';

/**
 * CID分发状态
 */
interface DistributionStatus {
  cid: string;
  status: 'pending' | 'distributing' | 'completed' | 'failed';
  startTime: number;
  completedPeers: string[];
  failedPeers: string[];
  totalPeers: number;
  retryCount: number;
}

/**
 * 对等节点信息
 */
interface PeerInfo {
  id: string;
  address: string;
  port: number;
  status: 'online' | 'offline' | 'unreachable';
  lastSeen: number;
  latency: number;
}

/**
 * 分发配置
 */
interface DistributionConfig {
  maxRetries: number;
  timeoutMs: number;
  batchSize: number;
  minPeers: number;
  maxConcurrentDistributions: number;
}

/**
 * CID分发器
 * 负责将批次承诺和数据分发到网络中的其他节点
 */
export class CIDDistributor {
  private peers: Map<string, PeerInfo> = new Map();
  private distributionQueue: DistributionStatus[] = [];
  private activeDistributions: Map<string, DistributionStatus> = new Map();
  private config: DistributionConfig;
  private isRunning = false;
  private processingInterval: NodeJS.Timeout | null = null;
  
  constructor(config?: Partial<DistributionConfig>) {
    this.config = {
      maxRetries: 3,
      timeoutMs: 5000,
      batchSize: 10,
      minPeers: 3,
      maxConcurrentDistributions: 5,
      ...config
    };
    
    this.initializePeers();
    this.startProcessing();
    console.log('CIDDistributor initialized');
  }

  /**
   * 初始化对等节点列表
   */
  private initializePeers(): void {
    // 模拟一些对等节点
    const mockPeers: PeerInfo[] = [
      { id: 'peer-1', address: '192.168.1.101', port: 4010, status: 'online', lastSeen: Date.now(), latency: 50 },
      { id: 'peer-2', address: '192.168.1.102', port: 4010, status: 'online', lastSeen: Date.now(), latency: 75 },
      { id: 'peer-3', address: '192.168.1.103', port: 4010, status: 'online', lastSeen: Date.now(), latency: 60 },
      { id: 'peer-4', address: '192.168.1.104', port: 4010, status: 'online', lastSeen: Date.now(), latency: 80 },
      { id: 'peer-5', address: '192.168.1.105', port: 4010, status: 'online', lastSeen: Date.now(), latency: 45 }
    ];
    
    for (const peer of mockPeers) {
      this.peers.set(peer.id, peer);
    }
    
    console.log(`Initialized ${mockPeers.length} peers`);
  }

  /**
   * 开始处理分发队列
   */
  private startProcessing(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.processingInterval = setInterval(() => {
      this.processDistributionQueue().catch(error => {
        console.error('Distribution processing error:', error);
      });
    }, 1000); // 每秒检查一次
  }

  /**
   * 停止处理
   */
  public stop(): void {
    this.isRunning = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  /**
   * 分发CID和批次承诺
   */
  public async distribute(cid: string, batchCommit: BatchCommit): Promise<void> {
    try {
      // 检查是否已经在分发中
      if (this.activeDistributions.has(cid)) {
        console.warn(`CID ${cid} is already being distributed`);
        return;
      }
      
      // 创建分发状态
      const distributionStatus: DistributionStatus = {
        cid,
        status: 'pending',
        startTime: Date.now(),
        completedPeers: [],
        failedPeers: [],
        totalPeers: this.getOnlinePeers().length,
        retryCount: 0
      };
      
      // 添加到队列
      this.distributionQueue.push(distributionStatus);
      
      console.log(`CID ${cid} added to distribution queue`);
    } catch (error) {
      console.error(`Failed to queue CID ${cid} for distribution:`, error);
      throw error;
    }
  }

  /**
   * 处理分发队列
   */
  private async processDistributionQueue(): Promise<void> {
    // 检查是否达到最大并发分发数
    if (this.activeDistributions.size >= this.config.maxConcurrentDistributions) {
      return;
    }
    
    // 从队列中取出待分发的项目
    const pendingDistribution = this.distributionQueue.find(d => d.status === 'pending');
    if (!pendingDistribution) {
      return;
    }
    
    // 开始分发
    pendingDistribution.status = 'distributing';
    this.activeDistributions.set(pendingDistribution.cid, pendingDistribution);
    
    try {
      await this.executeDistribution(pendingDistribution);
    } catch (error) {
      console.error(`Distribution failed for CID ${pendingDistribution.cid}:`, error);
      pendingDistribution.status = 'failed';
    }
    
    // 从活跃分发中移除
    this.activeDistributions.delete(pendingDistribution.cid);
    
    // 从队列中移除已完成的分发
    this.distributionQueue = this.distributionQueue.filter(d => d.cid !== pendingDistribution.cid);
  }

  /**
   * 执行分发
   */
  private async executeDistribution(distribution: DistributionStatus): Promise<void> {
    const onlinePeers = this.getOnlinePeers();
    
    if (onlinePeers.length < this.config.minPeers) {
      throw new Error(`Insufficient online peers: ${onlinePeers.length} < ${this.config.minPeers}`);
    }
    
    // 按延迟排序，优先选择低延迟节点
    const sortedPeers = onlinePeers.sort((a, b) => a.latency - b.latency);
    
    // 分批分发
    const batches = this.chunkArray(sortedPeers, this.config.batchSize);
    
    for (const batch of batches) {
      const promises = batch.map(peer => this.distributeToPeer(distribution.cid, peer));
      
      try {
        const results = await Promise.allSettled(promises);
        
        // 处理结果
        results.forEach((result, index) => {
          const peer = batch[index];
          if (result.status === 'fulfilled') {
            distribution.completedPeers.push(peer.id);
            console.log(`CID ${distribution.cid} distributed to peer ${peer.id}`);
          } else {
            distribution.failedPeers.push(peer.id);
            console.warn(`Failed to distribute CID ${distribution.cid} to peer ${peer.id}:`, result.reason);
          }
        });
        
      } catch (error) {
        console.error(`Batch distribution failed for CID ${distribution.cid}:`, error);
      }
    }
    
    // 检查分发结果
    const successRate = distribution.completedPeers.length / distribution.totalPeers;
    
    if (successRate >= 0.7) { // 70%成功率认为分发成功
      distribution.status = 'completed';
      console.log(`CID ${distribution.cid} distribution completed: ${distribution.completedPeers.length}/${distribution.totalPeers} peers`);
    } else if (distribution.retryCount < this.config.maxRetries) {
      // 重试失败的节点
      distribution.retryCount++;
      distribution.status = 'pending';
      console.log(`Retrying CID ${distribution.cid} distribution (attempt ${distribution.retryCount})`);
    } else {
      distribution.status = 'failed';
      console.error(`CID ${distribution.cid} distribution failed after ${this.config.maxRetries} retries`);
    }
  }

  /**
   * 向单个对等节点分发
   */
  private async distributeToPeer(cid: string, peer: PeerInfo): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Distribution to peer ${peer.id} timed out`));
      }, this.config.timeoutMs);
      
      try {
        // 模拟网络分发
        // 在实际实现中，这里应该是真实的网络请求
        setTimeout(() => {
          clearTimeout(timeout);
          
          // 模拟90%的成功率
          if (Math.random() > 0.1) {
            resolve();
          } else {
            reject(new Error(`Network error distributing to peer ${peer.id}`));
          }
        }, peer.latency + Math.random() * 100);
        
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * 获取在线对等节点
   */
  private getOnlinePeers(): PeerInfo[] {
    return Array.from(this.peers.values()).filter(peer => peer.status === 'online');
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
   * 添加对等节点
   */
  public addPeer(peer: PeerInfo): void {
    this.peers.set(peer.id, peer);
    console.log(`Peer added: ${peer.id} (${peer.address}:${peer.port})`);
  }

  /**
   * 移除对等节点
   */
  public removePeer(peerId: string): void {
    if (this.peers.delete(peerId)) {
      console.log(`Peer removed: ${peerId}`);
    }
  }

  /**
   * 更新对等节点状态
   */
  public updatePeerStatus(peerId: string, status: 'online' | 'offline' | 'unreachable'): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.status = status;
      peer.lastSeen = Date.now();
      console.log(`Peer ${peerId} status updated to ${status}`);
    }
  }

  /**
   * 获取分发统计信息
   */
  public getStats(): any {
    const onlinePeers = this.getOnlinePeers();
    const totalDistributions = this.distributionQueue.length + this.activeDistributions.size;
    
    return {
      totalPeers: this.peers.size,
      onlinePeers: onlinePeers.length,
      queuedDistributions: this.distributionQueue.length,
      activeDistributions: this.activeDistributions.size,
      totalDistributions,
      config: this.config,
      isRunning: this.isRunning
    };
  }

  /**
   * 获取分发状态
   */
  public getDistributionStatus(cid: string): DistributionStatus | null {
    // 检查活跃分发
    const active = this.activeDistributions.get(cid);
    if (active) {
      return active;
    }
    
    // 检查队列中的分发
    return this.distributionQueue.find(d => d.cid === cid) || null;
  }

  /**
   * 获取所有对等节点信息
   */
  public getPeers(): PeerInfo[] {
    return Array.from(this.peers.values());
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    this.stop();
    this.peers.clear();
    this.distributionQueue = [];
    this.activeDistributions.clear();
    console.log('CIDDistributor cleaned up');
  }
}