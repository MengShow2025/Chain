import { Validator, ValidatorCandidate, StakingRecord, RewardTransfer, ValidatorPerformance } from '../../shared/types/blockchain.js';
import { CONSENSUS_CONFIG, VALIDATOR_STATUS } from '../../shared/constants/blockchain.js';
import { DynamicValidatorManager } from './validator-election.js';
import { CandidateReplacementSystem } from './candidate-replacement-system.js';

/**
 * 验证节点管理器
 * 负责管理108个活跃验证节点和候选节点的动态替换
 * 基于违规检测的动态管理系统
 */
export class ValidatorManager {
  private activeValidators: Map<string, Validator> = new Map();
  private candidateValidators: Map<string, ValidatorCandidate> = new Map();
  private stakingRecords: Map<string, StakingRecord[]> = new Map();
  private currentEpoch: number = 0;
  private lastHealthCheck: number = Date.now();
  
  // 集成动态验证节点管理系统
  private dynamicManager: DynamicValidatorManager;
  private replacementSystem: CandidateReplacementSystem;
  
  constructor() {
    console.log('Initializing Dynamic Validator Manager');
    this.dynamicManager = new DynamicValidatorManager();
    this.replacementSystem = new CandidateReplacementSystem();
    
    // 设置回调函数
    this.setupCallbacks();
  }
  
  /**
   * 设置回调函数
   */
  private setupCallbacks(): void {
    // 设置奖励转移回调
    this.replacementSystem.setRewardTransferCallback(
      (transfer: RewardTransfer) => this.handleRewardTransfer(transfer)
    );
    
    // 设置验证节点更新回调
    this.replacementSystem.setValidatorUpdateCallback(
      (validator: Validator, action: 'add' | 'remove' | 'update') => this.handleValidatorUpdate(validator, action)
    );
  }
  
  /**
   * 初始化验证节点系统
   */
  async initialize(genesisValidators: Validator[]): Promise<void> {
    console.log('Initializing validator system with', genesisValidators.length, 'genesis validators');
    
    // 添加创世验证节点
    for (const validator of genesisValidators) {
      const activeValidator = {
        ...validator,
        status: VALIDATOR_STATUS.ACTIVE as 'active',
        joinedAt: Date.now(),
        performance: {
          uptime: 100,
          blocksProduced: 0,
          blocksExpected: 0,
          missedBlocks: 0,
          slashingEvents: 0,
          averageBlockTime: CONSENSUS_CONFIG.BLOCK_TIME * 1000,
          score: 100
        }
      };
      
      this.activeValidators.set(validator.address, activeValidator);
      this.replacementSystem.addActiveValidator(activeValidator);
    }
    
    // 启动动态管理系统
    // DynamicValidatorManager会自动启动监控循环
    
    console.log(`Initialized with ${this.activeValidators.size} active validators`);
  }

  /**
   * 注册候补验证节点
   */
  async registerCandidate(candidate: ValidatorCandidate): Promise<boolean> {
    try {
      // 验证候选节点的基本要求
      if (!this.validateCandidateRequirements(candidate)) {
        console.warn(`Candidate ${candidate.address} does not meet requirements`);
        return false;
      }
      
      // 使用动态管理器注册候选节点
      const success = await this.dynamicManager.registerCandidate({
        address: candidate.address,
        publicKey: candidate.publicKey,
        stake: candidate.stake,
        commission: candidate.commission
      });
      
      if (success) {
        // 添加到本地候选节点池
        this.candidateValidators.set(candidate.address, candidate);
        this.replacementSystem.addCandidate(candidate);
        console.log(`Candidate ${candidate.address} registered successfully`);
      }
      
      return success;
      
    } catch (error) {
      console.error('Error registering candidate:', error);
      return false;
    }
  }

  /**
   * 验证候选节点要求
   */
  private validateCandidateRequirements(candidate: ValidatorCandidate): boolean {
    // 检查最小质押要求
    if (candidate.stake < CONSENSUS_CONFIG.MIN_VALIDATOR_STAKE) {
      return false;
    }
    
    // 检查是否已经是活跃验证节点
    if (this.activeValidators.has(candidate.address)) {
      return false;
    }
    
    // 检查是否已经是候选节点
    if (this.candidateValidators.has(candidate.address)) {
      return false;
    }
    
    return true;
  }
  
  /**
   * 处理奖励转移
   */
  private async handleRewardTransfer(transfer: RewardTransfer): Promise<void> {
    console.log(`Processing reward transfer: ${transfer.fromValidator} -> ${transfer.toValidator}, amount: ${transfer.amount}`);
    
    // 记录质押变更
    this.recordStaking(transfer.toValidator, transfer.amount, 'stake');
    
    // 更新验证节点质押信息
    const validator = this.activeValidators.get(transfer.toValidator);
    if (validator) {
      validator.stake += transfer.amount;
    }
  }

  /**
   * 处理验证节点更新
   */
  private async handleValidatorUpdate(validator: Validator, action: 'add' | 'remove' | 'update'): Promise<void> {
    switch (action) {
      case 'add':
        this.activeValidators.set(validator.address, validator);
        // 从候选节点中移除
        this.candidateValidators.delete(validator.address);
        console.log(`Validator ${validator.address} added to active set`);
        break;
        
      case 'remove':
        this.activeValidators.delete(validator.address);
        console.log(`Validator ${validator.address} removed from active set`);
        break;
        
      case 'update':
        this.activeValidators.set(validator.address, validator);
        console.log(`Validator ${validator.address} updated`);
        break;
    }
  }
  
  /**
   * 更新验证节点质押
   */
  async updateValidatorStake(address: string, newStake: bigint): Promise<boolean> {
    const validator = this.activeValidators.get(address);
    if (!validator) {
      return false;
    }
    
    const oldStake = validator.stake;
    validator.stake = newStake;
    
    // 记录质押变更
    const stakeDiff = newStake - oldStake;
    if (stakeDiff !== BigInt(0)) {
      this.recordStaking(address, stakeDiff > 0 ? stakeDiff : -stakeDiff, stakeDiff > 0 ? 'stake' : 'unstake');
    }
    
    return true;
  }
  
  /**
   * 记录质押操作
   */
  recordStaking(address: string, amount: bigint, type: 'stake' | 'unstake'): void {
    const record: StakingRecord = {
      address,
      amount,
      timestamp: Date.now(),
      type,
      blockNumber: 0, // 将在实际区块中设置
      epoch: this.currentEpoch,
      transactionHash: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    if (!this.stakingRecords.has(address)) {
      this.stakingRecords.set(address, []);
    }
    
    this.stakingRecords.get(address)!.push(record);
    
    // 保持记录数量在合理范围内
    const records = this.stakingRecords.get(address)!;
    if (records.length > 1000) {
      records.splice(0, records.length - 1000);
    }
  }
  
  /**
   * 获取活跃验证节点
   */
  getActiveValidators(): Validator[] {
    return Array.from(this.activeValidators.values());
  }
  
  /**
   * 获取候选验证节点
   */
  getCandidateValidators(): ValidatorCandidate[] {
    return Array.from(this.candidateValidators.values());
  }
  
  /**
   * 获取验证节点统计信息
   */
  getValidatorStats() {
    const activeCount = this.activeValidators.size;
    const candidateCount = this.candidateValidators.size;
    const totalStake = Array.from(this.activeValidators.values())
      .reduce((sum, v) => sum + v.stake, BigInt(0));
    
    return {
      activeValidators: activeCount,
      candidateValidators: candidateCount,
      totalStake,
      maxValidators: CONSENSUS_CONFIG.MAX_VALIDATORS,
      currentEpoch: this.currentEpoch,
      systemStatus: this.getSystemStatus()
    };
  }
  
  /**
   * 获取系统状态
   */
  private getSystemStatus(): 'healthy' | 'warning' | 'critical' {
    const activeCount = this.activeValidators.size;
    const targetCount = CONSENSUS_CONFIG.MAX_VALIDATORS;
    
    if (activeCount < targetCount * 0.5) {
      return 'critical';
    } else if (activeCount < targetCount * 0.8) {
      return 'warning';
    }
    
    return 'healthy';
  }
  
  /**
   * 获取验证节点详情
   */
  getValidatorDetails(address: string): Validator | ValidatorCandidate | null {
    return this.activeValidators.get(address) || this.candidateValidators.get(address) || null;
  }
  
  /**
   * 获取质押记录
   */
  getStakingRecords(address: string): StakingRecord[] {
    return this.stakingRecords.get(address) || [];
  }
  
  /**
   * 更新验证节点性能
   */
  async updateValidatorPerformance(address: string, blockProduced: boolean, blockTime?: number): Promise<void> {
    const validator = this.activeValidators.get(address);
    if (!validator) {
      return;
    }
    
    if (blockProduced) {
      validator.performance.blocksProduced++;
      validator.performance.blocksExpected++;
      if (blockTime) {
        const currentAvg = validator.performance.averageBlockTime;
        const totalBlocks = validator.performance.blocksProduced;
        validator.performance.averageBlockTime = 
          (currentAvg * (totalBlocks - 1) + blockTime) / totalBlocks;
      }
    } else {
      validator.performance.missedBlocks++;
      validator.performance.blocksExpected++;
    }
    
    // 更新正常运行时间
    const totalBlocks = validator.performance.blocksExpected;
    if (totalBlocks > 0) {
      validator.performance.uptime = (validator.performance.blocksProduced / totalBlocks) * 100;
    }
    
    // 更新综合评分
    validator.performance.score = this.calculatePerformanceScore(validator.performance);
  }
  
  /**
   * 计算性能评分
   */
  private calculatePerformanceScore(performance: ValidatorPerformance): number {
    let score = 0;
    
    // 在线率权重：40%
    score += performance.uptime * 0.4;
    
    // 出块效率权重：30%
    const blockEfficiency = performance.blocksExpected > 0 
      ? (performance.blocksProduced / performance.blocksExpected) * 100 
      : 100;
    score += blockEfficiency * 0.3;
    
    // 惩罚事件权重：30%（越少越好）
    const penaltyScore = Math.max(0, 100 - performance.slashingEvents * 10);
    score += penaltyScore * 0.3;
    
    return Math.min(100, Math.max(0, score));
  }
  
  /**
   * 处理验证节点离线
   */
  async handleValidatorOffline(address: string): Promise<void> {
    const validator = this.activeValidators.get(address);
    if (!validator) {
      return;
    }
    
    validator.status = VALIDATOR_STATUS.INACTIVE as 'inactive';
    console.log(`Validator ${address} went offline`);
    
    // 更新性能指标
    validator.performance.missedBlocks++;
    validator.performance.blocksExpected++;
    
    // 重新计算正常运行时间
    if (validator.performance.blocksExpected > 0) {
      validator.performance.uptime = (validator.performance.blocksProduced / validator.performance.blocksExpected) * 100;
    }
  }
  
  /**
   * 处理验证节点上线
   */
  async handleValidatorOnline(address: string): Promise<void> {
    const validator = this.activeValidators.get(address);
    if (!validator) {
      return;
    }
    
    validator.status = VALIDATOR_STATUS.ACTIVE as 'active';
    console.log(`Validator ${address} came online`);
  }
  
  /**
   * 获取网络健康状况
   */
  getNetworkHealth(): {
    status: 'healthy' | 'warning' | 'critical';
    activeValidators: number;
    onlineValidators: number;
    averageUptime: number;
    issues: string[];
  } {
    const activeValidators = Array.from(this.activeValidators.values());
    const onlineValidators = activeValidators.filter(v => v.status === VALIDATOR_STATUS.ACTIVE);
    const averageUptime = activeValidators.length > 0 
      ? activeValidators.reduce((sum, v) => sum + v.performance.uptime, 0) / activeValidators.length
      : 0;
    
    const issues: string[] = [];
    const onlineRatio = onlineValidators.length / activeValidators.length;
    
    if (onlineRatio < 0.5) {
      issues.push('Critical: Less than 50% validators online');
    } else if (onlineRatio < 0.8) {
      issues.push('Warning: Less than 80% validators online');
    }
    
    if (averageUptime < 90) {
      issues.push('Warning: Average uptime below 90%');
    }
    
    const status = issues.some(i => i.startsWith('Critical')) ? 'critical' :
                   issues.length > 0 ? 'warning' : 'healthy';
    
    return {
      status,
      activeValidators: activeValidators.length,
      onlineValidators: onlineValidators.length,
      averageUptime,
      issues
    };
  }
  
  /**
   * 获取替换系统状态
   */
  getReplacementSystemStatus() {
    return this.replacementSystem.getSystemStatus();
  }
  
  /**
   * 获取动态管理器状态
   */
  getDynamicManagerStatus() {
    return this.dynamicManager.getSystemStats();
  }
  
  /**
   * 手动踢出验证节点（用于测试或紧急情况）
   */
  async manualKickValidator(address: string, reason: string): Promise<boolean> {
    return await this.dynamicManager.manuallyKickValidator(address, reason);
  }
  
  /**
   * 清理过期的质押记录
   */
  cleanupStakingRecords(): void {
    const cutoffTime = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30天前
    
    for (const [address, records] of this.stakingRecords) {
      const filteredRecords = records.filter(record => record.timestamp > cutoffTime);
      if (filteredRecords.length !== records.length) {
        this.stakingRecords.set(address, filteredRecords);
      }
    }
  }
  
  /**
   * 分配区块奖励（包括活跃节点和候补节点）
   */
  async distributeBlockRewards(totalReward: number, blockNumber: number): Promise<void> {
    return await this.replacementSystem.distributeBlockRewards(totalReward, blockNumber);
  }

  /**
   * 获取奖励分配统计信息
   */
  getRewardDistributionStats() {
    return this.replacementSystem.getRewardDistributionStats();
  }

  /**
   * 执行验证节点选举/评估
   * 触发动态管理系统的性能评估和节点替换检查
   */
  async conductElection(): Promise<void> {
    try {
      console.log('Conducting validator election/evaluation...');
      
      // 获取当前系统状态
      const systemStats = this.dynamicManager.getSystemStats();
      console.log('Current system stats:', {
        activeValidators: systemStats.activeValidators,
        candidateNodes: systemStats.candidateNodes,
        systemHealth: systemStats.systemHealth
      });
      
      // 触发性能评估（这会自动处理违规检测和节点替换）
      await this.performManualPerformanceEvaluation();
      
      // 更新epoch
      this.currentEpoch++;
      
      console.log(`Election/evaluation completed for epoch ${this.currentEpoch}`);
      
    } catch (error) {
      console.error('Error during validator election:', error);
      throw error;
    }
  }

  /**
   * 手动触发性能评估
   */
  private async performManualPerformanceEvaluation(): Promise<void> {
    // 通过动态管理器的违规检测器进行评估
    const violationDetector = this.dynamicManager.getViolationDetector();
    const activeValidators = this.getActiveValidators();
    
    for (const validator of activeValidators) {
      try {
        // 检查验证节点的健康状况
        const isHealthy = violationDetector.isValidatorHealthy(validator.address);
        if (!isHealthy) {
          console.warn(`Validator ${validator.address} is not healthy`);
        }
        
        // 获取最近的违规记录
        const recentViolations = violationDetector.getRecentViolations(validator.address);
        if (recentViolations.length > 0) {
          console.warn(`Validator ${validator.address} has ${recentViolations.length} recent violations`);
        }
      } catch (error) {
        console.warn(`Error checking health for validator ${validator.address}:`, error);
      }
    }
  }
}