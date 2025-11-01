import { EventEmitter } from 'events';
import { MessageBus, Message, MessagePriority } from '../messaging/message-bus.js';
import { Penalty, Reward, PenaltyType, RewardType } from './challenge-window-manager.js';

/**
 * 节点信誉信息
 */
export interface NodeReputation {
  nodeId: string;
  score: number;
  totalPenalties: number;
  totalRewards: number;
  lastUpdate: number;
  status: NodeStatus;
  history: ReputationEvent[];
}

/**
 * 节点状态枚举
 */
export enum NodeStatus {
  ACTIVE = 'active',
  WARNING = 'warning',
  SUSPENDED = 'suspended',
  BANNED = 'banned'
}

/**
 * 信誉事件
 */
export interface ReputationEvent {
  type: 'penalty' | 'reward';
  amount: number;
  reason: string;
  timestamp: number;
  relatedChallenge?: string;
}

/**
 * 惩罚执行记录
 */
export interface PenaltyExecution {
  id: string;
  penalty: Penalty;
  executionTime: number;
  success: boolean;
  error?: string;
  previousReputation: number;
  newReputation: number;
}

/**
 * 奖励执行记录
 */
export interface RewardExecution {
  id: string;
  reward: Reward;
  executionTime: number;
  success: boolean;
  error?: string;
  previousReputation: number;
  newReputation: number;
}

/**
 * 惩罚执行器配置
 */
export interface PenaltyExecutorConfig {
  // 信誉分数配置
  initialReputationScore: number;
  maxReputationScore: number;
  minReputationScore: number;
  
  // 惩罚配置
  penaltyMultipliers: {
    [key in PenaltyType]: number;
  };
  
  // 奖励配置
  rewardMultipliers: {
    [key in RewardType]: number;
  };
  
  // 状态阈值
  warningThreshold: number;
  suspensionThreshold: number;
  banThreshold: number;
  
  // 恢复配置
  reputationDecayRate: number; // 每天的信誉恢复率
  maxHistoryDays: number;
  
  // 执行配置
  maxRetries: number;
  retryDelayMs: number;
}

/**
 * 惩罚执行器
 * 负责执行惩罚措施，管理节点信誉，维护网络安全
 */
export class PenaltyExecutor extends EventEmitter {
  private config: PenaltyExecutorConfig;
  private messageBus: MessageBus;
  private nodeReputations: Map<string, NodeReputation>;
  private executionHistory: Map<string, PenaltyExecution | RewardExecution>;
  private executionCounter: number;

  constructor(config: PenaltyExecutorConfig, messageBus: MessageBus) {
    super();
    this.config = config;
    this.messageBus = messageBus;
    this.nodeReputations = new Map();
    this.executionHistory = new Map();
    this.executionCounter = 0;

    this.setupMessageHandlers();
    this.startReputationDecayTimer();
  }

  /**
   * 设置消息处理器
   */
  private setupMessageHandlers(): void {
    this.messageBus.subscribe({
      topic: 'penalty.execute',
      handler: {
        handle: async (message: Message) => {
          await this.executePenalty(message.payload as Penalty);
        }
      }
    });

    this.messageBus.subscribe({
      topic: 'reward.execute',
      handler: {
        handle: async (message: Message) => {
          await this.executeReward(message.payload as Reward);
        }
      }
    });

    this.messageBus.subscribe({
      topic: 'reputation.query',
      handler: {
        handle: async (message: Message) => {
          await this.handleReputationQuery(message);
        }
      }
    });
  }

  /**
   * 执行惩罚
   */
  async executePenalty(penalty: Penalty): Promise<PenaltyExecution> {
    const executionId = this.generateExecutionId();
    console.log(`Executing penalty ${executionId} for node ${penalty.nodeId}: ${penalty.type} - ${penalty.amount}`);

    try {
      // 获取或创建节点信誉
      const reputation = this.getOrCreateReputation(penalty.nodeId);
      const previousScore = reputation.score;

      // 计算惩罚影响
      const penaltyImpact = this.calculatePenaltyImpact(penalty);
      const newScore = Math.max(
        this.config.minReputationScore,
        reputation.score - penaltyImpact
      );

      // 更新信誉
      reputation.score = newScore;
      reputation.totalPenalties += penalty.amount;
      reputation.lastUpdate = Date.now();
      reputation.history.push({
        type: 'penalty',
        amount: penalty.amount,
        reason: penalty.reason,
        timestamp: penalty.timestamp
      });

      // 更新节点状态
      this.updateNodeStatus(reputation);

      // 创建执行记录
      const execution: PenaltyExecution = {
        id: executionId,
        penalty,
        executionTime: Date.now(),
        success: true,
        previousReputation: previousScore,
        newReputation: newScore
      };

      this.executionHistory.set(executionId, execution);

      // 发布惩罚执行事件
      await this.messageBus.publish('penalty.executed', {
        executionId,
        nodeId: penalty.nodeId,
        penaltyType: penalty.type,
        amount: penalty.amount,
        previousScore: previousScore,
        newScore: newScore,
        nodeStatus: reputation.status
      }, {
        priority: MessagePriority.HIGH
      });

      // 如果节点被暂停或禁止，发布特殊事件
      if (reputation.status === NodeStatus.SUSPENDED || reputation.status === NodeStatus.BANNED) {
        await this.messageBus.publish('node.status.changed', {
          nodeId: penalty.nodeId,
          oldStatus: this.getPreviousStatus(previousScore),
          newStatus: reputation.status,
          reason: penalty.reason
        }, {
          priority: MessagePriority.CRITICAL
        });
      }

      console.log(`Penalty executed successfully: ${penalty.nodeId} score ${previousScore} -> ${newScore}, status: ${reputation.status}`);
      return execution;

    } catch (error) {
      console.error(`Failed to execute penalty ${executionId}:`, error);
      
      const execution: PenaltyExecution = {
        id: executionId,
        penalty,
        executionTime: Date.now(),
        success: false,
        error: error.message,
        previousReputation: 0,
        newReputation: 0
      };

      this.executionHistory.set(executionId, execution);
      return execution;
    }
  }

  /**
   * 执行奖励
   */
  async executeReward(reward: Reward): Promise<RewardExecution> {
    const executionId = this.generateExecutionId();
    console.log(`Executing reward ${executionId} for node ${reward.nodeId}: ${reward.type} - ${reward.amount}`);

    try {
      // 获取或创建节点信誉
      const reputation = this.getOrCreateReputation(reward.nodeId);
      const previousScore = reputation.score;

      // 计算奖励影响
      const rewardImpact = this.calculateRewardImpact(reward);
      const newScore = Math.min(
        this.config.maxReputationScore,
        reputation.score + rewardImpact
      );

      // 更新信誉
      reputation.score = newScore;
      reputation.totalRewards += reward.amount;
      reputation.lastUpdate = Date.now();
      reputation.history.push({
        type: 'reward',
        amount: reward.amount,
        reason: reward.reason,
        timestamp: reward.timestamp
      });

      // 更新节点状态
      this.updateNodeStatus(reputation);

      // 创建执行记录
      const execution: RewardExecution = {
        id: executionId,
        reward,
        executionTime: Date.now(),
        success: true,
        previousReputation: previousScore,
        newReputation: newScore
      };

      this.executionHistory.set(executionId, execution);

      // 发布奖励执行事件
      await this.messageBus.publish('reward.executed', {
        executionId,
        nodeId: reward.nodeId,
        rewardType: reward.type,
        amount: reward.amount,
        previousScore: previousScore,
        newScore: newScore,
        nodeStatus: reputation.status
      }, {
        priority: MessagePriority.NORMAL
      });

      console.log(`Reward executed successfully: ${reward.nodeId} score ${previousScore} -> ${newScore}, status: ${reputation.status}`);
      return execution;

    } catch (error) {
      console.error(`Failed to execute reward ${executionId}:`, error);
      
      const execution: RewardExecution = {
        id: executionId,
        reward,
        executionTime: Date.now(),
        success: false,
        error: error.message,
        previousReputation: 0,
        newReputation: 0
      };

      this.executionHistory.set(executionId, execution);
      return execution;
    }
  }

  /**
   * 批量执行惩罚
   */
  async executePenalties(penalties: Penalty[]): Promise<PenaltyExecution[]> {
    console.log(`Executing ${penalties.length} penalties in batch`);
    
    const executions = await Promise.all(
      penalties.map(penalty => this.executePenalty(penalty))
    );

    const successCount = executions.filter(e => e.success).length;
    console.log(`Batch penalty execution completed: ${successCount}/${penalties.length} successful`);

    return executions;
  }

  /**
   * 批量执行奖励
   */
  async executeRewards(rewards: Reward[]): Promise<RewardExecution[]> {
    console.log(`Executing ${rewards.length} rewards in batch`);
    
    const executions = await Promise.all(
      rewards.map(reward => this.executeReward(reward))
    );

    const successCount = executions.filter(e => e.success).length;
    console.log(`Batch reward execution completed: ${successCount}/${rewards.length} successful`);

    return executions;
  }

  /**
   * 获取或创建节点信誉
   */
  private getOrCreateReputation(nodeId: string): NodeReputation {
    if (!this.nodeReputations.has(nodeId)) {
      const reputation: NodeReputation = {
        nodeId,
        score: this.config.initialReputationScore,
        totalPenalties: 0,
        totalRewards: 0,
        lastUpdate: Date.now(),
        status: NodeStatus.ACTIVE,
        history: []
      };
      this.nodeReputations.set(nodeId, reputation);
    }
    return this.nodeReputations.get(nodeId)!;
  }

  /**
   * 计算惩罚影响
   */
  private calculatePenaltyImpact(penalty: Penalty): number {
    const multiplier = this.config.penaltyMultipliers[penalty.type] || 1;
    return penalty.amount * multiplier;
  }

  /**
   * 计算奖励影响
   */
  private calculateRewardImpact(reward: Reward): number {
    const multiplier = this.config.rewardMultipliers[reward.type] || 1;
    return reward.amount * multiplier;
  }

  /**
   * 更新节点状态
   */
  private updateNodeStatus(reputation: NodeReputation): void {
    const score = reputation.score;
    
    if (score <= this.config.banThreshold) {
      reputation.status = NodeStatus.BANNED;
    } else if (score <= this.config.suspensionThreshold) {
      reputation.status = NodeStatus.SUSPENDED;
    } else if (score <= this.config.warningThreshold) {
      reputation.status = NodeStatus.WARNING;
    } else {
      reputation.status = NodeStatus.ACTIVE;
    }
  }

  /**
   * 获取之前的状态
   */
  private getPreviousStatus(score: number): NodeStatus {
    if (score <= this.config.banThreshold) {
      return NodeStatus.BANNED;
    } else if (score <= this.config.suspensionThreshold) {
      return NodeStatus.SUSPENDED;
    } else if (score <= this.config.warningThreshold) {
      return NodeStatus.WARNING;
    } else {
      return NodeStatus.ACTIVE;
    }
  }

  /**
   * 启动信誉衰减定时器
   */
  private startReputationDecayTimer(): void {
    // 每小时检查一次信誉衰减
    setInterval(() => {
      this.applyReputationDecay();
    }, 60 * 60 * 1000);
  }

  /**
   * 应用信誉衰减
   */
  private applyReputationDecay(): void {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    
    for (const reputation of this.nodeReputations.values()) {
      const daysSinceUpdate = (now - reputation.lastUpdate) / dayMs;
      
      if (daysSinceUpdate >= 1) {
        // 应用衰减恢复
        const decayAmount = this.config.reputationDecayRate * Math.floor(daysSinceUpdate);
        const newScore = Math.min(
          this.config.maxReputationScore,
          reputation.score + decayAmount
        );
        
        if (newScore !== reputation.score) {
          const oldStatus = reputation.status;
          reputation.score = newScore;
          reputation.lastUpdate = now;
          this.updateNodeStatus(reputation);
          
          console.log(`Applied reputation decay to ${reputation.nodeId}: ${reputation.score} -> ${newScore}, status: ${oldStatus} -> ${reputation.status}`);
        }
      }
      
      // 清理旧历史记录
      const maxAge = this.config.maxHistoryDays * dayMs;
      reputation.history = reputation.history.filter(
        event => (now - event.timestamp) <= maxAge
      );
    }
  }

  /**
   * 处理信誉查询
   */
  private async handleReputationQuery(message: Message): Promise<void> {
    const { nodeId, replyTo } = message.payload;
    const reputation = this.nodeReputations.get(nodeId);
    
    if (replyTo) {
      await this.messageBus.publish(replyTo, {
        nodeId,
        reputation: reputation || null,
        timestamp: Date.now()
      });
    }
  }

  /**
   * 生成执行ID
   */
  private generateExecutionId(): string {
    return `exec_${++this.executionCounter}_${Date.now()}`;
  }

  /**
   * 获取节点信誉
   */
  getNodeReputation(nodeId: string): NodeReputation | null {
    return this.nodeReputations.get(nodeId) || null;
  }

  /**
   * 获取所有节点信誉
   */
  getAllReputations(): NodeReputation[] {
    return Array.from(this.nodeReputations.values());
  }

  /**
   * 获取执行历史
   */
  getExecutionHistory(): (PenaltyExecution | RewardExecution)[] {
    return Array.from(this.executionHistory.values());
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalNodes: number;
    activeNodes: number;
    suspendedNodes: number;
    bannedNodes: number;
    totalExecutions: number;
    successfulExecutions: number;
  } {
    const reputations = Array.from(this.nodeReputations.values());
    const executions = Array.from(this.executionHistory.values());
    
    return {
      totalNodes: reputations.length,
      activeNodes: reputations.filter(r => r.status === NodeStatus.ACTIVE).length,
      suspendedNodes: reputations.filter(r => r.status === NodeStatus.SUSPENDED).length,
      bannedNodes: reputations.filter(r => r.status === NodeStatus.BANNED).length,
      totalExecutions: executions.length,
      successfulExecutions: executions.filter(e => e.success).length
    };
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    // 这里可以添加清理逻辑，比如保存状态到持久化存储
    console.log('PenaltyExecutor cleanup completed');
  }
}