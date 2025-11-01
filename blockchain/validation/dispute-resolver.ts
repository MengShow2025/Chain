import { EventEmitter } from 'events';
import { MessageBus, Message, MessagePriority } from '../messaging/message-bus.js';
import { casClient } from '../../shared/da/cas-client.js';
import { CID } from 'multiformats/cid';
import { 
  Challenge, 
  ChallengeType, 
  ChallengeResolution, 
  ResolutionResult, 
  PenaltyType, 
  RewardType,
  Penalty,
  Reward,
  ChallengeEvidence 
} from './challenge-window-manager.js';
import { MatchingEngine } from '../matching/matching-engine.js';

/**
 * 计算错误证据接口
 */
export interface ComputationErrorEvidence extends ChallengeEvidence {
  batchCID: string;
  originalResult: any;
  accusedNode: string;
  recomputedResult?: any;
}

/**
 * 数据可用性证据接口
 */
export interface DataAvailabilityEvidence extends ChallengeEvidence {
  claimedCID: string;
  expectedHash: string;
  retrievalAttempts: number;
}

/**
 * 状态转换证据接口
 */
export interface StateTransitionEvidence extends ChallengeEvidence {
  beforeState: any;
  afterState: any;
  transactions: any[];
  expectedAfterState: any;
}

/**
 * Merkle根不匹配证据接口
 */
export interface MerkleRootMismatchEvidence extends ChallengeEvidence {
  claimedRoot: string;
  recomputedRoot: string;
  leafData: any[];
}

/**
 * 争议解决器配置
 */
export interface DisputeResolverConfig {
  selfNodeId: string;
  resolutionTimeoutMs: number;
  maxRecomputationAttempts: number;
  dataRetrievalTimeoutMs: number;
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
 * 争议解决器
 * 负责处理验证争议，分析证据，做出仲裁决策
 */
export class DisputeResolver extends EventEmitter {
  private config: DisputeResolverConfig;
  private messageBus: MessageBus;
  private matchingEngine: MatchingEngine;
  private activeResolutions: Map<string, Promise<ChallengeResolution>>;

  constructor(
    config: DisputeResolverConfig, 
    messageBus: MessageBus,
    matchingEngine: MatchingEngine
  ) {
    super();
    this.config = config;
    this.messageBus = messageBus;
    this.matchingEngine = matchingEngine;
    this.activeResolutions = new Map();

    this.setupMessageHandlers();
  }

  /**
   * 设置消息处理器
   */
  private setupMessageHandlers(): void {
    this.messageBus.subscribe({
      topic: 'dispute.resolution.request',
      handler: {
        handle: async (message: Message) => {
          await this.handleResolutionRequest(message);
        }
      }
    });
  }

  /**
   * 解决挑战争议
   */
  async resolve(challenge: Challenge): Promise<ChallengeResolution> {
    // 检查是否已经在处理中
    if (this.activeResolutions.has(challenge.id)) {
      return await this.activeResolutions.get(challenge.id)!;
    }

    console.log(`Starting dispute resolution for challenge ${challenge.id}, type: ${challenge.challengeType}`);

    // 创建解决Promise并缓存
    const resolutionPromise = this.performResolution(challenge);
    this.activeResolutions.set(challenge.id, resolutionPromise);

    try {
      const resolution = await resolutionPromise;
      
      // 发布解决结果
      await this.messageBus.publish('dispute.resolved', {
        challengeId: challenge.id,
        resolution
      }, {
        priority: MessagePriority.HIGH
      });

      return resolution;
    } finally {
      this.activeResolutions.delete(challenge.id);
    }
  }

  /**
   * 执行争议解决
   */
  private async performResolution(challenge: Challenge): Promise<ChallengeResolution> {
    const startTime = Date.now();

    try {
      let resolution: ChallengeResolution;

      switch (challenge.challengeType) {
        case ChallengeType.COMPUTATION_ERROR:
          resolution = await this.resolveComputationError(challenge);
          break;
        
        case ChallengeType.DATA_AVAILABILITY:
          resolution = await this.resolveDataAvailability(challenge);
          break;
        
        case ChallengeType.INVALID_STATE_TRANSITION:
          resolution = await this.resolveStateTransition(challenge);
          break;
        
        case ChallengeType.MERKLE_ROOT_MISMATCH:
          resolution = await this.resolveMerkleRootMismatch(challenge);
          break;
        
        case ChallengeType.TIMESTAMP_MANIPULATION:
          resolution = await this.resolveTimestampManipulation(challenge);
          break;
        
        default:
          resolution = this.createInsufficientEvidenceResolution(challenge, 'Unknown challenge type');
      }

      const processingTime = Date.now() - startTime;
      console.log(`Challenge ${challenge.id} resolved in ${processingTime}ms: ${resolution.result}`);

      return resolution;
    } catch (error) {
      console.error(`Error resolving challenge ${challenge.id}:`, error);
      return this.createInsufficientEvidenceResolution(challenge, `Resolution error: ${error.message}`);
    }
  }

  /**
   * 解决计算错误争议
   */
  private async resolveComputationError(challenge: Challenge): Promise<ChallengeResolution> {
    const evidence = challenge.evidence as ComputationErrorEvidence;
    
    try {
      // 1. 获取原始批次数据
      const batchData = await casClient.retrieve(CID.parse(evidence.batchCID));
      const batch = JSON.parse(new TextDecoder().decode(batchData));
      
      // 2. 重新执行撮合计算
      const recomputedResult = await this.matchingEngine.processBatch(batch.orders);
      
      // 3. 比较结果
      const originalResult = evidence.originalResult;
      const isValid = this.compareMatchingResults(originalResult, recomputedResult);
      
      if (!isValid) {
        // 挑战有效：计算确实有错误
        return {
          result: ResolutionResult.CHALLENGE_VALID,
          evidence: {
            originalResult,
            recomputedResult,
            differences: this.findDifferences(originalResult, recomputedResult)
          },
          arbitrators: [this.config.selfNodeId],
          timestamp: Date.now(),
          penalties: [{
            nodeId: evidence.accusedNode,
            type: PenaltyType.COMPUTATION_ERROR,
            amount: this.config.penalties.computationError,
            reason: 'Incorrect batch computation',
            timestamp: Date.now()
          }],
          rewards: [{
            nodeId: challenge.challenger,
            type: RewardType.VALID_CHALLENGE,
            amount: this.config.rewards.validChallenge,
            reason: 'Valid computation error challenge',
            timestamp: Date.now()
          }]
        };
      } else {
        // 挑战无效：计算是正确的
        return this.createInvalidResolution(challenge, 'Computation results match');
      }
    } catch (error) {
      console.error('Error in computation error resolution:', error);
      return this.createInsufficientEvidenceResolution(challenge, `Cannot verify computation: ${error.message}`);
    }
  }

  /**
   * 解决数据可用性争议
   */
  private async resolveDataAvailability(challenge: Challenge): Promise<ChallengeResolution> {
    const evidence = challenge.evidence as DataAvailabilityEvidence;
    
    try {
      // 尝试从DA存储检索数据
      const retrievalPromise = casClient.retrieve(CID.parse(evidence.claimedCID));
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Retrieval timeout')), this.config.dataRetrievalTimeoutMs)
      );

      const data = await Promise.race([retrievalPromise, timeoutPromise]) as Uint8Array;
      
      // 验证数据完整性
      const isValid = await this.verifyDataIntegrity(data, evidence.expectedHash);
      
      if (isValid) {
        // 数据可用且完整，挑战无效
        return this.createInvalidResolution(challenge, 'Data is available and valid');
      } else {
        // 数据损坏，挑战有效
        return this.createValidResolution(challenge, 'Data integrity verification failed');
      }
    } catch (error) {
      // 数据不可用，挑战有效
      return this.createValidResolution(challenge, `Data not available: ${error.message}`);
    }
  }

  /**
   * 解决状态转换争议
   */
  private async resolveStateTransition(challenge: Challenge): Promise<ChallengeResolution> {
    const evidence = challenge.evidence as StateTransitionEvidence;
    
    try {
      // 重新执行状态转换
      const recomputedState = await this.recomputeStateTransition(
        evidence.beforeState,
        evidence.transactions
      );
      
      // 比较状态
      const isValid = this.compareStates(evidence.afterState, recomputedState);
      
      if (!isValid) {
        return this.createValidResolution(challenge, 'State transition is incorrect');
      } else {
        return this.createInvalidResolution(challenge, 'State transition is correct');
      }
    } catch (error) {
      return this.createInsufficientEvidenceResolution(challenge, `Cannot verify state transition: ${error.message}`);
    }
  }

  /**
   * 解决Merkle根不匹配争议
   */
  private async resolveMerkleRootMismatch(challenge: Challenge): Promise<ChallengeResolution> {
    const evidence = challenge.evidence as MerkleRootMismatchEvidence;
    
    try {
      // 重新计算Merkle根
      const recomputedRoot = await this.computeMerkleRoot(evidence.leafData);
      
      // 比较根值
      if (evidence.claimedRoot !== recomputedRoot) {
        return this.createValidResolution(challenge, 'Merkle root mismatch confirmed');
      } else {
        return this.createInvalidResolution(challenge, 'Merkle root is correct');
      }
    } catch (error) {
      return this.createInsufficientEvidenceResolution(challenge, `Cannot verify Merkle root: ${error.message}`);
    }
  }

  /**
   * 解决时间戳操纵争议
   */
  private async resolveTimestampManipulation(challenge: Challenge): Promise<ChallengeResolution> {
    const evidence = challenge.evidence;
    
    try {
      // 检查时间戳是否在合理范围内
      const now = Date.now();
      const timestamp = evidence.timestamp;
      const tolerance = 300000; // 5分钟容差
      
      if (Math.abs(now - timestamp) > tolerance) {
        return this.createValidResolution(challenge, 'Timestamp manipulation detected');
      } else {
        return this.createInvalidResolution(challenge, 'Timestamp is within acceptable range');
      }
    } catch (error) {
      return this.createInsufficientEvidenceResolution(challenge, `Cannot verify timestamp: ${error.message}`);
    }
  }

  /**
   * 比较撮合结果
   */
  private compareMatchingResults(result1: any, result2: any): boolean {
    try {
      // 简化的比较逻辑，实际应该更严格
      return JSON.stringify(result1) === JSON.stringify(result2);
    } catch (error) {
      console.error('Error comparing matching results:', error);
      return false;
    }
  }

  /**
   * 找出结果差异
   */
  private findDifferences(result1: any, result2: any): any {
    // 简化的差异检测，实际应该更详细
    return {
      original: result1,
      recomputed: result2,
      timestamp: Date.now()
    };
  }

  /**
   * 验证数据完整性
   */
  private async verifyDataIntegrity(data: Uint8Array, expectedHash: string): Promise<boolean> {
    try {
      // 使用简单的哈希验证，实际应该使用更强的哈希算法
      const crypto = await import('crypto');
      const hash = crypto.createHash('sha256').update(data).digest('hex');
      return hash === expectedHash;
    } catch (error) {
      console.error('Error verifying data integrity:', error);
      return false;
    }
  }

  /**
   * 重新计算状态转换
   */
  private async recomputeStateTransition(beforeState: any, transactions: any[]): Promise<any> {
    // 简化的状态转换重计算
    let state = { ...beforeState };
    
    for (const tx of transactions) {
      // 应用交易到状态
      state = this.applyTransaction(state, tx);
    }
    
    return state;
  }

  /**
   * 应用交易到状态
   */
  private applyTransaction(state: any, transaction: any): any {
    // 简化的交易应用逻辑
    return { ...state, lastTransaction: transaction };
  }

  /**
   * 比较状态
   */
  private compareStates(state1: any, state2: any): boolean {
    try {
      return JSON.stringify(state1) === JSON.stringify(state2);
    } catch (error) {
      console.error('Error comparing states:', error);
      return false;
    }
  }

  /**
   * 计算Merkle根
   */
  private async computeMerkleRoot(leafData: any[]): Promise<string> {
    // 简化的Merkle根计算
    const crypto = await import('crypto');
    const leaves = leafData.map(data => 
      crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex')
    );
    
    if (leaves.length === 0) return '';
    if (leaves.length === 1) return leaves[0];
    
    // 简单的两两配对哈希
    let level = leaves;
    while (level.length > 1) {
      const nextLevel = [];
      for (let i = 0; i < level.length; i += 2) {
        const left = level[i];
        const right = level[i + 1] || left;
        const combined = crypto.createHash('sha256').update(left + right).digest('hex');
        nextLevel.push(combined);
      }
      level = nextLevel;
    }
    
    return level[0];
  }

  /**
   * 创建有效挑战解决结果
   */
  private createValidResolution(challenge: Challenge, reason: string): ChallengeResolution {
    return {
      result: ResolutionResult.CHALLENGE_VALID,
      evidence: { reason },
      arbitrators: [this.config.selfNodeId],
      timestamp: Date.now(),
      penalties: [{
        nodeId: 'accused-node', // 实际应该从证据中获取
        type: PenaltyType.COMPUTATION_ERROR,
        amount: this.config.penalties.computationError,
        reason,
        timestamp: Date.now()
      }],
      rewards: [{
        nodeId: challenge.challenger,
        type: RewardType.VALID_CHALLENGE,
        amount: this.config.rewards.validChallenge,
        reason,
        timestamp: Date.now()
      }]
    };
  }

  /**
   * 创建无效挑战解决结果
   */
  private createInvalidResolution(challenge: Challenge, reason: string): ChallengeResolution {
    return {
      result: ResolutionResult.CHALLENGE_INVALID,
      evidence: { reason },
      arbitrators: [this.config.selfNodeId],
      timestamp: Date.now(),
      penalties: [{
        nodeId: challenge.challenger,
        type: PenaltyType.FALSE_CHALLENGE,
        amount: this.config.penalties.falseChallenge,
        reason,
        timestamp: Date.now()
      }],
      rewards: []
    };
  }

  /**
   * 创建证据不足解决结果
   */
  private createInsufficientEvidenceResolution(challenge: Challenge, reason: string): ChallengeResolution {
    return {
      result: ResolutionResult.INSUFFICIENT_EVIDENCE,
      evidence: { reason },
      arbitrators: [this.config.selfNodeId],
      timestamp: Date.now(),
      penalties: [],
      rewards: []
    };
  }

  /**
   * 处理解决请求消息
   */
  private async handleResolutionRequest(message: Message): Promise<void> {
    const { challenge } = message.payload;
    await this.resolve(challenge);
  }

  /**
   * 获取活跃解决任务
   */
  getActiveResolutions(): string[] {
    return Array.from(this.activeResolutions.keys());
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    // 等待所有活跃的解决任务完成
    const activePromises = Array.from(this.activeResolutions.values());
    if (activePromises.length > 0) {
      console.log(`Waiting for ${activePromises.length} active resolutions to complete...`);
      await Promise.allSettled(activePromises);
    }

    this.activeResolutions.clear();
    console.log('DisputeResolver cleanup completed');
  }
}