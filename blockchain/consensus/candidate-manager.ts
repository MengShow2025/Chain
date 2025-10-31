import { ValidatorCandidate, StakingRecord } from '../../shared/types/blockchain.js';
import { CONSENSUS_CONFIG } from '../../shared/constants/blockchain.js';

/**
 * 候补验证节点管理系统
 * 管理最多2000个候补验证节点
 */
export class CandidateManager {
  private candidates: Map<string, ValidatorCandidate> = new Map();
  private stakingRecords: Map<string, StakingRecord[]> = new Map();
  private performanceHistory: Map<string, CandidatePerformance> = new Map();
  private waitingQueue: CandidateQueue[] = [];
  
  // 配置参数
  private readonly MAX_CANDIDATES = 2000;
  private readonly MIN_STAKE = BigInt('1000000000000000000000'); // 1000 tokens
  private readonly PROBATION_PERIOD = 7 * 24 * 60 * 60 * 1000; // 7天
  private readonly PERFORMANCE_EVALUATION_INTERVAL = 24 * 60 * 60 * 1000; // 24小时
  
  // 候选节点状态
  private readonly CANDIDATE_STATUS = {
    PENDING: 'pending',
    ACTIVE: 'active',
    PROBATION: 'probation',
    SUSPENDED: 'suspended',
    BLACKLISTED: 'blacklisted'
  } as const;
  
  constructor() {
    console.log('Initializing Candidate Manager');
    
    // 启动性能评估循环
    this.startPerformanceEvaluation();
    
    // 启动候选节点维护
    this.startCandidateMaintenance();
  }
  
  /**
   * 启动性能评估循环
   */
  private startPerformanceEvaluation(): void {
    setInterval(async () => {
      await this.evaluateAllCandidates();
    }, this.PERFORMANCE_EVALUATION_INTERVAL);
    
    console.log('Performance evaluation cycle started');
  }
  
  /**
   * 启动候选节点维护
   */
  private startCandidateMaintenance(): void {
    setInterval(async () => {
      await this.maintainCandidatePool();
    }, 60 * 60 * 1000); // 每小时执行一次
    
    console.log('Candidate maintenance cycle started');
  }
  
  /**
   * 注册新的候选验证节点
   */
  async registerCandidate(candidateData: {
    address: string;
    publicKey: string;
    stake: bigint;
    commission: number;
    metadata?: any;
  }): Promise<{ success: boolean; reason?: string }> {
    try {
      // 验证基本条件
      const validation = this.validateCandidateRegistration(candidateData);
      if (!validation.valid) {
        return { success: false, reason: validation.reason };
      }
      
      // 检查候选节点池是否已满
      if (this.candidates.size >= this.MAX_CANDIDATES) {
        // 尝试清理不活跃的候选节点
        await this.cleanupInactiveCandidates();
        
        if (this.candidates.size >= this.MAX_CANDIDATES) {
          // 如果新候选节点质押更多，可以替换最低质押的候选节点
          const canReplace = await this.canReplaceLowestCandidate(candidateData.stake);
          if (!canReplace) {
            return { success: false, reason: 'Candidate pool is full and stake is insufficient for replacement' };
          }
          
          await this.replaceLowestCandidate(candidateData);
        }
      }
      
      // 创建候选节点记录
      const candidate: ValidatorCandidate = {
        address: candidateData.address,
        publicKey: candidateData.publicKey,
        stake: candidateData.stake,
        delegatedStake: BigInt(0),
        totalStake: candidateData.stake,
        commission: candidateData.commission,
        registeredAt: Date.now(),
        lastElectionAttempt: 0,
        electionAttempts: 0,
        isEligible: true,
        status: this.CANDIDATE_STATUS.PENDING,
        metadata: candidateData.metadata ?? {
          name: `Candidate ${candidateData.address.slice(0, 8)}`,
          description: 'TitanChain Validator Candidate'
        },
        readinessScore: 75,
        violationHistory: []
      };
      
      this.candidates.set(candidateData.address, candidate);
      
      // 初始化性能记录
      this.performanceHistory.set(candidateData.address, {
        address: candidateData.address,
        registrationTime: Date.now(),
        totalStakeTime: 0,
        averageStake: candidateData.stake,
        uptimeScore: 100,
        networkParticipation: 0,
        delegatorSatisfaction: 100,
        slashingEvents: 0,
        lastEvaluationTime: Date.now(),
        performanceScore: 75 // 初始分数
      });
      
      // 创建初始质押记录
      const stakingRecord: StakingRecord = {
        address: candidateData.address,
        amount: candidateData.stake,
        timestamp: Date.now(),
        type: 'stake',
        blockNumber: 0 // 应该从区块链获取当前区块号
      };
      
      this.stakingRecords.set(candidateData.address, [stakingRecord]);
      
      console.log(`Registered candidate validator ${candidateData.address} with stake ${candidateData.stake}`);
      
      // 启动候选节点监控
      this.startCandidateMonitoring(candidateData.address);
      
      return { success: true };
      
    } catch (error) {
      console.error('Error registering candidate:', error);
      return { success: false, reason: 'Registration failed due to internal error' };
    }
  }
  
  /**
   * 验证候选节点注册条件
   */
  private validateCandidateRegistration(candidateData: any): { valid: boolean; reason?: string } {
    // 检查地址格式
    if (!candidateData.address || !candidateData.address.startsWith('0x')) {
      return { valid: false, reason: 'Invalid address format' };
    }
    
    // 检查是否已经注册
    if (this.candidates.has(candidateData.address)) {
      return { valid: false, reason: 'Address already registered as candidate' };
    }
    
    // 检查最小质押要求
    if (candidateData.stake < this.MIN_STAKE) {
      return { valid: false, reason: `Stake ${candidateData.stake} is below minimum requirement ${this.MIN_STAKE}` };
    }
    
    // 检查佣金率
    if (candidateData.commission < 0 || candidateData.commission > 100) {
      return { valid: false, reason: 'Commission must be between 0 and 100' };
    }
    
    // 检查公钥格式
    if (!candidateData.publicKey || candidateData.publicKey.length < 64) {
      return { valid: false, reason: 'Invalid public key format' };
    }
    
    return { valid: true };
  }
  
  /**
   * 更新候选节点质押
   */
  async updateCandidateStake(address: string, newStake: bigint): Promise<boolean> {
    try {
      const candidate = this.candidates.get(address);
      if (!candidate) {
        console.error(`Candidate ${address} not found`);
        return false;
      }
      
      // 检查最小质押要求
      if (newStake < this.MIN_STAKE) {
        console.error(`New stake ${newStake} is below minimum requirement`);
        return false;
      }
      
      const oldStake = candidate.stake;
      candidate.stake = newStake;
      
      // 记录质押变更
      const stakingRecord: StakingRecord = {
        address,
        amount: newStake - oldStake,
        timestamp: Date.now(),
        type: newStake > oldStake ? 'stake' : 'unstake',
        blockNumber: 0
      };
      
      const records = this.stakingRecords.get(address) || [];
      records.push(stakingRecord);
      this.stakingRecords.set(address, records);
      
      // 更新性能记录中的平均质押
      const performance = this.performanceHistory.get(address);
      if (performance) {
        performance.averageStake = (performance.averageStake + newStake) / BigInt(2);
      }
      
      console.log(`Updated candidate ${address} stake from ${oldStake} to ${newStake}`);
      return true;
      
    } catch (error) {
      console.error('Error updating candidate stake:', error);
      return false;
    }
  }
  
  /**
   * 移除候选节点
   */
  async removeCandidate(address: string, reason: string): Promise<boolean> {
    try {
      const candidate = this.candidates.get(address);
      if (!candidate) {
        console.error(`Candidate ${address} not found`);
        return false;
      }
      
      // 记录移除原因
      candidate.metadata = candidate.metadata ?? {
        name: `Candidate ${candidate.address.slice(0, 8)}`,
        description: 'TitanChain Validator Candidate'
      };
      candidate.metadata.removalReason = reason;
      candidate.metadata.removedAt = Date.now();
      
      // 从活跃候选节点中移除
      this.candidates.delete(address);
      
      // 保留性能历史记录用于分析
      const performance = this.performanceHistory.get(address);
      if (performance) {
        performance.removalReason = reason;
        performance.removedAt = Date.now();
      }
      
      console.log(`Removed candidate ${address}: ${reason}`);
      return true;
      
    } catch (error) {
      console.error('Error removing candidate:', error);
      return false;
    }
  }
  
  /**
   * 评估所有候选节点
   */
  private async evaluateAllCandidates(): Promise<void> {
    console.log('Starting candidate performance evaluation...');
    
    const evaluationPromises = Array.from(this.candidates.keys()).map(address => 
      this.evaluateCandidate(address)
    );
    
    await Promise.allSettled(evaluationPromises);
    
    console.log('Candidate performance evaluation completed');
  }
  
  /**
   * 评估单个候选节点
   */
  private async evaluateCandidate(address: string): Promise<void> {
    try {
      const candidate = this.candidates.get(address);
      const performance = this.performanceHistory.get(address);
      
      if (!candidate || !performance) {
        return;
      }
      
      // 计算运行时间分数
      const uptimeScore = await this.calculateUptimeScore(address);
      
      // 计算网络参与度
      const participationScore = await this.calculateParticipationScore(address);
      
      // 计算委托人满意度
      const satisfactionScore = await this.calculateDelegatorSatisfaction(address);
      
      // 计算质押稳定性
      const stakeStabilityScore = this.calculateStakeStability(address);
      
      // 更新性能记录
      performance.uptimeScore = uptimeScore;
      performance.networkParticipation = participationScore;
      performance.delegatorSatisfaction = satisfactionScore;
      performance.lastEvaluationTime = Date.now();
      
      // 计算综合性能分数
      performance.performanceScore = this.calculateOverallScore({
        uptime: uptimeScore,
        participation: participationScore,
        satisfaction: satisfactionScore,
        stakeStability: stakeStabilityScore,
        slashingPenalty: performance.slashingEvents * 10
      });
      
      // 根据性能调整候选节点状态
      await this.adjustCandidateStatus(address, performance.performanceScore);
      
    } catch (error) {
      console.error(`Error evaluating candidate ${address}:`, error);
    }
  }
  
  /**
   * 计算运行时间分数
   */
  private async calculateUptimeScore(address: string): Promise<number> {
    // 这里应该从实际的监控系统获取数据
    // 模拟计算：基于节点在线时间
    const baseScore = 90;
    const randomVariation = Math.random() * 20 - 10; // -10 到 +10
    return Math.max(0, Math.min(100, baseScore + randomVariation));
  }
  
  /**
   * 计算网络参与度分数
   */
  private async calculateParticipationScore(address: string): Promise<number> {
    // 模拟计算：基于网络活动参与度
    const baseScore = 75;
    const randomVariation = Math.random() * 30 - 15; // -15 到 +15
    return Math.max(0, Math.min(100, baseScore + randomVariation));
  }
  
  /**
   * 计算委托人满意度
   */
  private async calculateDelegatorSatisfaction(address: string): Promise<number> {
    // 模拟计算：基于委托人反馈和奖励分发
    const baseScore = 85;
    const randomVariation = Math.random() * 20 - 10; // -10 到 +10
    return Math.max(0, Math.min(100, baseScore + randomVariation));
  }
  
  /**
   * 计算质押稳定性分数
   */
  private calculateStakeStability(address: string): number {
    const records = this.stakingRecords.get(address) || [];
    
    if (records.length <= 1) {
      return 100; // 新候选节点或稳定质押
    }
    
    // 计算质押变动频率和幅度
    let totalVariation = 0;
    for (let i = 1; i < records.length; i++) {
      const variation = Math.abs(Number(records[i].amount - records[i-1].amount));
      totalVariation += variation;
    }
    
    // 变动越小，稳定性分数越高
    const averageVariation = totalVariation / (records.length - 1);
    const stabilityScore = Math.max(0, 100 - averageVariation / 1000);
    
    return Math.min(100, stabilityScore);
  }
  
  /**
   * 计算综合性能分数
   */
  private calculateOverallScore(scores: {
    uptime: number;
    participation: number;
    satisfaction: number;
    stakeStability: number;
    slashingPenalty: number;
  }): number {
    const weights = {
      uptime: 0.3,
      participation: 0.25,
      satisfaction: 0.2,
      stakeStability: 0.15,
      slashingPenalty: 0.1
    };
    
    const weightedScore = 
      scores.uptime * weights.uptime +
      scores.participation * weights.participation +
      scores.satisfaction * weights.satisfaction +
      scores.stakeStability * weights.stakeStability -
      scores.slashingPenalty * weights.slashingPenalty;
    
    return Math.max(0, Math.min(100, weightedScore));
  }
  
  /**
   * 调整候选节点状态
   */
  private async adjustCandidateStatus(address: string, performanceScore: number): Promise<void> {
    const candidate = this.candidates.get(address);
    if (!candidate) return;
    
    const currentStatus = candidate.status;
    let newStatus = currentStatus;
    
    // 根据性能分数调整状态
    if (performanceScore >= 80) {
      newStatus = this.CANDIDATE_STATUS.ACTIVE;
    } else if (performanceScore >= 60) {
      newStatus = this.CANDIDATE_STATUS.PROBATION;
    } else if (performanceScore >= 40) {
      newStatus = this.CANDIDATE_STATUS.SUSPENDED;
    } else {
      newStatus = this.CANDIDATE_STATUS.BLACKLISTED;
    }
    
    // 更新状态
    if (newStatus !== currentStatus) {
      candidate.status = newStatus;
      console.log(`Candidate ${address} status changed from ${currentStatus} to ${newStatus} (score: ${performanceScore})`);
      
      // 如果被列入黑名单，移除候选节点
      if (newStatus === this.CANDIDATE_STATUS.BLACKLISTED) {
        await this.removeCandidate(address, 'Poor performance - blacklisted');
      }
    }
  }
  
  /**
   * 维护候选节点池
   */
  private async maintainCandidatePool(): Promise<void> {
    console.log('Starting candidate pool maintenance...');
    
    // 清理不活跃的候选节点
    await this.cleanupInactiveCandidates();
    
    // 处理等待队列
    await this.processWaitingQueue();
    
    // 优化候选节点排序
    this.optimizeCandidateRanking();
    
    console.log('Candidate pool maintenance completed');
  }
  
  /**
   * 清理不活跃的候选节点
   */
  private async cleanupInactiveCandidates(): Promise<void> {
    const inactiveThreshold = 30 * 24 * 60 * 60 * 1000; // 30天
    const now = Date.now();
    
    const toRemove: string[] = [];
    
    for (const [address, candidate] of this.candidates) {
      // 检查长期不活跃的候选节点
      if (now - candidate.registeredAt > inactiveThreshold) {
        const performance = this.performanceHistory.get(address);
        if (performance && performance.performanceScore < 50) {
          toRemove.push(address);
        }
      }
      
      // 检查被暂停太久的候选节点
      if (candidate.status === this.CANDIDATE_STATUS.SUSPENDED) {
        if (now - candidate.registeredAt > inactiveThreshold / 2) {
          toRemove.push(address);
        }
      }
    }
    
    // 移除不活跃的候选节点
    for (const address of toRemove) {
      await this.removeCandidate(address, 'Inactive for extended period');
    }
    
    console.log(`Cleaned up ${toRemove.length} inactive candidates`);
  }
  
  /**
   * 处理等待队列
   */
  private async processWaitingQueue(): Promise<void> {
    if (this.waitingQueue.length === 0) return;
    
    const availableSlots = this.MAX_CANDIDATES - this.candidates.size;
    const toProcess = Math.min(availableSlots, this.waitingQueue.length);
    
    for (let i = 0; i < toProcess; i++) {
      const queueItem = this.waitingQueue.shift();
      if (queueItem) {
        await this.registerCandidate(queueItem.candidateData);
      }
    }
    
    console.log(`Processed ${toProcess} candidates from waiting queue`);
  }
  
  /**
   * 优化候选节点排序
   */
  private optimizeCandidateRanking(): void {
    // 创建候选节点排名列表
    const candidateList = Array.from(this.candidates.entries()).map(([address, candidate]) => {
      const performance = this.performanceHistory.get(address);
      return {
        address,
        candidate,
        performanceScore: performance?.performanceScore || 0,
        stake: candidate.stake
      };
    });
    
    // 按性能分数和质押金额排序
    candidateList.sort((a, b) => {
      if (a.performanceScore !== b.performanceScore) {
        return b.performanceScore - a.performanceScore;
      }
      return Number(b.stake - a.stake);
    });
    
    // 更新候选节点的选举优先级
    candidateList.forEach((item, index) => {
      item.candidate.metadata = item.candidate.metadata ?? {
        name: `Candidate ${item.address.slice(0, 8)}`,
        description: 'TitanChain Validator Candidate'
      };
      item.candidate.metadata.ranking = index + 1;
    });
  }
  
  /**
   * 检查是否可以替换最低质押的候选节点
   */
  private async canReplaceLowestCandidate(newStake: bigint): Promise<boolean> {
    let lowestStake = BigInt(Number.MAX_SAFE_INTEGER);
    
    for (const candidate of this.candidates.values()) {
      if (candidate.stake < lowestStake) {
        lowestStake = candidate.stake;
      }
    }
    
    return newStake > lowestStake * BigInt(2); // 新质押必须是最低质押的2倍
  }
  
  /**
   * 替换最低质押的候选节点
   */
  private async replaceLowestCandidate(newCandidateData: any): Promise<void> {
    let lowestStake = BigInt(Number.MAX_SAFE_INTEGER);
    let lowestAddress = '';
    
    for (const [address, candidate] of this.candidates) {
      if (candidate.stake < lowestStake) {
        lowestStake = candidate.stake;
        lowestAddress = address;
      }
    }
    
    if (lowestAddress) {
      await this.removeCandidate(lowestAddress, 'Replaced by higher stake candidate');
      console.log(`Replaced candidate ${lowestAddress} (stake: ${lowestStake}) with new candidate (stake: ${newCandidateData.stake})`);
    }
  }
  
  /**
   * 启动候选节点监控
   */
  private startCandidateMonitoring(address: string): void {
    // 这里可以启动对特定候选节点的监控
    console.log(`Started monitoring for candidate ${address}`);
  }
  
  /**
   * 获取候选节点列表
   */
  getCandidates(): Map<string, ValidatorCandidate> {
    return new Map(this.candidates);
  }
  
  /**
   * 获取候选节点性能历史
   */
  getPerformanceHistory(): Map<string, CandidatePerformance> {
    return new Map(this.performanceHistory);
  }
  
  /**
   * 获取候选节点统计
   */
  getCandidateStats() {
    const statusCounts = {
      pending: 0,
      active: 0,
      probation: 0,
      suspended: 0,
      blacklisted: 0
    };
    
    let totalStake = BigInt(0);
    let averagePerformance = 0;
    
    for (const candidate of this.candidates.values()) {
      statusCounts[candidate.status as keyof typeof statusCounts]++;
      totalStake += candidate.stake;
    }
    
    for (const performance of this.performanceHistory.values()) {
      averagePerformance += performance.performanceScore;
    }
    
    averagePerformance = this.performanceHistory.size > 0 ? 
      averagePerformance / this.performanceHistory.size : 0;
    
    return {
      totalCandidates: this.candidates.size,
      maxCandidates: this.MAX_CANDIDATES,
      utilizationRate: (this.candidates.size / this.MAX_CANDIDATES) * 100,
      statusDistribution: statusCounts,
      totalStake,
      averageStake: this.candidates.size > 0 ? totalStake / BigInt(this.candidates.size) : BigInt(0),
      averagePerformance: Math.round(averagePerformance * 100) / 100,
      waitingQueueSize: this.waitingQueue.length,
      minStakeRequirement: this.MIN_STAKE
    };
  }
  
  /**
   * 获取候选节点排名
   */
  getCandidateRanking(): CandidateRankingItem[] {
    const ranking: CandidateRankingItem[] = [];
    
    for (const [address, candidate] of this.candidates) {
      const performance = this.performanceHistory.get(address);
      ranking.push({
        rank: candidate.metadata?.ranking || 0,
        address,
        stake: candidate.stake,
        performanceScore: performance?.performanceScore || 0,
        status: candidate.status,
        registeredAt: candidate.registeredAt,
        commission: candidate.commission
      });
    }
    
    // 按排名排序
    ranking.sort((a, b) => a.rank - b.rank);
    
    return ranking;
  }
}

// 类型定义
interface CandidatePerformance {
  address: string;
  registrationTime: number;
  totalStakeTime: number;
  averageStake: bigint;
  uptimeScore: number;
  networkParticipation: number;
  delegatorSatisfaction: number;
  slashingEvents: number;
  lastEvaluationTime: number;
  performanceScore: number;
  removalReason?: string;
  removedAt?: number;
}

interface CandidateQueue {
  candidateData: any;
  queuedAt: number;
  priority: number;
}

interface CandidateRankingItem {
  rank: number;
  address: string;
  stake: bigint;
  performanceScore: number;
  status: string;
  registeredAt: number;
  commission: number;
}