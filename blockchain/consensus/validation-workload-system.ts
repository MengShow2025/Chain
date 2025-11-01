import { ValidatorCandidate, Validator } from '../../shared/types/blockchain.js';
import { CONSENSUS_CONFIG } from '../../shared/constants/blockchain.js';

/**
 * 验证工作类型
 */
export enum ValidationWorkType {
  FRAUD_DETECTION = 'fraud_detection',
  TRANSACTION_VALIDATION = 'transaction_validation',
  BLOCK_VERIFICATION = 'block_verification',
  STATE_AUDIT = 'state_audit',
  NETWORK_MONITORING = 'network_monitoring'
}

/**
 * 验证工作记录
 */
export interface ValidationWork {
  validatorAddress: string;
  workType: ValidationWorkType;
  blockNumber: number;
  timestamp: number;
  workData: any;
  quality: number; // 0-100, 工作质量评分
  verified: boolean; // 是否被其他验证节点确认
  reward: bigint; // 获得的奖励
}

/**
 * 验证节点工作量统计
 */
export interface ValidatorWorkloadStats {
  address: string;
  totalWork: number;
  qualityScore: number; // 平均质量分数
  fraudDetections: number;
  successfulValidations: number;
  falsePositives: number;
  totalRewards: bigint;
  workDistribution: Map<ValidationWorkType, number>;
  reputationScore: number; // 0-100
}

/**
 * 作弊检测报告
 */
export interface FraudReport {
  reporterId: string;
  suspectedValidator: string;
  blockNumber: number;
  fraudType: string;
  evidence: any;
  timestamp: number;
  verified: boolean;
  falseReport: boolean;
}

/**
 * 验证工作量评估系统
 * 管理2000个候补验证节点的工作量评估和奖励分配
 */
export class ValidationWorkloadSystem {
  private candidateValidators: Map<string, ValidatorCandidate> = new Map();
  private validationWork: Map<string, ValidationWork[]> = new Map(); // validator -> work records
  private fraudReports: Map<string, FraudReport[]> = new Map(); // reporter -> reports
  private workloadStats: Map<string, ValidatorWorkloadStats> = new Map();
  private epochWorkRewards: Map<number, Map<string, bigint>> = new Map(); // epoch -> validator -> rewards

  /**
   * 添加候补验证节点
   */
  addCandidateValidator(validator: ValidatorCandidate): void {
    this.candidateValidators.set(validator.address, validator);
    
    // 初始化工作记录
    if (!this.validationWork.has(validator.address)) {
      this.validationWork.set(validator.address, []);
    }
    
    if (!this.fraudReports.has(validator.address)) {
      this.fraudReports.set(validator.address, []);
    }

    // 初始化统计信息
    this.workloadStats.set(validator.address, {
      address: validator.address,
      totalWork: 0,
      qualityScore: 0,
      fraudDetections: 0,
      successfulValidations: 0,
      falsePositives: 0,
      totalRewards: BigInt(0),
      workDistribution: new Map(),
      reputationScore: 50 // 初始声誉分数
    });

    console.log(`Added candidate validator: ${validator.address}`);
  }

  /**
   * 移除候补验证节点
   */
  removeCandidateValidator(address: string): void {
    this.candidateValidators.delete(address);
    this.validationWork.delete(address);
    this.fraudReports.delete(address);
    this.workloadStats.delete(address);
    console.log(`Removed candidate validator: ${address}`);
  }

  /**
   * 记录验证工作
   */
  recordValidationWork(
    validatorAddress: string,
    workType: ValidationWorkType,
    blockNumber: number,
    workData: any,
    quality: number = 100
  ): void {
    // 如果验证节点不存在统计信息，自动初始化
    if (!this.workloadStats.has(validatorAddress)) {
      this.workloadStats.set(validatorAddress, {
        address: validatorAddress,
        totalWork: 0,
        qualityScore: 0,
        fraudDetections: 0,
        successfulValidations: 0,
        falsePositives: 0,
        totalRewards: BigInt(0),
        workDistribution: new Map(),
        reputationScore: 50 // 初始声誉分数
      });
      
      // 初始化工作记录
      if (!this.validationWork.has(validatorAddress)) {
        this.validationWork.set(validatorAddress, []);
      }
      
      console.log(`Auto-initialized validator stats for ${validatorAddress}`);
    }

    const work: ValidationWork = {
      validatorAddress,
      workType,
      blockNumber,
      timestamp: Date.now(),
      workData,
      quality: Math.max(0, Math.min(100, quality)),
      verified: false,
      reward: BigInt(0)
    };

    // 添加工作记录
    const validatorWork = this.validationWork.get(validatorAddress) || [];
    validatorWork.push(work);
    this.validationWork.set(validatorAddress, validatorWork);

    // 更新统计信息
    this.updateValidatorStats(validatorAddress);

    console.log(`Recorded ${workType} work for validator ${validatorAddress} (quality: ${quality})`);
  }

  /**
   * 提交作弊检测报告
   */
  submitFraudReport(
    reporterId: string,
    suspectedValidator: string,
    blockNumber: number,
    fraudType: string,
    evidence: any
  ): string {
    if (!this.candidateValidators.has(reporterId)) {
      throw new Error(`Reporter ${reporterId} not found in candidates`);
    }

    const report: FraudReport = {
      reporterId,
      suspectedValidator,
      blockNumber,
      fraudType,
      evidence,
      timestamp: Date.now(),
      verified: false,
      falseReport: false
    };

    const reporterReports = this.fraudReports.get(reporterId) || [];
    reporterReports.push(report);
    this.fraudReports.set(reporterId, reporterReports);

    // 记录作弊检测工作
    this.recordValidationWork(
      reporterId,
      ValidationWorkType.FRAUD_DETECTION,
      blockNumber,
      { suspectedValidator, fraudType, evidence },
      90 // 作弊检测工作质量较高
    );

    const reportId = `${reporterId}-${blockNumber}-${Date.now()}`;
    console.log(`Fraud report submitted: ${reportId}`);
    
    return reportId;
  }

  /**
   * 验证作弊报告
   */
  async verifyFraudReport(
    reportId: string,
    verifierAddress: string,
    isValid: boolean,
    verificationEvidence?: any
  ): Promise<void> {
    // 查找报告
    let targetReport: FraudReport | null = null;
    let reporterAddress: string | null = null;

    for (const [reporter, reports] of this.fraudReports) {
      const report = reports.find(r => 
        `${r.reporterId}-${r.blockNumber}-${r.timestamp}` === reportId
      );
      if (report) {
        targetReport = report;
        reporterAddress = reporter;
        break;
      }
    }

    if (!targetReport || !reporterAddress) {
      throw new Error(`Fraud report ${reportId} not found`);
    }

    // 更新报告状态
    targetReport.verified = true;
    targetReport.falseReport = !isValid;

    // 更新报告者统计
    const reporterStats = this.workloadStats.get(reporterAddress);
    if (reporterStats) {
      if (isValid) {
        reporterStats.fraudDetections++;
        reporterStats.reputationScore = Math.min(100, reporterStats.reputationScore + 5);
      } else {
        reporterStats.falsePositives++;
        reporterStats.reputationScore = Math.max(0, reporterStats.reputationScore - 10);
      }
    }

    // 记录验证工作
    this.recordValidationWork(
      verifierAddress,
      ValidationWorkType.FRAUD_DETECTION,
      targetReport.blockNumber,
      { reportId, isValid, verificationEvidence },
      isValid ? 95 : 85
    );

    console.log(`Fraud report ${reportId} verified as ${isValid ? 'valid' : 'invalid'}`);
  }

  /**
   * 更新验证节点统计信息
   */
  private updateValidatorStats(validatorAddress: string): void {
    const work = this.validationWork.get(validatorAddress) || [];
    const stats = this.workloadStats.get(validatorAddress);
    
    if (!stats) return;

    // 更新基本统计
    stats.totalWork = work.length;
    stats.qualityScore = work.length > 0 
      ? work.reduce((sum, w) => sum + w.quality, 0) / work.length 
      : 0;

    // 更新工作分布
    stats.workDistribution.clear();
    for (const w of work) {
      const count = stats.workDistribution.get(w.workType) || 0;
      stats.workDistribution.set(w.workType, count + 1);
    }

    // 计算声誉分数
    const baseReputation = Math.min(100, stats.qualityScore);
    const fraudBonus = Math.min(20, stats.fraudDetections * 2);
    const falsePenalty = Math.min(30, stats.falsePositives * 5);
    
    stats.reputationScore = Math.max(0, Math.min(100, 
      baseReputation + fraudBonus - falsePenalty
    ));
  }

  /**
   * 计算验证工作量奖励
   * 基于工作质量、数量和声誉分配20%的总奖励
   */
  calculateValidationRewards(
    totalBlockReward: bigint,
    epochBlocks: number = 100
  ): Map<string, bigint> {
    const validationRewardPool = totalBlockReward * BigInt(20) / BigInt(100); // 20%给验证节点
    const rewards = new Map<string, bigint>();

    // 计算所有验证节点的总工作量权重
    let totalWeight = 0;
    const validatorWeights = new Map<string, number>();

    for (const [address, stats] of this.workloadStats) {
      // 工作量权重 = 工作数量 * 质量分数 * 声誉分数
      const workWeight = stats.totalWork * (stats.qualityScore / 100) * (stats.reputationScore / 100);
      
      // 作弊检测奖励加成
      const fraudDetectionBonus = stats.fraudDetections * 10;
      
      // 虚假报告惩罚
      const falseReportPenalty = stats.falsePositives * 5;
      
      const finalWeight = Math.max(0, workWeight + fraudDetectionBonus - falseReportPenalty);
      
      validatorWeights.set(address, finalWeight);
      totalWeight += finalWeight;
    }

    // 分配奖励
    if (totalWeight > 0) {
      for (const [address, weight] of validatorWeights) {
        const reward = validationRewardPool * BigInt(Math.floor(weight * 1000)) / BigInt(Math.floor(totalWeight * 1000));
        rewards.set(address, reward);
        
        // 更新统计信息
        const stats = this.workloadStats.get(address);
        if (stats) {
          stats.totalRewards += reward;
        }
      }
    }

    console.log(`Distributed validation rewards to ${rewards.size} validators`);
    return rewards;
  }

  /**
   * 获取验证节点工作量排名
   */
  getValidatorRanking(limit: number = 50): ValidatorWorkloadStats[] {
    return Array.from(this.workloadStats.values())
      .sort((a, b) => {
        // 按声誉分数和工作质量排序
        const scoreA = a.reputationScore * a.qualityScore;
        const scoreB = b.reputationScore * b.qualityScore;
        return scoreB - scoreA;
      })
      .slice(0, limit);
  }

  /**
   * 获取作弊检测统计
   */
  getFraudDetectionStats(): {
    totalReports: number;
    verifiedReports: number;
    falseReports: number;
    topDetectors: string[];
  } {
    let totalReports = 0;
    let verifiedReports = 0;
    let falseReports = 0;

    for (const reports of this.fraudReports.values()) {
      totalReports += reports.length;
      verifiedReports += reports.filter(r => r.verified && !r.falseReport).length;
      falseReports += reports.filter(r => r.verified && r.falseReport).length;
    }

    const topDetectors = Array.from(this.workloadStats.values())
      .sort((a, b) => b.fraudDetections - a.fraudDetections)
      .slice(0, 10)
      .map(s => s.address);

    return {
      totalReports,
      verifiedReports,
      falseReports,
      topDetectors
    };
  }

  /**
   * 获取系统状态
   */
  getSystemStatus() {
    const activeValidators = this.candidateValidators.size;
    const totalWork = Array.from(this.workloadStats.values())
      .reduce((sum, stats) => sum + stats.totalWork, 0);
    
    const avgQuality = Array.from(this.workloadStats.values())
      .reduce((sum, stats) => sum + stats.qualityScore, 0) / activeValidators;

    const fraudStats = this.getFraudDetectionStats();

    return {
      activeValidators,
      maxValidators: CONSENSUS_CONFIG.MAX_CANDIDATES,
      totalWork,
      averageQuality: avgQuality,
      fraudDetectionRate: fraudStats.verifiedReports / Math.max(1, fraudStats.totalReports),
      systemHealth: activeValidators >= CONSENSUS_CONFIG.MAX_CANDIDATES * 0.8 ? 'healthy' : 'warning'
    };
  }

  /**
   * 清理旧的工作记录
   */
  cleanupOldRecords(keepDays: number = 30): void {
    const cutoffTime = Date.now() - (keepDays * 24 * 60 * 60 * 1000);
    let cleanedCount = 0;

    for (const [address, work] of this.validationWork) {
      const filteredWork = work.filter(w => w.timestamp > cutoffTime);
      this.validationWork.set(address, filteredWork);
      cleanedCount += work.length - filteredWork.length;
    }

    for (const [address, reports] of this.fraudReports) {
      const filteredReports = reports.filter(r => r.timestamp > cutoffTime);
      this.fraudReports.set(address, filteredReports);
    }

    console.log(`Cleaned up ${cleanedCount} old validation records`);
  }
}