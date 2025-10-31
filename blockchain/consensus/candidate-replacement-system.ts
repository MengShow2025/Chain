import { 
  Validator, 
  ValidatorCandidate, 
  RewardTransfer, 
  ValidatorTransition,
  RandomSelectionResult
} from '../../shared/types/blockchain.js';
import { VRFRandomSelector } from './vrf-random-selector.js';
import { ViolationDetector } from './violation-detector.js';

/**
 * 候选节点随机补充系统
 * 负责管理验证节点的替换流程，包括违规节点的踢出和候选节点的随机选择
 */
export class CandidateReplacementSystem {
  private vrfSelector: VRFRandomSelector;
  private violationDetector: ViolationDetector;
  private activeValidators: Map<string, Validator> = new Map();
  private candidateNodes: Map<string, ValidatorCandidate> = new Map();
  private pendingTransitions: Map<string, ValidatorTransition> = new Map();
  private rewardTransferCallback?: (transfer: RewardTransfer) => Promise<void>;
  private validatorUpdateCallback?: (validator: Validator, action: 'add' | 'remove' | 'update') => Promise<void>;
  
  // 系统配置
  private readonly CONFIG = {
    MAX_ACTIVE_VALIDATORS: 108,
    MIN_CANDIDATE_POOL_SIZE: 50,
    REPLACEMENT_COOLDOWN: 5 * 60 * 1000, // 5分钟冷却时间
    MAX_SIMULTANEOUS_REPLACEMENTS: 5,
    TRANSITION_TIMEOUT: 30 * 60 * 1000, // 30分钟过渡超时
    MIN_STAKE_REQUIREMENT: BigInt('10000000000000000000000'), // 10,000 TTN
    GEOGRAPHIC_DISTRIBUTION_LIMIT: 3 // 每个地区最多3个节点
  };
  
  constructor(vrfPrivateKey?: Buffer) {
    this.vrfSelector = new VRFRandomSelector(vrfPrivateKey);
    this.violationDetector = new ViolationDetector();
    
    // 设置违规检测器的回调
    this.violationDetector.setKickValidatorCallback(
      (address: string, reason: string) => this.handleValidatorKick(address, reason)
    );
    
    console.log('Candidate Replacement System initialized');
    this.startPeriodicMaintenance();
  }
  
  /**
   * 设置奖励转移回调
   */
  setRewardTransferCallback(callback: (transfer: RewardTransfer) => Promise<void>): void {
    this.rewardTransferCallback = callback;
  }
  
  /**
   * 设置验证节点更新回调
   */
  setValidatorUpdateCallback(callback: (validator: Validator, action: 'add' | 'remove' | 'update') => Promise<void>): void {
    this.validatorUpdateCallback = callback;
  }
  
  /**
   * 启动定期维护
   */
  private startPeriodicMaintenance(): void {
    // 每分钟检查待处理的过渡
    setInterval(() => {
      this.processPendingTransitions();
    }, 60 * 1000);
    
    // 每10分钟检查候选节点池
    setInterval(() => {
      this.maintainCandidatePool();
    }, 10 * 60 * 1000);
    
    // 每小时进行系统健康检查
    setInterval(() => {
      this.performSystemHealthCheck();
    }, 60 * 60 * 1000);
    
    console.log('Periodic maintenance started');
  }
  
  /**
   * 处理验证节点被踢出的情况
   */
  private async handleValidatorKick(address: string, reason: string): Promise<void> {
    console.log(`Processing validator kick: ${address} - ${reason}`);
    
    const validator = this.activeValidators.get(address);
    if (!validator) {
      console.warn(`Validator ${address} not found in active set`);
      return;
    }
    
    try {
      // 立即从活跃验证节点中移除
      this.activeValidators.delete(address);
      
      // 通知外部系统
      if (this.validatorUpdateCallback) {
        await this.validatorUpdateCallback(validator, 'remove');
      }
      
      // 选择替换节点
      const replacement = await this.selectReplacementCandidate(address);
      
      if (replacement) {
        await this.initiateValidatorTransition(validator, replacement, reason);
      } else {
        console.error(`No suitable replacement found for kicked validator ${address}`);
        // 记录紧急情况，可能需要人工干预
        await this.handleEmergencyShortage();
      }
      
    } catch (error) {
      console.error(`Error handling validator kick for ${address}:`, error);
    }
  }
  
  /**
   * 选择替换候选节点
   */
  private async selectReplacementCandidate(
    kickedValidatorAddress: string,
    additionalExclusions: string[] = []
  ): Promise<ValidatorCandidate | null> {
    const eligibleCandidates = this.getEligibleCandidates();
    
    if (eligibleCandidates.length === 0) {
      console.warn('No eligible candidates available for replacement');
      return null;
    }
    
    // 排除被踢出的验证节点和其他指定排除的地址
    const excludeAddresses = [kickedValidatorAddress, ...additionalExclusions];
    
    // 获取当前区块信息用于随机选择
    const blockHash = await this.getCurrentBlockHash();
    const timestamp = Date.now();
    
    try {
      const selectedCandidate = await this.vrfSelector.selectSingleCandidate(
        eligibleCandidates,
        blockHash,
        timestamp,
        excludeAddresses,
        `replacement_for_${kickedValidatorAddress}`
      );
      
      if (selectedCandidate) {
        console.log(`Selected replacement candidate: ${selectedCandidate.address}`);
      }
      
      return selectedCandidate;
    } catch (error) {
      console.error('Error selecting replacement candidate:', error);
      return null;
    }
  }
  
  /**
   * 获取合格的候选节点
   */
  private getEligibleCandidates(): ValidatorCandidate[] {
    const candidates: ValidatorCandidate[] = [];
    
    for (const candidate of this.candidateNodes.values()) {
      if (this.isCandidateEligible(candidate)) {
        candidates.push(candidate);
      }
    }
    
    return candidates;
  }
  
  /**
   * 检查候选节点是否合格
   */
  private isCandidateEligible(candidate: ValidatorCandidate): boolean {
    // 检查最小质押要求
    if (candidate.stakeAmount < this.CONFIG.MIN_STAKE_REQUIREMENT) {
      return false;
    }
    
    // 检查是否已经是活跃验证节点
    if (this.activeValidators.has(candidate.address)) {
      return false;
    }
    
    // 检查是否在过渡中
    if (this.pendingTransitions.has(candidate.address)) {
      return false;
    }
    
    // 检查违规历史
    const recentViolations = this.violationDetector.getRecentViolations(candidate.address);
    if (recentViolations.length > 0) {
      return false;
    }
    
    // 检查地理分布限制
    if (!this.checkGeographicDistribution(candidate)) {
      return false;
    }
    
    return true;
  }
  
  /**
   * 检查地理分布限制
   */
  private checkGeographicDistribution(candidate: ValidatorCandidate): boolean {
    const candidateLocation = candidate.metadata?.location || 'UNKNOWN';
    
    // 统计当前活跃验证节点的地理分布
    const locationCounts = new Map<string, number>();
    for (const validator of this.activeValidators.values()) {
      const location = validator.metadata?.location || 'UNKNOWN';
      locationCounts.set(location, (locationCounts.get(location) || 0) + 1);
    }
    
    const currentCount = locationCounts.get(candidateLocation) || 0;
    return currentCount < this.CONFIG.GEOGRAPHIC_DISTRIBUTION_LIMIT;
  }
  
  /**
   * 启动验证节点过渡
   */
  private async initiateValidatorTransition(
    oldValidator: Validator,
    newCandidate: ValidatorCandidate,
    reason: string
  ): Promise<void> {
    const transitionId = `${oldValidator.address}_to_${newCandidate.address}_${Date.now()}`;
    
    const transition: ValidatorTransition = {
      id: transitionId,
      oldValidatorAddress: oldValidator.address,
      newValidatorAddress: newCandidate.address,
      reason,
      startTime: Date.now(),
      status: 'pending',
      rewardTransfer: {
        fromAddress: oldValidator.address,
        toAddress: newCandidate.address,
        amount: oldValidator.stakeAmount,
        timestamp: Date.now(),
        transactionHash: '',
        status: 'pending'
      }
    };
    
    this.pendingTransitions.set(transitionId, transition);
    
    console.log(`Initiated validator transition: ${transitionId}`);
    
    try {
      // 执行奖励和权益转移
      await this.executeRewardTransfer(transition.rewardTransfer);
      
      // 创建新的验证节点
      const newValidator = this.createValidatorFromCandidate(newCandidate);
      
      // 添加到活跃验证节点集合
      this.activeValidators.set(newValidator.address, newValidator);
      
      // 从候选节点池中移除
      this.candidateNodes.delete(newCandidate.address);
      
      // 通知外部系统
      if (this.validatorUpdateCallback) {
        await this.validatorUpdateCallback(newValidator, 'add');
      }
      
      // 更新过渡状态
      transition.status = 'completed';
      transition.endTime = Date.now();
      
      console.log(`Validator transition completed: ${transitionId}`);
      
    } catch (error) {
      console.error(`Error during validator transition ${transitionId}:`, error);
      transition.status = 'failed';
      transition.error = error instanceof Error ? error.message : 'Unknown error';
    }
  }
  
  /**
   * 执行奖励转移
   */
  private async executeRewardTransfer(transfer: RewardTransfer): Promise<void> {
    if (this.rewardTransferCallback) {
      await this.rewardTransferCallback(transfer);
      transfer.status = 'completed';
      transfer.transactionHash = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    } else {
      console.warn('No reward transfer callback configured');
      transfer.status = 'failed';
    }
  }
  
  /**
   * 从候选节点创建验证节点
   */
  private createValidatorFromCandidate(candidate: ValidatorCandidate): Validator {
    return {
      address: candidate.address,
      publicKey: candidate.publicKey,
      stakeAmount: candidate.stakeAmount,
      status: 'active',
      joinedAt: Date.now(),
      lastActiveBlock: 0,
      performance: candidate.performance || {
        uptime: 100,
        blocksProduced: 0,
        blocksMissed: 0,
        averageResponseTime: 0,
        slashingCount: 0,
        lastSlashingTime: 0
      },
      metadata: candidate.metadata
    };
  }
  
  /**
   * 处理待处理的过渡
   */
  private async processPendingTransitions(): Promise<void> {
    const now = Date.now();
    
    for (const [transitionId, transition] of this.pendingTransitions) {
      // 检查超时的过渡
      if (transition.status === 'pending' && 
          now - transition.startTime > this.CONFIG.TRANSITION_TIMEOUT) {
        
        console.warn(`Transition ${transitionId} timed out`);
        transition.status = 'failed';
        transition.error = 'Transition timeout';
        transition.endTime = now;
      }
      
      // 清理已完成或失败的过渡
      if (transition.status === 'completed' || transition.status === 'failed') {
        this.pendingTransitions.delete(transitionId);
      }
    }
  }
  
  /**
   * 维护候选节点池
   */
  private async maintainCandidatePool(): Promise<void> {
    const eligibleCount = this.getEligibleCandidates().length;
    
    if (eligibleCount < this.CONFIG.MIN_CANDIDATE_POOL_SIZE) {
      console.warn(`Candidate pool size (${eligibleCount}) below minimum (${this.CONFIG.MIN_CANDIDATE_POOL_SIZE})`);
      // 这里可以触发候选节点招募流程
      await this.triggerCandidateRecruitment();
    }
    
    // 清理不合格的候选节点
    await this.cleanupIneligibleCandidates();
  }
  
  /**
   * 触发候选节点招募
   */
  private async triggerCandidateRecruitment(): Promise<void> {
    console.log('Triggering candidate recruitment process');
    // 这里可以实现候选节点招募逻辑
    // 例如：降低质押要求、发送招募通知等
  }
  
  /**
   * 清理不合格的候选节点
   */
  private async cleanupIneligibleCandidates(): Promise<void> {
    const toRemove: string[] = [];
    
    for (const [address, candidate] of this.candidateNodes) {
      if (!this.isCandidateEligible(candidate)) {
        toRemove.push(address);
      }
    }
    
    for (const address of toRemove) {
      this.candidateNodes.delete(address);
      console.log(`Removed ineligible candidate: ${address}`);
    }
  }
  
  /**
   * 执行系统健康检查
   */
  private async performSystemHealthCheck(): Promise<void> {
    const activeCount = this.activeValidators.size;
    const candidateCount = this.candidateNodes.size;
    const pendingCount = this.pendingTransitions.size;
    
    console.log(`System Health Check - Active: ${activeCount}, Candidates: ${candidateCount}, Pending: ${pendingCount}`);
    
    // 检查活跃验证节点数量
    if (activeCount < this.CONFIG.MAX_ACTIVE_VALIDATORS * 0.9) {
      console.warn(`Active validator count (${activeCount}) below 90% of target`);
      await this.handleValidatorShortage();
    }
    
    // 检查候选节点池
    const eligibleCandidates = this.getEligibleCandidates().length;
    if (eligibleCandidates < this.CONFIG.MIN_CANDIDATE_POOL_SIZE) {
      console.warn(`Eligible candidate count (${eligibleCandidates}) below minimum`);
    }
    
    // 检查地理分布
    await this.checkGeographicDistributionHealth();
  }
  
  /**
   * 处理验证节点短缺
   */
  private async handleValidatorShortage(): Promise<void> {
    console.log('Handling validator shortage');
    
    const needed = this.CONFIG.MAX_ACTIVE_VALIDATORS - this.activeValidators.size;
    const eligibleCandidates = this.getEligibleCandidates();
    
    if (eligibleCandidates.length === 0) {
      await this.handleEmergencyShortage();
      return;
    }
    
    const toPromote = Math.min(needed, eligibleCandidates.length, this.CONFIG.MAX_SIMULTANEOUS_REPLACEMENTS);
    
    try {
      const blockHash = await this.getCurrentBlockHash();
      const result = await this.vrfSelector.selectMultipleCandidates(
        eligibleCandidates,
        toPromote,
        blockHash,
        Date.now(),
        {
          minStake: this.CONFIG.MIN_STAKE_REQUIREMENT,
          maxSameLocation: this.CONFIG.GEOGRAPHIC_DISTRIBUTION_LIMIT
        }
      );
      
      for (const candidate of result.selectedCandidates) {
        const newValidator = this.createValidatorFromCandidate(candidate);
        this.activeValidators.set(newValidator.address, newValidator);
        this.candidateNodes.delete(candidate.address);
        
        if (this.validatorUpdateCallback) {
          await this.validatorUpdateCallback(newValidator, 'add');
        }
        
        console.log(`Promoted candidate to validator: ${candidate.address}`);
      }
      
    } catch (error) {
      console.error('Error handling validator shortage:', error);
    }
  }
  
  /**
   * 处理紧急短缺情况
   */
  private async handleEmergencyShortage(): Promise<void> {
    console.error('EMERGENCY: Critical validator shortage detected');
    // 这里可以实现紧急措施，如：
    // 1. 降低候选节点要求
    // 2. 发送紧急通知
    // 3. 暂停某些网络功能
    // 4. 启动应急验证节点
  }
  
  /**
   * 检查地理分布健康状况
   */
  private async checkGeographicDistributionHealth(): Promise<void> {
    const locationCounts = new Map<string, number>();
    
    for (const validator of this.activeValidators.values()) {
      const location = validator.metadata?.location || 'UNKNOWN';
      locationCounts.set(location, (locationCounts.get(location) || 0) + 1);
    }
    
    // 检查是否有地区过度集中
    for (const [location, count] of locationCounts) {
      const percentage = (count / this.activeValidators.size) * 100;
      if (percentage > 30) { // 超过30%集中在一个地区
        console.warn(`Geographic concentration risk: ${location} has ${percentage.toFixed(1)}% of validators`);
      }
    }
  }
  
  /**
   * 获取当前区块哈希
   */
  private async getCurrentBlockHash(): Promise<string> {
    // 这里应该从区块链获取最新区块哈希
    // 简化实现，使用时间戳生成伪哈希
    const timestamp = Date.now();
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(timestamp.toString()).digest('hex');
  }
  
  /**
   * 添加候选节点
   */
  addCandidate(candidate: ValidatorCandidate): void {
    this.candidateNodes.set(candidate.address, candidate);
    console.log(`Added candidate node: ${candidate.address}`);
  }
  
  /**
   * 移除候选节点
   */
  removeCandidate(address: string): void {
    this.candidateNodes.delete(address);
    console.log(`Removed candidate node: ${address}`);
  }
  
  /**
   * 添加活跃验证节点
   */
  addActiveValidator(validator: Validator): void {
    this.activeValidators.set(validator.address, validator);
    console.log(`Added active validator: ${validator.address}`);
  }
  
  /**
   * 移除活跃验证节点
   */
  removeActiveValidator(address: string): void {
    this.activeValidators.delete(address);
    console.log(`Removed active validator: ${address}`);
  }
  
  /**
   * 获取系统状态
   */
  getSystemStatus() {
    return {
      activeValidators: this.activeValidators.size,
      candidateNodes: this.candidateNodes.size,
      pendingTransitions: this.pendingTransitions.size,
      eligibleCandidates: this.getEligibleCandidates().length,
      systemHealth: this.activeValidators.size >= this.CONFIG.MAX_ACTIVE_VALIDATORS * 0.9 ? 'healthy' : 'warning'
    };
  }
  
  /**
   * 获取违规检测器
   */
  getViolationDetector(): ViolationDetector {
    return this.violationDetector;
  }
  
  /**
   * 获取VRF选择器实例
   */
  getVRFSelector(): VRFRandomSelector {
    return this.vrfSelector;
  }

  /**
   * 分配区块奖励给活跃节点和候补节点
   */
  async distributeBlockRewards(totalReward: number, blockNumber: number): Promise<void> {
    try {
      const activeValidators = this.dynamicManager.getActiveValidators();
      const candidateNodes = this.dynamicManager.getCandidateValidators();
      
      // 计算奖励分配
      const activeReward = totalReward * REWARD_DISTRIBUTION.ACTIVE_VALIDATORS_SHARE;
      const candidateReward = totalReward * REWARD_DISTRIBUTION.CANDIDATE_NODES_SHARE;
      
      // 分配给活跃验证节点
      if (activeValidators.length > 0) {
        const rewardPerActiveValidator = activeReward / activeValidators.length;
        
        for (const validator of activeValidators) {
          await this.executeRewardTransfer({
            id: `active_${validator.address}_${blockNumber}`,
            fromAddress: 'system',
            toAddress: validator.address,
            amount: rewardPerActiveValidator,
            type: 'block_reward',
            blockNumber,
            timestamp: Date.now(),
            status: 'pending',
            reason: `活跃验证节点区块奖励 #${blockNumber}`
          });
        }
      }
      
      // 分配给候补节点
      if (candidateNodes.length > 0) {
        const rewardPerCandidate = candidateReward / candidateNodes.length;
        
        for (const candidate of candidateNodes) {
          await this.executeRewardTransfer({
            id: `candidate_${candidate.address}_${blockNumber}`,
            fromAddress: 'system',
            toAddress: candidate.address,
            amount: rewardPerCandidate,
            type: 'candidate_reward',
            blockNumber,
            timestamp: Date.now(),
            status: 'pending',
            reason: `候补节点维护奖励 #${blockNumber}`
          });
        }
      }
      
      console.log(`区块 #${blockNumber} 奖励分配完成:`);
      console.log(`- 活跃节点 (${activeValidators.length}个): ${activeReward} 总奖励`);
      console.log(`- 候补节点 (${candidateNodes.length}个): ${candidateReward} 总奖励`);
      
    } catch (error) {
      console.error('分配区块奖励失败:', error);
      throw error;
    }
  }

  /**
   * 获取奖励分配统计
   */
  getRewardDistributionStats(): {
    activeValidatorsCount: number;
    candidateNodesCount: number;
    activeValidatorsShare: number;
    candidateNodesShare: number;
    rewardPerActiveValidator: number;
    rewardPerCandidate: number;
  } {
    const activeValidators = this.dynamicManager.getActiveValidators();
    const candidateNodes = this.dynamicManager.getCandidateValidators();
    
    const rewardPerActiveValidator = activeValidators.length > 0 
      ? REWARD_DISTRIBUTION.ACTIVE_VALIDATORS_SHARE / activeValidators.length 
      : 0;
    const rewardPerCandidate = candidateNodes.length > 0 
      ? REWARD_DISTRIBUTION.CANDIDATE_NODES_SHARE / candidateNodes.length 
      : 0;
    
    return {
      activeValidatorsCount: activeValidators.length,
      candidateNodesCount: candidateNodes.length,
      activeValidatorsShare: REWARD_DISTRIBUTION.ACTIVE_VALIDATORS_SHARE,
      candidateNodesShare: REWARD_DISTRIBUTION.CANDIDATE_NODES_SHARE,
      rewardPerActiveValidator,
      rewardPerCandidate
    };
  }
}

/**
 * 奖励分配配置
 */
const REWARD_DISTRIBUTION = {
  ACTIVE_VALIDATORS_SHARE: 0.8,    // 活跃节点分配80%
  CANDIDATE_NODES_SHARE: 0.2,      // 候补节点分配20%
  MAX_ACTIVE_VALIDATORS: 108,      // 最大活跃验证节点数
  MAX_CANDIDATE_NODES: 2000        // 最大候补节点数
};