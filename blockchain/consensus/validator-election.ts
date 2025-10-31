import { 
  Validator, 
  ValidatorCandidate, 
  StakingRecord,
  RewardTransfer,
  ValidatorTransition,
  HardwareMetrics,
  NetworkMetrics
} from '../../shared/types/blockchain.js';
import { CONSENSUS_CONFIG } from '../../shared/constants/blockchain.js';
import { CandidateReplacementSystem } from './candidate-replacement-system.js';
import { ViolationDetector } from './violation-detector.js';
import { VRFRandomSelector } from './vrf-random-selector.js';

/**
 * 基于违规淘汰的动态验证节点管理系统
 * 替代传统选举机制，实现基于违规检测的自动节点替换
 */
export class DynamicValidatorManager {
  private candidateReplacementSystem: CandidateReplacementSystem;
  private violationDetector: ViolationDetector;
  private vrfSelector: VRFRandomSelector;
  private stakingRecords: Map<string, StakingRecord> = new Map();
  private managementHistory: ManagementRecord[] = [];
  
  // 系统配置
  private readonly CONFIG = {
    MAX_ACTIVE_VALIDATORS: CONSENSUS_CONFIG.MAX_VALIDATORS || 108,
    MAX_CANDIDATE_VALIDATORS: 2000,
    MIN_STAKE_REQUIREMENT: BigInt('10000000000000000000000'), // 10,000 TTN
    HEALTH_CHECK_INTERVAL: 60 * 1000, // 1分钟健康检查
    METRICS_UPDATE_INTERVAL: 30 * 1000, // 30秒指标更新
    PERFORMANCE_EVALUATION_INTERVAL: 5 * 60 * 1000, // 5分钟性能评估
    GEOGRAPHIC_DISTRIBUTION_LIMIT: 3, // 每个地区最多3个节点
    ASSOCIATED_NODES_MAX_SAME_IP: 2 // 同一IP最多2个节点
  };
  
  // 回调函数
  private rewardTransferCallback?: (transfer: RewardTransfer) => Promise<void>;
  private validatorUpdateCallback?: (validator: Validator, action: 'add' | 'remove' | 'update') => Promise<void>;
  private stakingUpdateCallback?: (record: StakingRecord) => Promise<void>;
  
  constructor(vrfPrivateKey?: Buffer) {
    console.log('Initializing Dynamic Validator Management System');
    
    // 初始化子系统
    this.candidateReplacementSystem = new CandidateReplacementSystem(vrfPrivateKey);
    this.violationDetector = this.candidateReplacementSystem.getViolationDetector();
    this.vrfSelector = this.candidateReplacementSystem.getVRFSelector();
    
    // 设置回调函数
    this.setupCallbacks();
    
    // 启动监控循环
    this.startMonitoringCycles();
    
    console.log('Dynamic Validator Management System initialized');
  }
  
  /**
   * 设置回调函数
   */
  private setupCallbacks(): void {
    // 设置候选节点替换系统的回调
    this.candidateReplacementSystem.setRewardTransferCallback(
      (transfer: RewardTransfer) => this.handleRewardTransfer(transfer)
    );
    
    this.candidateReplacementSystem.setValidatorUpdateCallback(
      (validator: Validator, action: 'add' | 'remove' | 'update') => this.handleValidatorUpdate(validator, action)
    );
  }
  
  /**
   * 启动监控循环
   */
  private startMonitoringCycles(): void {
    // 健康检查循环
    setInterval(() => {
      this.performHealthCheck();
    }, this.CONFIG.HEALTH_CHECK_INTERVAL);
    
    // 指标更新循环
    setInterval(() => {
      this.updateValidatorMetrics();
    }, this.CONFIG.METRICS_UPDATE_INTERVAL);
    
    // 性能评估循环
    setInterval(() => {
      this.performPerformanceEvaluation();
    }, this.CONFIG.PERFORMANCE_EVALUATION_INTERVAL);
    
    console.log('Monitoring cycles started');
  }
  
  /**
   * 执行健康检查
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const systemStatus = this.candidateReplacementSystem.getSystemStatus();
      
      // 记录系统状态
      const record: ManagementRecord = {
        timestamp: Date.now(),
        type: 'health_check',
        activeValidators: systemStatus.activeValidators,
        candidateNodes: systemStatus.candidateNodes,
        pendingTransitions: systemStatus.pendingTransitions,
        systemHealth: systemStatus.systemHealth,
        details: `Health check completed - ${systemStatus.systemHealth}`
      };
      
      this.managementHistory.push(record);
      
      // 保持历史记录在合理范围内
      if (this.managementHistory.length > 1000) {
        this.managementHistory.shift();
      }
      
    } catch (error) {
      console.error('Error during health check:', error);
    }
  }
  
  /**
   * 更新验证节点指标
   */
  private async updateValidatorMetrics(): Promise<void> {
    try {
      // 这里应该从网络层获取实际的硬件和网络指标
      // 简化实现，使用模拟数据
      const activeValidators = this.getActiveValidators();
      
      for (const [address, validator] of activeValidators) {
        // 获取硬件指标
        const hardwareMetrics = await this.getValidatorHardwareMetrics(address);
        this.violationDetector.updateHardwareMetrics(address, hardwareMetrics);
        
        // 获取网络指标
        const networkMetrics = await this.getValidatorNetworkMetrics(address);
        this.violationDetector.updateNetworkMetrics(address, networkMetrics);
      }
      
    } catch (error) {
      console.error('Error updating validator metrics:', error);
    }
  }
  
  /**
   * 执行性能评估
   */
  private async performPerformanceEvaluation(): Promise<void> {
    try {
      const activeValidators = this.getActiveValidators();
      let evaluatedCount = 0;
      
      for (const [address, validator] of activeValidators) {
        // 检查验证节点是否健康
        const isHealthy = this.violationDetector.isValidatorHealthy(address);
        
        if (!isHealthy) {
          console.log(`Validator ${address} marked as unhealthy during performance evaluation`);
          // 违规检测器会自动处理不健康的验证节点
        }
        
        evaluatedCount++;
      }
      
      // 记录性能评估结果
      const record: ManagementRecord = {
        timestamp: Date.now(),
        type: 'performance_evaluation',
        activeValidators: activeValidators.size,
        candidateNodes: this.getCandidateValidators().size,
        pendingTransitions: 0,
        systemHealth: 'healthy',
        details: `Evaluated ${evaluatedCount} validators`
      };
      
      this.managementHistory.push(record);
      
    } catch (error) {
      console.error('Error during performance evaluation:', error);
    }
  }
  
  /**
   * 获取验证节点硬件指标
   */
  private async getValidatorHardwareMetrics(address: string): Promise<HardwareMetrics> {
    // 这里应该从实际的监控系统获取数据
    // 简化实现，返回模拟数据
    return {
      cpuUsage: Math.random() * 100,
      memoryUsage: Math.random() * 100,
      diskUsage: Math.random() * 100,
      networkBandwidth: 100 + Math.random() * 900, // 100-1000 Mbps
      lastUpdated: Date.now(),
      isAdequate: true
    };
  }
  
  /**
   * 获取验证节点网络指标
   */
  private async getValidatorNetworkMetrics(address: string): Promise<NetworkMetrics> {
    // 这里应该从实际的网络监控系统获取数据
    // 简化实现，返回模拟数据
    return {
      latency: Math.random() * 1000, // 0-1000ms
      uptime: 95 + Math.random() * 5, // 95-100%
      responseTime: Math.random() * 2000, // 0-2000ms
      blocksProduced: Math.floor(Math.random() * 100),
      blocksMissed: Math.floor(Math.random() * 5),
      ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`
    };
  }
  
  /**
   * 处理奖励转移
   */
  private async handleRewardTransfer(transfer: RewardTransfer): Promise<void> {
    try {
      console.log(`Processing reward transfer: ${transfer.fromValidator} -> ${transfer.toValidator} (${transfer.amount} TTN)`);
      
      // 更新质押记录
      const fromRecord = this.stakingRecords.get(transfer.fromValidator);
      const toRecord = this.stakingRecords.get(transfer.toValidator);
      
      if (fromRecord) {
        fromRecord.amount = BigInt(0); // 被踢出的节点失去质押
        fromRecord.timestamp = Date.now();
        fromRecord.type = 'slash';
      }
      
      if (toRecord) {
        toRecord.amount = transfer.amount;
        toRecord.timestamp = Date.now();
        toRecord.type = 'reward';
      } else {
        // 创建新的质押记录
        const newRecord: StakingRecord = {
          address: transfer.toValidator,
          amount: transfer.amount,
          timestamp: Date.now(),
          type: 'reward',
          blockNumber: transfer.blockNumber
        };
        this.stakingRecords.set(transfer.toValidator, newRecord);
      }
      
      // 调用外部回调
      if (this.rewardTransferCallback) {
        await this.rewardTransferCallback(transfer);
      }
      
      if (this.stakingUpdateCallback) {
        if (fromRecord) await this.stakingUpdateCallback(fromRecord);
        if (toRecord) await this.stakingUpdateCallback(toRecord);
      }
      
      // 记录转移事件
      const record: ManagementRecord = {
        timestamp: Date.now(),
        type: 'reward_transfer',
        activeValidators: this.getActiveValidators().size,
        candidateNodes: this.getCandidateValidators().size,
        pendingTransitions: 0,
        systemHealth: 'healthy',
        details: `Reward transfer: ${transfer.fromValidator} -> ${transfer.toValidator}`
      };
      
      this.managementHistory.push(record);
      
    } catch (error) {
      console.error('Error handling reward transfer:', error);
      throw error;
    }
  }
  
  /**
   * 处理验证节点更新
   */
  private async handleValidatorUpdate(validator: Validator, action: 'add' | 'remove' | 'update'): Promise<void> {
    try {
      console.log(`Processing validator update: ${action} ${validator.address}`);
      
      // 调用外部回调
      if (this.validatorUpdateCallback) {
        await this.validatorUpdateCallback(validator, action);
      }
      
      // 记录更新事件
      const record: ManagementRecord = {
        timestamp: Date.now(),
        type: 'validator_update',
        activeValidators: this.getActiveValidators().size,
        candidateNodes: this.getCandidateValidators().size,
        pendingTransitions: 0,
        systemHealth: 'healthy',
        details: `Validator ${action}: ${validator.address}`
      };
      
      this.managementHistory.push(record);
      
    } catch (error) {
      console.error('Error handling validator update:', error);
      throw error;
    }
  }
  
  /**
   * 注册候选节点
   */
  async registerCandidate(candidateData: {
    address: string;
    publicKey: string;
    stake: bigint;
    commission: number;
    location?: string;
    hardwareSpecs?: any;
  }): Promise<boolean> {
    try {
      // 验证候选节点资格
      if (candidateData.stake < this.CONFIG.MIN_STAKE_REQUIREMENT) {
        console.warn(`Candidate ${candidateData.address} stake too low: ${candidateData.stake}`);
        return false;
      }
      
      // 检查是否已经是活跃验证节点
      if (this.getActiveValidators().has(candidateData.address)) {
        console.warn(`Address ${candidateData.address} is already an active validator`);
        return false;
      }
      
      // 检查是否已经是候选节点
      if (this.getCandidateValidators().has(candidateData.address)) {
        console.warn(`Address ${candidateData.address} is already a candidate`);
        return false;
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
        status: 'pending',
        metadata: {
          name: `Validator ${candidateData.address.slice(0, 8)}`,
          description: `Candidate validator ${candidateData.address}`,
          website: candidateData.location || undefined,
          identity: candidateData.address,
          details: JSON.stringify(candidateData.hardwareSpecs || {})
        },
        readinessScore: 80,
        violationHistory: []
      };
      
      // 添加到候选节点替换系统
      this.candidateReplacementSystem.addCandidate(candidate);
      
      // 创建质押记录
      const stakingRecord: StakingRecord = {
        address: candidateData.address,
        amount: candidateData.stake,
        timestamp: Date.now(),
        type: 'stake',
        blockNumber: 0
      };
      
      this.stakingRecords.set(candidateData.address, stakingRecord);
      
      // 调用质押更新回调
      if (this.stakingUpdateCallback) {
        await this.stakingUpdateCallback(stakingRecord);
      }
      
      console.log(`Candidate registered successfully: ${candidateData.address}`);
      return true;
      
    } catch (error) {
      console.error(`Error registering candidate ${candidateData.address}:`, error);
      return false;
    }
  }
  
  /**
   * 手动踢出验证节点（管理员功能）
   */
  async manuallyKickValidator(address: string, reason: string): Promise<boolean> {
    try {
      const validator = this.getActiveValidators().get(address);
      if (!validator) {
        console.warn(`Validator ${address} not found in active set`);
        return false;
      }
      
      // 通过违规检测器处理踢出
      await this.violationDetector['kickValidator'](address, `Manual kick: ${reason}`);
      
      console.log(`Validator ${address} manually kicked: ${reason}`);
      return true;
      
    } catch (error) {
      console.error(`Error manually kicking validator ${address}:`, error);
      return false;
    }
  }
  
  /**
   * 设置回调函数
   */
  setRewardTransferCallback(callback: (transfer: RewardTransfer) => Promise<void>): void {
    this.rewardTransferCallback = callback;
  }
  
  setValidatorUpdateCallback(callback: (validator: Validator, action: 'add' | 'remove' | 'update') => Promise<void>): void {
    this.validatorUpdateCallback = callback;
  }
  
  setStakingUpdateCallback(callback: (record: StakingRecord) => Promise<void>): void {
    this.stakingUpdateCallback = callback;
  }
  
  /**
   * 获取活跃验证节点
   */
  getActiveValidators(): Map<string, Validator> {
    // 从候选节点替换系统获取活跃验证节点
    const systemStatus = this.candidateReplacementSystem.getSystemStatus();
    // 这里需要实际的实现来获取验证节点映射
    // 简化实现，返回空映射
    return new Map();
  }
  
  /**
   * 获取候选验证节点
   */
  getCandidateValidators(): Map<string, ValidatorCandidate> {
    // 从候选节点替换系统获取候选节点
    // 简化实现，返回空映射
    return new Map();
  }
  
  /**
   * 获取质押记录
   */
  getStakingRecords(): Map<string, StakingRecord> {
    return this.stakingRecords;
  }
  
  /**
   * 获取管理历史
   */
  getManagementHistory(): ManagementRecord[] {
    return this.managementHistory;
  }
  
  /**
   * 获取系统统计信息
   */
  getSystemStats() {
    const systemStatus = this.candidateReplacementSystem.getSystemStatus();
    const recentViolations = this.getRecentViolationsCount();
    const associatedNodesAnalysis = this.violationDetector.getAssociatedNodesAnalysis();
    
    return {
      activeValidators: systemStatus.activeValidators,
      candidateNodes: systemStatus.candidateNodes,
      pendingTransitions: systemStatus.pendingTransitions,
      eligibleCandidates: systemStatus.eligibleCandidates,
      systemHealth: systemStatus.systemHealth,
      recentViolations,
      associatedNodesRisk: associatedNodesAnalysis?.riskLevel || 'low',
      totalStaked: this.getTotalStakedAmount(),
      averageUptime: this.getAverageUptime(),
      lastHealthCheck: this.getLastHealthCheckTime()
    };
  }
  
  /**
   * 获取最近违规数量
   */
  private getRecentViolationsCount(): number {
    let totalViolations = 0;
    const activeValidators = this.getActiveValidators();
    
    for (const address of activeValidators.keys()) {
      const violations = this.violationDetector.getRecentViolations(address);
      totalViolations += violations.length;
    }
    
    return totalViolations;
  }
  
  /**
   * 获取总质押金额
   */
  private getTotalStakedAmount(): bigint {
    let total = BigInt(0);
    for (const record of this.stakingRecords.values()) {
      total += record.amount;
    }
    return total;
  }
  
  /**
   * 获取平均在线时间
   */
  private getAverageUptime(): number {
    const activeValidators = this.getActiveValidators();
    if (activeValidators.size === 0) return 100;
    
    let totalUptime = 0;
    for (const validator of activeValidators.values()) {
      totalUptime += validator.performance.uptime;
    }
    
    return totalUptime / activeValidators.size;
  }
  
  /**
   * 获取最后健康检查时间
   */
  private getLastHealthCheckTime(): number {
    const healthCheckRecords = this.managementHistory
      .filter(record => record.type === 'health_check')
      .sort((a, b) => b.timestamp - a.timestamp);
    
    return healthCheckRecords.length > 0 ? healthCheckRecords[0].timestamp : 0;
  }
  
  /**
   * 获取违规检测器（用于外部访问）
   */
  getViolationDetector(): ViolationDetector {
    return this.violationDetector;
  }
  
  /**
   * 获取候选节点替换系统（用于外部访问）
   */
  getCandidateReplacementSystem(): CandidateReplacementSystem {
    return this.candidateReplacementSystem;
  }
  
  /**
   * 获取VRF选择器（用于外部访问）
   */
  getVRFSelector(): VRFRandomSelector {
    return this.vrfSelector;
  }
}

// 接口定义
interface ManagementRecord {
  timestamp: number;
  type: 'health_check' | 'performance_evaluation' | 'reward_transfer' | 'validator_update' | 'violation_detected';
  activeValidators: number;
  candidateNodes: number;
  pendingTransitions: number;
  systemHealth: string;
  details: string;
}

// 为了向后兼容，保留原有的ValidatorElection类作为别名
export const ValidatorElection = DynamicValidatorManager;