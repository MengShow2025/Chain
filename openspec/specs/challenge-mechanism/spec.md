# 挑战机制技术规范

## 概述
挑战机制是链下撮合引擎的安全保障系统，通过2秒挑战窗口、争议解决和惩罚机制，确保链下计算结果的正确性和验证节点的诚实行为。

## 架构设计

### 整体架构
```
BatchCommit → 挑战窗口 → 争议解决 → 惩罚执行
     ↓           ↓          ↓          ↓
   发布结果    监听挑战    验证争议    执行惩罚
```

### 核心组件

#### 1. 挑战窗口管理器
- **功能**：管理2秒挑战窗口
- **职责**：窗口开启、关闭、状态跟踪
- **优化**：高精度计时、并发处理

#### 2. 争议检测器
- **功能**：检测和验证挑战
- **职责**：挑战有效性验证、证据收集
- **算法**：快速验证、批量处理

#### 3. 仲裁系统
- **功能**：解决争议和冲突
- **职责**：证据分析、结果裁决
- **机制**：多轮验证、共识决策

#### 4. 惩罚执行器
- **功能**：执行惩罚措施
- **职责**：质押扣除、节点降级
- **保障**：公平性、可追溯性

## 功能需求

### 核心功能
1. **挑战窗口**：2秒精确计时的挑战窗口
2. **挑战提交**：允许验证节点提交挑战
3. **争议解决**：自动化争议解决流程
4. **惩罚机制**：对恶意行为的惩罚措施
5. **激励机制**：对诚实挑战者的奖励

### 性能要求
- 挑战窗口精度：±10ms
- 挑战处理延迟：≤100ms
- 争议解决时间：≤30s
- 系统可用性：≥99.9%
- 误判率：≤0.1%

## 技术设计

### 数据结构

```typescript
interface Challenge {
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

interface ChallengeEvidence {
  type: EvidenceType;
  data: any;
  proof: MerkleProof;
  signature: string;
}

interface ChallengeResolution {
  result: ResolutionResult;
  evidence: any;
  arbitrators: string[];
  timestamp: number;
  penalties: Penalty[];
  rewards: Reward[];
}

interface ChallengeWindow {
  batchCommitId: string;
  startTime: number;
  endTime: number;
  status: WindowStatus;
  challenges: Challenge[];
  finalResult?: WindowResult;
}

enum ChallengeType {
  COMPUTATION_ERROR = 'computation_error',
  DATA_AVAILABILITY = 'data_availability',
  INVALID_STATE_TRANSITION = 'invalid_state_transition',
  MERKLE_ROOT_MISMATCH = 'merkle_root_mismatch',
  TIMESTAMP_MANIPULATION = 'timestamp_manipulation'
}

enum ChallengeStatus {
  PENDING = 'pending',
  UNDER_REVIEW = 'under_review',
  RESOLVED_VALID = 'resolved_valid',
  RESOLVED_INVALID = 'resolved_invalid',
  EXPIRED = 'expired'
}

enum WindowStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  RESOLVING = 'resolving',
  FINALIZED = 'finalized'
}
```

### 挑战窗口管理器

```typescript
class ChallengeWindowManager {
  private activeWindows: Map<string, ChallengeWindow> = new Map();
  private windowTimer: Map<string, NodeJS.Timeout> = new Map();
  private eventEmitter: EventEmitter;
  
  constructor(
    private config: ChallengeConfig,
    private disputeResolver: DisputeResolver,
    private penaltyExecutor: PenaltyExecutor
  ) {
    this.eventEmitter = new EventEmitter();
  }
  
  async openChallengeWindow(batchCommit: BatchCommit): Promise<ChallengeWindow> {
    const windowId = batchCommit.id;
    const startTime = Date.now();
    const endTime = startTime + this.config.windowDuration; // 2000ms
    
    const window: ChallengeWindow = {
      batchCommitId: windowId,
      startTime,
      endTime,
      status: WindowStatus.OPEN,
      challenges: []
    };
    
    this.activeWindows.set(windowId, window);
    
    // 设置自动关闭定时器
    const timer = setTimeout(async () => {
      await this.closeChallengeWindow(windowId);
    }, this.config.windowDuration);
    
    this.windowTimer.set(windowId, timer);
    
    // 发布窗口开启事件
    this.eventEmitter.emit('windowOpened', {
      windowId,
      batchCommit,
      deadline: endTime
    });
    
    console.log(`Challenge window opened for batch ${windowId}, deadline: ${new Date(endTime).toISOString()}`);
    
    return window;
  }
  
  async submitChallenge(challenge: Challenge): Promise<boolean> {
    const window = this.activeWindows.get(challenge.batchCommitId);
    
    if (!window) {
      throw new Error(`No active challenge window for batch ${challenge.batchCommitId}`);
    }
    
    if (window.status !== WindowStatus.OPEN) {
      throw new Error(`Challenge window is not open: ${window.status}`);
    }
    
    if (Date.now() > window.endTime) {
      throw new Error('Challenge window has expired');
    }
    
    // 验证挑战的有效性
    const isValid = await this.validateChallenge(challenge);
    if (!isValid) {
      throw new Error('Invalid challenge submitted');
    }
    
    // 添加挑战到窗口
    window.challenges.push(challenge);
    
    // 发布挑战提交事件
    this.eventEmitter.emit('challengeSubmitted', {
      challenge,
      windowId: window.batchCommitId
    });
    
    console.log(`Challenge ${challenge.id} submitted for batch ${challenge.batchCommitId}`);
    
    return true;
  }
  
  private async closeChallengeWindow(windowId: string): Promise<void> {
    const window = this.activeWindows.get(windowId);
    if (!window) return;
    
    window.status = WindowStatus.CLOSED;
    
    // 清理定时器
    const timer = this.windowTimer.get(windowId);
    if (timer) {
      clearTimeout(timer);
      this.windowTimer.delete(windowId);
    }
    
    console.log(`Challenge window closed for batch ${windowId}, challenges: ${window.challenges.length}`);
    
    // 如果有挑战，开始争议解决流程
    if (window.challenges.length > 0) {
      await this.startDisputeResolution(window);
    } else {
      // 没有挑战，直接确认批次
      await this.finalizeBatch(windowId, true);
    }
  }
  
  private async startDisputeResolution(window: ChallengeWindow): Promise<void> {
    window.status = WindowStatus.RESOLVING;
    
    console.log(`Starting dispute resolution for batch ${window.batchCommitId} with ${window.challenges.length} challenges`);
    
    try {
      const resolutions = await Promise.all(
        window.challenges.map(challenge => this.disputeResolver.resolve(challenge))
      );
      
      // 处理解决结果
      let batchValid = true;
      const penalties: Penalty[] = [];
      const rewards: Reward[] = [];
      
      for (let i = 0; i < window.challenges.length; i++) {
        const challenge = window.challenges[i];
        const resolution = resolutions[i];
        
        challenge.resolution = resolution;
        challenge.status = resolution.result === ResolutionResult.CHALLENGE_VALID 
          ? ChallengeStatus.RESOLVED_VALID 
          : ChallengeStatus.RESOLVED_INVALID;
        
        if (resolution.result === ResolutionResult.CHALLENGE_VALID) {
          batchValid = false;
          penalties.push(...resolution.penalties);
          rewards.push(...resolution.rewards);
        }
      }
      
      // 执行惩罚和奖励
      if (penalties.length > 0) {
        await this.penaltyExecutor.executePenalties(penalties);
      }
      
      if (rewards.length > 0) {
        await this.penaltyExecutor.executeRewards(rewards);
      }
      
      // 最终确认批次
      await this.finalizeBatch(window.batchCommitId, batchValid);
      
    } catch (error) {
      console.error(`Dispute resolution failed for batch ${window.batchCommitId}:`, error);
      // 争议解决失败，保守处理：拒绝批次
      await this.finalizeBatch(window.batchCommitId, false);
    }
  }
  
  private async finalizeBatch(batchCommitId: string, isValid: boolean): Promise<void> {
    const window = this.activeWindows.get(batchCommitId);
    if (!window) return;
    
    window.status = WindowStatus.FINALIZED;
    window.finalResult = {
      isValid,
      finalizedAt: Date.now(),
      challengeCount: window.challenges.length
    };
    
    // 发布批次最终确认事件
    this.eventEmitter.emit('batchFinalized', {
      batchCommitId,
      isValid,
      challengeCount: window.challenges.length
    });
    
    // 清理窗口
    this.activeWindows.delete(batchCommitId);
    
    console.log(`Batch ${batchCommitId} finalized: ${isValid ? 'VALID' : 'INVALID'}`);
  }
  
  private async validateChallenge(challenge: Challenge): Promise<boolean> {
    try {
      // 1. 验证挑战者身份
      if (!await this.isValidChallenger(challenge.challenger)) {
        return false;
      }
      
      // 2. 验证签名
      if (!await this.verifySignature(challenge)) {
        return false;
      }
      
      // 3. 验证证据格式
      if (!this.validateEvidenceFormat(challenge.evidence)) {
        return false;
      }
      
      // 4. 验证Merkle证明
      if (challenge.evidence.proof && !await this.verifyMerkleProof(challenge.evidence.proof)) {
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Challenge validation error:', error);
      return false;
    }
  }
}
```

### 争议解决器

```typescript
class DisputeResolver {
  private arbitrators: Map<string, ArbitratorNode> = new Map();
  private verificationCache: Map<string, VerificationResult> = new Map();
  
  constructor(
    private config: DisputeConfig,
    private casClient: ICASClient,
    private matchingEngine: IMatchingEngine
  ) {}
  
  async resolve(challenge: Challenge): Promise<ChallengeResolution> {
    console.log(`Resolving challenge ${challenge.id} of type ${challenge.challengeType}`);
    
    try {
      switch (challenge.challengeType) {
        case ChallengeType.COMPUTATION_ERROR:
          return await this.resolveComputationError(challenge);
        
        case ChallengeType.DATA_AVAILABILITY:
          return await this.resolveDataAvailability(challenge);
        
        case ChallengeType.INVALID_STATE_TRANSITION:
          return await this.resolveStateTransition(challenge);
        
        case ChallengeType.MERKLE_ROOT_MISMATCH:
          return await this.resolveMerkleRootMismatch(challenge);
        
        case ChallengeType.TIMESTAMP_MANIPULATION:
          return await this.resolveTimestampManipulation(challenge);
        
        default:
          throw new Error(`Unknown challenge type: ${challenge.challengeType}`);
      }
    } catch (error) {
      console.error(`Challenge resolution failed:`, error);
      return this.createInvalidResolution(challenge, error.message);
    }
  }
  
  private async resolveComputationError(challenge: Challenge): Promise<ChallengeResolution> {
    const evidence = challenge.evidence as ComputationErrorEvidence;
    
    // 1. 获取原始批次数据
    const batchData = await this.casClient.retrieve(CID.parse(evidence.batchCID));
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
          reason: 'Incorrect batch computation'
        }],
        rewards: [{
          nodeId: challenge.challenger,
          type: RewardType.VALID_CHALLENGE,
          amount: this.config.rewards.validChallenge,
          reason: 'Valid computation error challenge'
        }]
      };
    } else {
      // 挑战无效：计算是正确的
      return {
        result: ResolutionResult.CHALLENGE_INVALID,
        evidence: {
          originalResult,
          recomputedResult,
          verification: 'Results match'
        },
        arbitrators: [this.config.selfNodeId],
        timestamp: Date.now(),
        penalties: [{
          nodeId: challenge.challenger,
          type: PenaltyType.FALSE_CHALLENGE,
          amount: this.config.penalties.falseChallenge,
          reason: 'Invalid computation error challenge'
        }],
        rewards: []
      };
    }
  }
  
  private async resolveDataAvailability(challenge: Challenge): Promise<ChallengeResolution> {
    const evidence = challenge.evidence as DataAvailabilityEvidence;
    
    try {
      // 尝试从DA存储检索数据
      const data = await this.casClient.retrieve(CID.parse(evidence.claimedCID));
      
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
  
  private async resolveMerkleRootMismatch(challenge: Challenge): Promise<ChallengeResolution> {
    const evidence = challenge.evidence as MerkleRootEvidence;
    
    // 1. 获取批次数据
    const batchData = await this.casClient.retrieve(CID.parse(evidence.batchCID));
    const batch = JSON.parse(new TextDecoder().decode(batchData));
    
    // 2. 重新计算Merkle根
    const recomputedRoot = await this.computeMerkleRoot(batch.transactions);
    
    // 3. 比较根哈希
    const claimedRoot = evidence.claimedRoot;
    const isValid = recomputedRoot === claimedRoot;
    
    if (!isValid) {
      return this.createValidResolution(challenge, 'Merkle root mismatch confirmed');
    } else {
      return this.createInvalidResolution(challenge, 'Merkle root is correct');
    }
  }
  
  private createValidResolution(challenge: Challenge, reason: string): ChallengeResolution {
    return {
      result: ResolutionResult.CHALLENGE_VALID,
      evidence: { reason },
      arbitrators: [this.config.selfNodeId],
      timestamp: Date.now(),
      penalties: [{
        nodeId: this.extractAccusedNode(challenge),
        type: this.getPenaltyType(challenge.challengeType),
        amount: this.getPenaltyAmount(challenge.challengeType),
        reason
      }],
      rewards: [{
        nodeId: challenge.challenger,
        type: RewardType.VALID_CHALLENGE,
        amount: this.config.rewards.validChallenge,
        reason: `Valid ${challenge.challengeType} challenge`
      }]
    };
  }
  
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
        reason
      }],
      rewards: []
    };
  }
  
  private compareMatchingResults(result1: any, result2: any): boolean {
    // 深度比较撮合结果
    return JSON.stringify(this.normalizeResult(result1)) === 
           JSON.stringify(this.normalizeResult(result2));
  }
  
  private normalizeResult(result: any): any {
    // 标准化结果格式，忽略时间戳等非关键字段
    const normalized = { ...result };
    delete normalized.timestamp;
    delete normalized.processingTime;
    
    // 排序数组字段确保一致性
    if (normalized.matches) {
      normalized.matches.sort((a: any, b: any) => a.id.localeCompare(b.id));
    }
    
    return normalized;
  }
  
  private async computeMerkleRoot(transactions: any[]): Promise<string> {
    const hasher = new MerkleTreeHasher();
    return hasher.computeRoot(transactions);
  }
}
```

### 惩罚执行器

```typescript
class PenaltyExecutor {
  private stakingContract: IStakingContract;
  private reputationSystem: IReputationSystem;
  
  constructor(
    private config: PenaltyConfig,
    stakingContract: IStakingContract,
    reputationSystem: IReputationSystem
  ) {
    this.stakingContract = stakingContract;
    this.reputationSystem = reputationSystem;
  }
  
  async executePenalties(penalties: Penalty[]): Promise<void> {
    console.log(`Executing ${penalties.length} penalties`);
    
    for (const penalty of penalties) {
      try {
        await this.executePenalty(penalty);
      } catch (error) {
        console.error(`Failed to execute penalty for ${penalty.nodeId}:`, error);
      }
    }
  }
  
  async executeRewards(rewards: Reward[]): Promise<void> {
    console.log(`Executing ${rewards.length} rewards`);
    
    for (const reward of rewards) {
      try {
        await this.executeReward(reward);
      } catch (error) {
        console.error(`Failed to execute reward for ${reward.nodeId}:`, error);
      }
    }
  }
  
  private async executePenalty(penalty: Penalty): Promise<void> {
    switch (penalty.type) {
      case PenaltyType.COMPUTATION_ERROR:
        await this.handleComputationErrorPenalty(penalty);
        break;
      
      case PenaltyType.DATA_UNAVAILABILITY:
        await this.handleDataUnavailabilityPenalty(penalty);
        break;
      
      case PenaltyType.FALSE_CHALLENGE:
        await this.handleFalseChallengePenalty(penalty);
        break;
      
      default:
        throw new Error(`Unknown penalty type: ${penalty.type}`);
    }
    
    // 记录惩罚历史
    await this.recordPenalty(penalty);
  }
  
  private async handleComputationErrorPenalty(penalty: Penalty): Promise<void> {
    // 1. 扣除质押
    await this.stakingContract.slash(penalty.nodeId, penalty.amount);
    
    // 2. 降低信誉分数
    await this.reputationSystem.decreaseScore(penalty.nodeId, this.config.reputationPenalty.computationError);
    
    // 3. 如果错误严重，暂时禁用节点
    const errorCount = await this.getRecentErrorCount(penalty.nodeId);
    if (errorCount >= this.config.maxErrorsBeforeSuspension) {
      await this.suspendNode(penalty.nodeId, this.config.suspensionDuration);
    }
    
    console.log(`Computation error penalty executed for ${penalty.nodeId}: ${penalty.amount} tokens slashed`);
  }
  
  private async handleDataUnavailabilityPenalty(penalty: Penalty): Promise<void> {
    // 数据不可用是严重问题，执行更严厉的惩罚
    await this.stakingContract.slash(penalty.nodeId, penalty.amount);
    await this.reputationSystem.decreaseScore(penalty.nodeId, this.config.reputationPenalty.dataUnavailability);
    
    // 立即暂停节点
    await this.suspendNode(penalty.nodeId, this.config.suspensionDuration * 2);
    
    console.log(`Data unavailability penalty executed for ${penalty.nodeId}: node suspended`);
  }
  
  private async executeReward(reward: Reward): Promise<void> {
    switch (reward.type) {
      case RewardType.VALID_CHALLENGE:
        await this.handleValidChallengeReward(reward);
        break;
      
      default:
        throw new Error(`Unknown reward type: ${reward.type}`);
    }
    
    // 记录奖励历史
    await this.recordReward(reward);
  }
  
  private async handleValidChallengeReward(reward: Reward): Promise<void> {
    // 1. 发放奖励代币
    await this.stakingContract.reward(reward.nodeId, reward.amount);
    
    // 2. 提高信誉分数
    await this.reputationSystem.increaseScore(reward.nodeId, this.config.reputationReward.validChallenge);
    
    console.log(`Valid challenge reward executed for ${reward.nodeId}: ${reward.amount} tokens rewarded`);
  }
  
  private async suspendNode(nodeId: string, duration: number): Promise<void> {
    const suspensionEnd = Date.now() + duration;
    
    // 在验证节点管理器中标记节点为暂停状态
    await this.reputationSystem.suspendNode(nodeId, suspensionEnd);
    
    console.log(`Node ${nodeId} suspended until ${new Date(suspensionEnd).toISOString()}`);
  }
  
  private async getRecentErrorCount(nodeId: string): Promise<number> {
    const recentPeriod = Date.now() - this.config.errorCountWindow;
    return this.reputationSystem.getErrorCount(nodeId, recentPeriod);
  }
}
```

## 配置管理

### 配置结构

```typescript
interface ChallengeConfig {
  windowDuration: number; // 2000ms
  maxChallengesPerWindow: number;
  challengeDeposit: number;
  arbitrationTimeout: number;
  
  penalties: {
    computationError: number;
    dataUnavailability: number;
    falseChallenge: number;
    timestampManipulation: number;
  };
  
  rewards: {
    validChallenge: number;
    earlyDetection: number;
  };
  
  reputationPenalty: {
    computationError: number;
    dataUnavailability: number;
    falseChallenge: number;
  };
  
  reputationReward: {
    validChallenge: number;
  };
  
  maxErrorsBeforeSuspension: number;
  suspensionDuration: number;
  errorCountWindow: number;
}
```

### 配置示例

```json
{
  "challenge": {
    "windowDuration": 2000,
    "maxChallengesPerWindow": 10,
    "challengeDeposit": 100,
    "arbitrationTimeout": 30000,
    
    "penalties": {
      "computationError": 1000,
      "dataUnavailability": 5000,
      "falseChallenge": 500,
      "timestampManipulation": 2000
    },
    
    "rewards": {
      "validChallenge": 200,
      "earlyDetection": 100
    },
    
    "reputationPenalty": {
      "computationError": 10,
      "dataUnavailability": 50,
      "falseChallenge": 5
    },
    
    "reputationReward": {
      "validChallenge": 5
    },
    
    "maxErrorsBeforeSuspension": 3,
    "suspensionDuration": 3600000,
    "errorCountWindow": 86400000
  }
}
```

## 监控和告警

### 关键指标
- 挑战窗口准确性
- 挑战处理延迟
- 争议解决成功率
- 惩罚执行成功率
- 节点信誉分数变化

### 告警规则
- 挑战窗口计时异常
- 争议解决超时
- 惩罚执行失败
- 恶意节点检测
- 系统可用性下降

## 测试策略

### 单元测试
- 挑战窗口计时精度
- 争议解决逻辑
- 惩罚计算准确性
- 奖励分发机制

### 集成测试
- 端到端挑战流程
- 多节点协同测试
- 恶意行为模拟
- 性能压力测试

### 安全测试
- 挑战机制绕过测试
- 恶意挑战防护
- 共谋攻击防护
- 经济激励平衡测试