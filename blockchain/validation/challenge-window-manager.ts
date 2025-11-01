import { EventEmitter } from 'events';
import { MessageBus, Message, MessagePriority } from '../messaging/message-bus.js';
import { BatchCommit } from '../../shared/types/blockchain.js';

/**
 * 挑战类型枚举
 */
export enum ChallengeType {
  COMPUTATION_ERROR = 'computation_error',
  DATA_AVAILABILITY = 'data_availability',
  INVALID_STATE_TRANSITION = 'invalid_state_transition',
  MERKLE_ROOT_MISMATCH = 'merkle_root_mismatch',
  TIMESTAMP_MANIPULATION = 'timestamp_manipulation'
}

/**
 * 挑战状态枚举
 */
export enum ChallengeStatus {
  PENDING = 'pending',
  UNDER_REVIEW = 'under_review',
  RESOLVED_VALID = 'resolved_valid',
  RESOLVED_INVALID = 'resolved_invalid',
  EXPIRED = 'expired'
}

/**
 * 窗口状态枚举
 */
export enum WindowStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  RESOLVING = 'resolving',
  FINALIZED = 'finalized'
}

/**
 * 解决结果枚举
 */
export enum ResolutionResult {
  CHALLENGE_VALID = 'challenge_valid',
  CHALLENGE_INVALID = 'challenge_invalid',
  INSUFFICIENT_EVIDENCE = 'insufficient_evidence'
}

/**
 * 惩罚类型枚举
 */
export enum PenaltyType {
  COMPUTATION_ERROR = 'computation_error',
  DATA_UNAVAILABILITY = 'data_unavailability',
  FALSE_CHALLENGE = 'false_challenge',
  MALICIOUS_BEHAVIOR = 'malicious_behavior'
}

/**
 * 奖励类型枚举
 */
export enum RewardType {
  VALID_CHALLENGE = 'valid_challenge',
  HONEST_VALIDATION = 'honest_validation'
}

/**
 * Merkle证明接口
 */
export interface MerkleProof {
  leaf: string;
  path: string[];
  indices: number[];
  root: string;
}

/**
 * 挑战证据接口
 */
export interface ChallengeEvidence {
  type: string;
  data: any;
  proof?: MerkleProof;
  signature: string;
  timestamp: number;
}

/**
 * 惩罚接口
 */
export interface Penalty {
  nodeId: string;
  type: PenaltyType;
  amount: number;
  reason: string;
  timestamp: number;
}

/**
 * 奖励接口
 */
export interface Reward {
  nodeId: string;
  type: RewardType;
  amount: number;
  reason: string;
  timestamp: number;
}

/**
 * 挑战解决结果接口
 */
export interface ChallengeResolution {
  result: ResolutionResult;
  evidence: any;
  arbitrators: string[];
  timestamp: number;
  penalties: Penalty[];
  rewards: Reward[];
}

/**
 * 挑战接口
 */
export interface Challenge {
  id: string;
  batchCommitId: string;
  challenger: string;
  challengeType: ChallengeType;
  evidence: ChallengeEvidence;
  timestamp: number;
  windowDeadline: number;
  status: ChallengeStatus;
  resolution?: ChallengeResolution;
}

/**
 * 挑战窗口接口
 */
export interface ChallengeWindow {
  id: string;
  batchCommitId: string;
  startTime: number;
  endTime: number;
  status: WindowStatus;
  challenges: Challenge[];
  finalResult?: WindowResult;
}

/**
 * 窗口结果接口
 */
export interface WindowResult {
  batchValid: boolean;
  totalChallenges: number;
  validChallenges: number;
  invalidChallenges: number;
  totalPenalties: number;
  totalRewards: number;
  finalizationTime: number;
}

/**
 * 挑战窗口管理器配置
 */
export interface ChallengeWindowConfig {
  windowDurationMs: number;
  maxChallengesPerWindow: number;
  challengeTimeoutMs: number;
  resolutionTimeoutMs: number;
  selfNodeId: string;
  penalties: {
    computationError: number;
    dataUnavailability: number;
    falseChallenge: number;
    maliciousBehavior: number;
  };
  rewards: {
    validChallenge: number;
    honestValidation: number;
  };
}

/**
 * 挑战窗口管理器
 * 负责管理2秒挑战窗口，处理挑战提交和窗口生命周期
 */
export class ChallengeWindowManager extends EventEmitter {
  private config: ChallengeWindowConfig;
  private messageBus: MessageBus;
  private activeWindows: Map<string, ChallengeWindow>;
  private windowTimers: Map<string, NodeJS.Timeout>;
  private challengeCounter: number;
  private windowCounter: number;

  constructor(config: ChallengeWindowConfig, messageBus: MessageBus) {
    super();
    this.config = config;
    this.messageBus = messageBus;
    this.activeWindows = new Map();
    this.windowTimers = new Map();
    this.challengeCounter = 0;
    this.windowCounter = 0;

    this.setupMessageHandlers();
  }

  /**
   * 设置消息处理器
   */
  private setupMessageHandlers(): void {
    this.messageBus.subscribe({
      topic: 'challenge.submit',
      handler: {
        handle: async (message: Message) => {
          await this.handleChallengeSubmission(message);
        }
      }
    });

    this.messageBus.subscribe({
      topic: 'batch.commit',
      handler: {
        handle: async (message: Message) => {
          await this.handleBatchCommit(message);
        }
      }
    });
  }

  /**
   * 为批次提交开启挑战窗口
   */
  async openChallengeWindow(batchCommit: BatchCommit): Promise<ChallengeWindow> {
    const windowId = this.generateWindowId();
    const now = Date.now();

    const window: ChallengeWindow = {
      id: windowId,
      batchCommitId: batchCommit.id,
      startTime: now,
      endTime: now + this.config.windowDurationMs,
      status: WindowStatus.OPEN,
      challenges: []
    };

    this.activeWindows.set(windowId, window);

    // 设置窗口自动关闭定时器
    const timer = setTimeout(() => {
      this.closeWindow(windowId);
    }, this.config.windowDurationMs);

    this.windowTimers.set(windowId, timer);

    // 发布窗口开启事件
    await this.messageBus.publish('challenge.window.opened', {
      windowId,
      batchCommitId: batchCommit.id,
      deadline: window.endTime
    }, {
      priority: MessagePriority.HIGH
    });

    console.log(`Challenge window opened for batch ${batchCommit.id}, window: ${windowId}, deadline: ${new Date(window.endTime).toISOString()}`);

    return window;
  }

  /**
   * 提交挑战
   */
  async submitChallenge(
    windowId: string,
    challenger: string,
    challengeType: ChallengeType,
    evidence: ChallengeEvidence
  ): Promise<string | null> {
    const window = this.activeWindows.get(windowId);
    if (!window) {
      console.warn(`Challenge window not found: ${windowId}`);
      return null;
    }

    if (window.status !== WindowStatus.OPEN) {
      console.warn(`Challenge window is not open: ${windowId}, status: ${window.status}`);
      return null;
    }

    const now = Date.now();
    if (now > window.endTime) {
      console.warn(`Challenge window has expired: ${windowId}`);
      return null;
    }

    if (window.challenges.length >= this.config.maxChallengesPerWindow) {
      console.warn(`Maximum challenges reached for window: ${windowId}`);
      return null;
    }

    // 验证挑战有效性
    if (!await this.validateChallenge(challenger, challengeType, evidence)) {
      console.warn(`Invalid challenge from ${challenger} for window ${windowId}`);
      return null;
    }

    const challengeId = this.generateChallengeId();
    const challenge: Challenge = {
      id: challengeId,
      batchCommitId: window.batchCommitId,
      challenger,
      challengeType,
      evidence,
      timestamp: now,
      windowDeadline: window.endTime,
      status: ChallengeStatus.PENDING
    };

    window.challenges.push(challenge);

    // 发布挑战提交事件
    await this.messageBus.publish('challenge.submitted', {
      challengeId,
      windowId,
      challenger,
      challengeType,
      batchCommitId: window.batchCommitId
    }, {
      priority: MessagePriority.HIGH
    });

    console.log(`Challenge submitted: ${challengeId} by ${challenger} for batch ${window.batchCommitId}`);

    return challengeId;
  }

  /**
   * 关闭挑战窗口
   */
  private async closeWindow(windowId: string): Promise<void> {
    const window = this.activeWindows.get(windowId);
    if (!window) {
      return;
    }

    window.status = WindowStatus.CLOSED;

    // 清理定时器
    const timer = this.windowTimers.get(windowId);
    if (timer) {
      clearTimeout(timer);
      this.windowTimers.delete(windowId);
    }

    console.log(`Challenge window closed: ${windowId}, challenges: ${window.challenges.length}`);

    if (window.challenges.length > 0) {
      // 有挑战需要解决
      window.status = WindowStatus.RESOLVING;
      await this.startDisputeResolution(windowId);
    } else {
      // 没有挑战，直接确认批次
      await this.finalizeBatch(windowId, true);
    }
  }

  /**
   * 开始争议解决
   */
  private async startDisputeResolution(windowId: string): Promise<void> {
    const window = this.activeWindows.get(windowId);
    if (!window) {
      return;
    }

    console.log(`Starting dispute resolution for window ${windowId} with ${window.challenges.length} challenges`);

    // 发布争议解决开始事件
    await this.messageBus.publish('dispute.resolution.started', {
      windowId,
      batchCommitId: window.batchCommitId,
      challengeCount: window.challenges.length
    }, {
      priority: MessagePriority.HIGH
    });

    // 这里应该调用争议解决器，但为了简化，我们先模拟处理
    setTimeout(async () => {
      await this.mockDisputeResolution(windowId);
    }, 1000);
  }

  /**
   * 模拟争议解决（实际应该由DisputeResolver处理）
   */
  private async mockDisputeResolution(windowId: string): Promise<void> {
    const window = this.activeWindows.get(windowId);
    if (!window) {
      return;
    }

    let batchValid = true;
    const penalties: Penalty[] = [];
    const rewards: Reward[] = [];

    for (const challenge of window.challenges) {
      // 模拟解决结果（实际应该基于真实验证）
      const isValidChallenge = Math.random() < 0.3; // 30%概率是有效挑战

      if (isValidChallenge) {
        batchValid = false;
        challenge.status = ChallengeStatus.RESOLVED_VALID;
        
        // 添加惩罚和奖励
        penalties.push({
          nodeId: 'batch-producer', // 实际应该是批次生产者ID
          type: PenaltyType.COMPUTATION_ERROR,
          amount: this.config.penalties.computationError,
          reason: `Valid challenge: ${challenge.challengeType}`,
          timestamp: Date.now()
        });

        rewards.push({
          nodeId: challenge.challenger,
          type: RewardType.VALID_CHALLENGE,
          amount: this.config.rewards.validChallenge,
          reason: `Valid challenge: ${challenge.challengeType}`,
          timestamp: Date.now()
        });
      } else {
        challenge.status = ChallengeStatus.RESOLVED_INVALID;
        
        // 对虚假挑战者进行惩罚
        penalties.push({
          nodeId: challenge.challenger,
          type: PenaltyType.FALSE_CHALLENGE,
          amount: this.config.penalties.falseChallenge,
          reason: `Invalid challenge: ${challenge.challengeType}`,
          timestamp: Date.now()
        });
      }

      challenge.resolution = {
        result: isValidChallenge ? ResolutionResult.CHALLENGE_VALID : ResolutionResult.CHALLENGE_INVALID,
        evidence: { simulated: true },
        arbitrators: [this.config.selfNodeId],
        timestamp: Date.now(),
        penalties: penalties.filter(p => p.nodeId === challenge.challenger || p.nodeId === 'batch-producer'),
        rewards: rewards.filter(r => r.nodeId === challenge.challenger)
      };
    }

    // 执行惩罚和奖励
    if (penalties.length > 0) {
      await this.executePenalties(penalties);
    }

    if (rewards.length > 0) {
      await this.executeRewards(rewards);
    }

    await this.finalizeBatch(windowId, batchValid);
  }

  /**
   * 执行惩罚
   */
  private async executePenalties(penalties: Penalty[]): Promise<void> {
    for (const penalty of penalties) {
      await this.messageBus.publish('penalty.execute', penalty, {
        priority: MessagePriority.HIGH
      });
      console.log(`Penalty executed: ${penalty.nodeId} - ${penalty.type} - ${penalty.amount}`);
    }
  }

  /**
   * 执行奖励
   */
  private async executeRewards(rewards: Reward[]): Promise<void> {
    for (const reward of rewards) {
      await this.messageBus.publish('reward.execute', reward, {
        priority: MessagePriority.HIGH
      });
      console.log(`Reward executed: ${reward.nodeId} - ${reward.type} - ${reward.amount}`);
    }
  }

  /**
   * 最终确认批次
   */
  private async finalizeBatch(windowId: string, batchValid: boolean): Promise<void> {
    const window = this.activeWindows.get(windowId);
    if (!window) {
      return;
    }

    window.status = WindowStatus.FINALIZED;

    const validChallenges = window.challenges.filter(c => c.status === ChallengeStatus.RESOLVED_VALID).length;
    const invalidChallenges = window.challenges.filter(c => c.status === ChallengeStatus.RESOLVED_INVALID).length;

    window.finalResult = {
      batchValid,
      totalChallenges: window.challenges.length,
      validChallenges,
      invalidChallenges,
      totalPenalties: window.challenges.reduce((sum, c) => 
        sum + (c.resolution?.penalties.length || 0), 0),
      totalRewards: window.challenges.reduce((sum, c) => 
        sum + (c.resolution?.rewards.length || 0), 0),
      finalizationTime: Date.now()
    };

    // 发布批次最终确认事件
    await this.messageBus.publish('batch.finalized', {
      windowId,
      batchCommitId: window.batchCommitId,
      batchValid,
      result: window.finalResult
    }, {
      priority: MessagePriority.CRITICAL
    });

    console.log(`Batch finalized: ${window.batchCommitId}, valid: ${batchValid}, challenges: ${window.challenges.length}`);

    // 清理窗口
    this.activeWindows.delete(windowId);
  }

  /**
   * 验证挑战有效性
   */
  private async validateChallenge(
    challenger: string,
    challengeType: ChallengeType,
    evidence: ChallengeEvidence
  ): Promise<boolean> {
    try {
      // 1. 验证挑战者身份
      if (!challenger || challenger.length === 0) {
        return false;
      }

      // 2. 验证挑战类型
      if (!Object.values(ChallengeType).includes(challengeType)) {
        return false;
      }

      // 3. 验证证据格式
      if (!evidence || !evidence.type || !evidence.signature) {
        return false;
      }

      // 4. 验证时间戳
      const now = Date.now();
      if (Math.abs(now - evidence.timestamp) > 60000) { // 1分钟容差
        return false;
      }

      return true;
    } catch (error) {
      console.error('Challenge validation error:', error);
      return false;
    }
  }

  /**
   * 处理批次提交消息
   */
  private async handleBatchCommit(message: Message): Promise<void> {
    const batchCommit = message.payload as BatchCommit;
    await this.openChallengeWindow(batchCommit);
  }

  /**
   * 处理挑战提交消息
   */
  private async handleChallengeSubmission(message: Message): Promise<void> {
    const { windowId, challenger, challengeType, evidence } = message.payload;
    await this.submitChallenge(windowId, challenger, challengeType, evidence);
  }

  /**
   * 生成窗口ID
   */
  private generateWindowId(): string {
    return `window_${++this.windowCounter}_${Date.now()}`;
  }

  /**
   * 生成挑战ID
   */
  private generateChallengeId(): string {
    return `challenge_${++this.challengeCounter}_${Date.now()}`;
  }

  /**
   * 获取活跃窗口
   */
  getActiveWindows(): ChallengeWindow[] {
    return Array.from(this.activeWindows.values());
  }

  /**
   * 获取窗口统计信息
   */
  getWindowStats(): {
    activeWindows: number;
    totalChallenges: number;
    avgChallengesPerWindow: number;
  } {
    const windows = Array.from(this.activeWindows.values());
    const totalChallenges = windows.reduce((sum, w) => sum + w.challenges.length, 0);

    return {
      activeWindows: windows.length,
      totalChallenges,
      avgChallengesPerWindow: windows.length > 0 ? totalChallenges / windows.length : 0
    };
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    // 清理所有定时器
    for (const timer of this.windowTimers.values()) {
      clearTimeout(timer);
    }
    this.windowTimers.clear();

    // 清理活跃窗口
    this.activeWindows.clear();

    console.log('ChallengeWindowManager cleanup completed');
  }
}