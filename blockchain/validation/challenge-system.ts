import { EventEmitter } from 'events';
import { MessageBus, Message, MessagePriority } from '../messaging/message-bus.js';
import { BatchCommit } from '../../shared/types/blockchain.js';
import { ChallengeWindowManager, ChallengeWindowConfig } from './challenge-window-manager.js';
import { DisputeResolver, DisputeResolverConfig } from './dispute-resolver.js';
import { PenaltyExecutor, PenaltyExecutorConfig } from './penalty-executor.js';
import { MatchingEngine } from '../matching/matching-engine.js';

/**
 * 挑战系统配置
 */
export interface ChallengeSystemConfig {
  // 基础配置
  selfNodeId: string;
  
  // 挑战窗口配置
  challengeWindow: ChallengeWindowConfig;
  
  // 争议解决配置
  disputeResolver: DisputeResolverConfig;
  
  // 惩罚执行配置
  penaltyExecutor: PenaltyExecutorConfig;
  
  // 系统配置
  enableAutoChallenge: boolean;
  challengeThreshold: number; // 自动挑战的阈值
  maxConcurrentChallenges: number;
}

/**
 * 挑战系统统计信息
 */
export interface ChallengeSystemStats {
  // 窗口统计
  totalWindows: number;
  activeWindows: number;
  
  // 挑战统计
  totalChallenges: number;
  validChallenges: number;
  invalidChallenges: number;
  
  // 解决统计
  resolvedChallenges: number;
  pendingResolutions: number;
  
  // 惩罚统计
  totalPenalties: number;
  totalRewards: number;
  
  // 节点统计
  activeNodes: number;
  suspendedNodes: number;
  bannedNodes: number;
  
  // 性能统计
  avgResolutionTime: number;
  challengeSuccessRate: number;
}

/**
 * 集成的挑战机制系统
 * 统一管理挑战窗口、争议解决和惩罚执行
 */
export class ChallengeSystem extends EventEmitter {
  private config: ChallengeSystemConfig;
  private messageBus: MessageBus;
  private matchingEngine: MatchingEngine;
  
  private challengeWindowManager: ChallengeWindowManager;
  private disputeResolver: DisputeResolver;
  private penaltyExecutor: PenaltyExecutor;
  
  private isRunning: boolean;
  private stats: ChallengeSystemStats;

  constructor(
    config: ChallengeSystemConfig,
    messageBus: MessageBus,
    matchingEngine: MatchingEngine
  ) {
    super();
    this.config = config;
    this.messageBus = messageBus;
    this.matchingEngine = matchingEngine;
    this.isRunning = false;
    
    this.initializeStats();
    this.initializeComponents();
    this.setupMessageHandlers();
  }

  /**
   * 初始化统计信息
   */
  private initializeStats(): void {
    this.stats = {
      totalWindows: 0,
      activeWindows: 0,
      totalChallenges: 0,
      validChallenges: 0,
      invalidChallenges: 0,
      resolvedChallenges: 0,
      pendingResolutions: 0,
      totalPenalties: 0,
      totalRewards: 0,
      activeNodes: 0,
      suspendedNodes: 0,
      bannedNodes: 0,
      avgResolutionTime: 0,
      challengeSuccessRate: 0
    };
  }

  /**
   * 初始化组件
   */
  private initializeComponents(): void {
    // 创建惩罚执行器
    this.penaltyExecutor = new PenaltyExecutor(
      this.config.penaltyExecutor,
      this.messageBus
    );

    // 创建争议解决器
    this.disputeResolver = new DisputeResolver(
      this.config.disputeResolver,
      this.messageBus,
      this.matchingEngine
    );

    // 创建挑战窗口管理器
    this.challengeWindowManager = new ChallengeWindowManager(
      this.config.challengeWindow,
      this.messageBus
    );

    // 设置组件间的事件监听
    this.setupComponentEvents();
  }

  /**
   * 设置组件间的事件监听
   */
  private setupComponentEvents(): void {
    // 监听挑战窗口事件
    this.challengeWindowManager.on('window.opened', (data) => {
      this.stats.totalWindows++;
      this.stats.activeWindows++;
      this.emit('challenge.window.opened', data);
    });

    this.challengeWindowManager.on('challenge.submitted', (data) => {
      this.stats.totalChallenges++;
      this.emit('challenge.submitted', data);
    });

    this.challengeWindowManager.on('window.closed', (data) => {
      this.stats.activeWindows--;
      this.emit('challenge.window.closed', data);
    });

    // 监听争议解决事件
    this.disputeResolver.on('resolution.completed', (data) => {
      this.stats.resolvedChallenges++;
      if (data.result === 'challenge_valid') {
        this.stats.validChallenges++;
      } else if (data.result === 'challenge_invalid') {
        this.stats.invalidChallenges++;
      }
      this.emit('dispute.resolved', data);
    });

    // 监听惩罚执行事件
    this.penaltyExecutor.on('penalty.executed', (data) => {
      this.stats.totalPenalties++;
      this.emit('penalty.executed', data);
    });

    this.penaltyExecutor.on('reward.executed', (data) => {
      this.stats.totalRewards++;
      this.emit('reward.executed', data);
    });
  }

  /**
   * 设置消息处理器
   */
  private setupMessageHandlers(): void {
    // 监听批次提交，自动开启挑战窗口
    this.messageBus.subscribe({
      topic: 'batch.committed',
      handler: {
        handle: async (message: Message) => {
          await this.handleBatchCommitted(message);
        }
      }
    });

    // 监听挑战请求
    this.messageBus.subscribe({
      topic: 'challenge.request',
      handler: {
        handle: async (message: Message) => {
          await this.handleChallengeRequest(message);
        }
      }
    });

    // 监听系统状态查询
    this.messageBus.subscribe({
      topic: 'challenge.system.status',
      handler: {
        handle: async (message: Message) => {
          await this.handleStatusQuery(message);
        }
      }
    });
  }

  /**
   * 启动挑战系统
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('Challenge system is already running');
      return;
    }

    console.log('Starting Challenge System...');
    
    this.isRunning = true;

    // 发布系统启动事件
    await this.messageBus.publish('challenge.system.started', {
      nodeId: this.config.selfNodeId,
      timestamp: Date.now(),
      config: {
        windowDuration: this.config.challengeWindow.windowDurationMs,
        autoChallenge: this.config.enableAutoChallenge,
        maxConcurrent: this.config.maxConcurrentChallenges
      }
    }, {
      priority: MessagePriority.HIGH
    });

    console.log('Challenge System started successfully');
    this.emit('system.started');
  }

  /**
   * 停止挑战系统
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.warn('Challenge system is not running');
      return;
    }

    console.log('Stopping Challenge System...');
    
    this.isRunning = false;

    // 清理组件
    await Promise.all([
      this.challengeWindowManager.cleanup(),
      this.disputeResolver.cleanup(),
      this.penaltyExecutor.cleanup()
    ]);

    // 发布系统停止事件
    await this.messageBus.publish('challenge.system.stopped', {
      nodeId: this.config.selfNodeId,
      timestamp: Date.now(),
      finalStats: this.stats
    }, {
      priority: MessagePriority.HIGH
    });

    console.log('Challenge System stopped successfully');
    this.emit('system.stopped');
  }

  /**
   * 处理批次提交
   */
  private async handleBatchCommitted(message: Message): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    const batchCommit = message.payload as BatchCommit;
    
    try {
      // 为批次开启挑战窗口
      const window = await this.challengeWindowManager.openChallengeWindow(batchCommit);
      
      console.log(`Challenge window opened for batch ${batchCommit.id}: ${window.id}`);
      
      // 如果启用了自动挑战，检查是否需要发起挑战
      if (this.config.enableAutoChallenge) {
        await this.performAutoChallenge(batchCommit, window.id);
      }
      
    } catch (error) {
      console.error(`Failed to handle batch commit ${batchCommit.id}:`, error);
    }
  }

  /**
   * 处理挑战请求
   */
  private async handleChallengeRequest(message: Message): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    const { windowId, challenger, challengeType, evidence } = message.payload;
    
    try {
      const challengeId = await this.challengeWindowManager.submitChallenge(
        windowId,
        challenger,
        challengeType,
        evidence
      );
      
      if (challengeId) {
        console.log(`Challenge submitted successfully: ${challengeId}`);
        
        // 回复挑战提交结果
        if (message.metadata?.replyTo) {
          await this.messageBus.publish(message.metadata.replyTo, {
            success: true,
            challengeId,
            windowId
          });
        }
      } else {
        console.warn(`Failed to submit challenge for window ${windowId}`);
        
        if (message.metadata?.replyTo) {
          await this.messageBus.publish(message.metadata.replyTo, {
            success: false,
            error: 'Failed to submit challenge'
          });
        }
      }
      
    } catch (error) {
      console.error(`Error handling challenge request:`, error);
      
      if (message.metadata?.replyTo) {
        await this.messageBus.publish(message.metadata.replyTo, {
          success: false,
          error: error.message
        });
      }
    }
  }

  /**
   * 处理状态查询
   */
  private async handleStatusQuery(message: Message): Promise<void> {
    const status = {
      isRunning: this.isRunning,
      stats: this.getStats(),
      activeWindows: this.challengeWindowManager.getActiveWindows().length,
      activeResolutions: this.disputeResolver.getActiveResolutions().length,
      nodeReputations: this.penaltyExecutor.getAllReputations().length
    };

    if (message.metadata?.replyTo) {
      await this.messageBus.publish(message.metadata.replyTo, status);
    }
  }

  /**
   * 执行自动挑战
   */
  private async performAutoChallenge(batchCommit: BatchCommit, windowId: string): Promise<void> {
    try {
      // 这里应该实现自动挑战逻辑
      // 比如检查批次的计算结果是否可疑
      const suspiciousScore = await this.calculateSuspiciousScore(batchCommit);
      
      if (suspiciousScore > this.config.challengeThreshold) {
        console.log(`Batch ${batchCommit.id} appears suspicious (score: ${suspiciousScore}), initiating auto-challenge`);
        
        // 发起自动挑战
        await this.messageBus.publish('challenge.request', {
          windowId,
          challenger: this.config.selfNodeId,
          challengeType: 'computation_error',
          evidence: {
            type: 'auto_challenge',
            data: { suspiciousScore },
            signature: 'auto_generated',
            timestamp: Date.now()
          }
        });
      }
      
    } catch (error) {
      console.error(`Error in auto-challenge for batch ${batchCommit.id}:`, error);
    }
  }

  /**
   * 计算可疑分数
   */
  private async calculateSuspiciousScore(batchCommit: BatchCommit): Promise<number> {
    // 简化的可疑分数计算
    // 实际应该基于更复杂的启发式算法
    let score = 0;
    
    // 检查时间戳是否异常
    const now = Date.now();
    const timeDiff = Math.abs(now - batchCommit.timestamp);
    if (timeDiff > 60000) { // 超过1分钟
      score += 0.3;
    }
    
    // 检查批次大小是否异常
    if (batchCommit.batchSize > 1000) {
      score += 0.2;
    }
    
    // 随机因子（模拟其他检查）
    score += Math.random() * 0.1;
    
    return score;
  }

  /**
   * 获取统计信息
   */
  getStats(): ChallengeSystemStats {
    // 更新实时统计
    const windowStats = this.challengeWindowManager.getWindowStats();
    const penaltyStats = this.penaltyExecutor.getStats();
    
    this.stats.activeWindows = windowStats.activeWindows;
    this.stats.activeNodes = penaltyStats.activeNodes;
    this.stats.suspendedNodes = penaltyStats.suspendedNodes;
    this.stats.bannedNodes = penaltyStats.bannedNodes;
    
    // 计算成功率
    if (this.stats.totalChallenges > 0) {
      this.stats.challengeSuccessRate = this.stats.validChallenges / this.stats.totalChallenges;
    }
    
    return { ...this.stats };
  }

  /**
   * 获取详细状态
   */
  getDetailedStatus(): {
    system: any;
    windows: any;
    resolutions: any;
    penalties: any;
  } {
    return {
      system: {
        isRunning: this.isRunning,
        config: this.config,
        stats: this.getStats()
      },
      windows: {
        active: this.challengeWindowManager.getActiveWindows(),
        stats: this.challengeWindowManager.getWindowStats()
      },
      resolutions: {
        active: this.disputeResolver.getActiveResolutions()
      },
      penalties: {
        reputations: this.penaltyExecutor.getAllReputations(),
        executions: this.penaltyExecutor.getExecutionHistory(),
        stats: this.penaltyExecutor.getStats()
      }
    };
  }

  /**
   * 检查系统健康状态
   */
  checkHealth(): {
    healthy: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // 检查活跃窗口数量
    if (this.stats.activeWindows > this.config.maxConcurrentChallenges) {
      issues.push(`Too many active windows: ${this.stats.activeWindows}`);
      recommendations.push('Consider increasing processing capacity');
    }
    
    // 检查挑战成功率
    if (this.stats.challengeSuccessRate < 0.1 && this.stats.totalChallenges > 10) {
      issues.push(`Low challenge success rate: ${this.stats.challengeSuccessRate}`);
      recommendations.push('Review challenge validation logic');
    }
    
    // 检查被禁止的节点数量
    if (this.stats.bannedNodes > this.stats.activeNodes * 0.1) {
      issues.push(`High number of banned nodes: ${this.stats.bannedNodes}`);
      recommendations.push('Investigate potential network issues');
    }
    
    return {
      healthy: issues.length === 0,
      issues,
      recommendations
    };
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    if (this.isRunning) {
      await this.stop();
    }
    
    console.log('Challenge System cleanup completed');
  }
}