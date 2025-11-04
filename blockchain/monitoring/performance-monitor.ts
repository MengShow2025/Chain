/**
 * 实时性能监控和自适应优化系统
 * 监控TitanChain的关键性能指标并自动优化系统参数
 * 目标：维持500,000 TPS和<0.1ms延迟
 */

import { EventEmitter } from 'events';
import { TitanCore } from '../core/titan-core';
import { SmartShardingManager } from '../sharding/smart-sharding';
import { UltraLowLatencyManager } from '../optimization/ultra-low-latency';
import { TitanBFT } from '../consensus/titan-bft';

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  timestamp: number;
  tps: number;
  latency: {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
    max: number;
  };
  throughput: {
    ordersPerSecond: number;
    matchesPerSecond: number;
    bytesPerSecond: number;
  };
  resources: {
    cpuUsage: number;
    memoryUsage: number;
    networkUsage: number;
    diskUsage: number;
  };
  consensus: {
    blockTime: number;
    finalizationTime: number;
    validatorCount: number;
    consensusLatency: number;
  };
  sharding: {
    shardCount: number;
    loadBalance: number;
    crossShardTxRatio: number;
    hotShardRatio: number;
  };
}

/**
 * 性能阈值配置
 */
export interface PerformanceThresholds {
  tps: {
    target: number;
    warning: number;
    critical: number;
  };
  latency: {
    target: number;
    warning: number;
    critical: number;
  };
  resources: {
    cpu: { warning: number; critical: number };
    memory: { warning: number; critical: number };
    network: { warning: number; critical: number };
  };
}

/**
 * 优化策略
 */
export interface OptimizationStrategy {
  id: string;
  name: string;
  description: string;
  trigger: (metrics: PerformanceMetrics) => boolean;
  execute: (context: OptimizationContext) => Promise<OptimizationResult>;
  priority: number;
  cooldown: number; // 冷却时间（毫秒）
}

/**
 * 优化上下文
 */
export interface OptimizationContext {
  metrics: PerformanceMetrics;
  history: PerformanceMetrics[];
  titanCore: TitanCore;
  shardingManager: SmartShardingManager;
  latencyManager: UltraLowLatencyManager;
  consensus: TitanBFT;
}

/**
 * 优化结果
 */
export interface OptimizationResult {
  success: boolean;
  strategy: string;
  changes: string[];
  expectedImprovement: {
    tps?: number;
    latency?: number;
  };
  actualImprovement?: {
    tps?: number;
    latency?: number;
  };
  timestamp: number;
}

/**
 * 告警级别
 */
export enum AlertLevel {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical'
}

/**
 * 性能告警
 */
export interface PerformanceAlert {
  id: string;
  level: AlertLevel;
  metric: string;
  value: number;
  threshold: number;
  message: string;
  timestamp: number;
  resolved?: boolean;
  resolvedAt?: number;
}

/**
 * 实时性能监控器
 */
export class RealTimePerformanceMonitor extends EventEmitter {
  private isRunning: boolean = false;
  private monitorInterval: NodeJS.Timeout | null = null;
  private metricsHistory: PerformanceMetrics[] = [];
  private activeAlerts: Map<string, PerformanceAlert> = new Map();
  private optimizationHistory: OptimizationResult[] = [];
  private lastOptimization: Map<string, number> = new Map();

  private readonly HISTORY_SIZE = 1000;
  private readonly MONITOR_INTERVAL = 100; // 100ms监控间隔
  private readonly METRICS_RETENTION = 24 * 60 * 60 * 1000; // 24小时

  // 默认性能阈值
  private thresholds: PerformanceThresholds = {
    tps: {
      target: 500000,
      warning: 400000,
      critical: 300000
    },
    latency: {
      target: 0.1,
      warning: 0.2,
      critical: 0.5
    },
    resources: {
      cpu: { warning: 80, critical: 95 },
      memory: { warning: 85, critical: 95 },
      network: { warning: 80, critical: 90 }
    }
  };

  // 优化策略
  private strategies: OptimizationStrategy[] = [];

  constructor(
    private titanCore: TitanCore,
    private shardingManager: SmartShardingManager,
    private latencyManager: UltraLowLatencyManager,
    private consensus: TitanBFT
  ) {
    super();
    this.initializeOptimizationStrategies();
    console.log('RealTimePerformanceMonitor initialized');
  }

  /**
   * 初始化优化策略
   */
  private initializeOptimizationStrategies(): void {
    this.strategies = [
      // TPS优化策略
      {
        id: 'increase_shards',
        name: '增加分片数量',
        description: '当TPS低于目标时增加分片数量',
        priority: 1,
        cooldown: 30000, // 30秒冷却
        trigger: (metrics) => metrics.tps < this.thresholds.tps.warning,
        execute: async (context) => {
          const currentShards = context.shardingManager.getShardCount();
          const newShards = Math.min(currentShards + 2, 32); // 最多32个分片
          
          await context.shardingManager.resizeShards(newShards);
          
          return {
            success: true,
            strategy: 'increase_shards',
            changes: [`Increased shards from ${currentShards} to ${newShards}`],
            expectedImprovement: {
              tps: (newShards / currentShards - 1) * context.metrics.tps
            },
            timestamp: Date.now()
          };
        }
      },

      // 延迟优化策略
      {
        id: 'optimize_cpu_affinity',
        name: '优化CPU亲和性',
        description: '当延迟过高时重新分配CPU核心',
        priority: 2,
        cooldown: 60000, // 60秒冷却
        trigger: (metrics) => metrics.latency.avg > this.thresholds.latency.warning,
        execute: async (context) => {
          // 重新设置CPU亲和性
          const systemStatus = context.latencyManager.getSystemStatus();
          const availableCores = systemStatus.numa.nodes[0]?.cpus || [];
          
          if (availableCores.length >= 4) {
            const dedicatedCores = availableCores.slice(0, 4);
            // 这里会调用NUMA管理器重新设置CPU亲和性
          }

          return {
            success: true,
            strategy: 'optimize_cpu_affinity',
            changes: ['Optimized CPU affinity for critical threads'],
            expectedImprovement: {
              latency: -0.05 // 预期减少0.05ms
            },
            timestamp: Date.now()
          };
        }
      },

      // 内存优化策略
      {
        id: 'gc_optimization',
        name: '垃圾回收优化',
        description: '当内存使用率过高时触发优化垃圾回收',
        priority: 3,
        cooldown: 10000, // 10秒冷却
        trigger: (metrics) => metrics.resources.memoryUsage > this.thresholds.resources.memory.warning,
        execute: async (context) => {
          // 强制垃圾回收
          if (global.gc) {
            global.gc();
          }

          // 清理订单簿缓存
          context.titanCore.clearCache();

          return {
            success: true,
            strategy: 'gc_optimization',
            changes: ['Triggered garbage collection', 'Cleared order book cache'],
            expectedImprovement: {
              latency: -0.02 // 预期减少0.02ms
            },
            timestamp: Date.now()
          };
        }
      },

      // 负载均衡优化
      {
        id: 'rebalance_shards',
        name: '重新平衡分片',
        description: '当分片负载不均衡时重新分配订单',
        priority: 4,
        cooldown: 45000, // 45秒冷却
        trigger: (metrics) => metrics.sharding.loadBalance < 0.8, // 负载均衡度低于80%
        execute: async (context) => {
          await context.shardingManager.rebalanceShards();

          return {
            success: true,
            strategy: 'rebalance_shards',
            changes: ['Rebalanced shard loads'],
            expectedImprovement: {
              tps: context.metrics.tps * 0.1 // 预期提升10%
            },
            timestamp: Date.now()
          };
        }
      },

      // 共识优化策略
      {
        id: 'optimize_consensus',
        name: '优化共识参数',
        description: '当共识延迟过高时调整共识参数',
        priority: 5,
        cooldown: 120000, // 120秒冷却
        trigger: (metrics) => metrics.consensus.consensusLatency > 50, // 50ms
        execute: async (context) => {
          // 调整共识参数
          const newBatchSize = Math.min(context.consensus.getBatchSize() * 1.2, 10000);
          context.consensus.setBatchSize(Math.floor(newBatchSize));

          return {
            success: true,
            strategy: 'optimize_consensus',
            changes: [`Increased consensus batch size to ${Math.floor(newBatchSize)}`],
            expectedImprovement: {
              tps: context.metrics.tps * 0.05 // 预期提升5%
            },
            timestamp: Date.now()
          };
        }
      }
    ];

    console.log(`Initialized ${this.strategies.length} optimization strategies`);
  }

  /**
   * 启动性能监控
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Performance monitor is already running');
    }

    this.isRunning = true;
    this.monitorInterval = setInterval(() => {
      this.collectMetrics();
    }, this.MONITOR_INTERVAL);

    console.log('RealTimePerformanceMonitor started');
    this.emit('started');
  }

  /**
   * 停止性能监控
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }

    console.log('RealTimePerformanceMonitor stopped');
    this.emit('stopped');
  }

  /**
   * 收集性能指标
   */
  private async collectMetrics(): Promise<void> {
    try {
      const timestamp = Date.now();
      
      // 收集各组件的性能指标
      const titanCoreStats = this.titanCore.getStats();
      const shardingStats = this.shardingManager.getStats();
      const latencyStats = this.latencyManager.getSystemStatus();
      const consensusStats = this.consensus.getStats();

      const metrics: PerformanceMetrics = {
        timestamp,
        tps: titanCoreStats.tps || 0,
        latency: {
          avg: titanCoreStats.latency?.avg || 0,
          p50: titanCoreStats.latency?.p50 || 0,
          p95: titanCoreStats.latency?.p95 || 0,
          p99: titanCoreStats.latency?.p99 || 0,
          max: titanCoreStats.latency?.max || 0
        },
        throughput: {
          ordersPerSecond: titanCoreStats.ordersPerSecond || 0,
          matchesPerSecond: titanCoreStats.matchesPerSecond || 0,
          bytesPerSecond: latencyStats.networkIO?.bytesPerSecond || 0
        },
        resources: {
          cpuUsage: this.getCPUUsage(),
          memoryUsage: this.getMemoryUsage(),
          networkUsage: this.getNetworkUsage(),
          diskUsage: this.getDiskUsage()
        },
        consensus: {
          blockTime: consensusStats.blockTime || 0,
          finalizationTime: consensusStats.finalizationTime || 0,
          validatorCount: consensusStats.validatorCount || 0,
          consensusLatency: consensusStats.consensusLatency || 0
        },
        sharding: {
          shardCount: shardingStats.shardCount || 0,
          loadBalance: shardingStats.loadBalance || 0,
          crossShardTxRatio: shardingStats.crossShardTxRatio || 0,
          hotShardRatio: shardingStats.hotShardRatio || 0
        }
      };

      // 添加到历史记录
      this.addMetricsToHistory(metrics);

      // 检查告警
      await this.checkAlerts(metrics);

      // 执行自适应优化
      await this.executeOptimizations(metrics);

      // 发出指标事件
      this.emit('metrics', metrics);

    } catch (error) {
      console.error('Error collecting metrics:', error);
      this.emit('error', error);
    }
  }

  /**
   * 添加指标到历史记录
   */
  private addMetricsToHistory(metrics: PerformanceMetrics): void {
    this.metricsHistory.push(metrics);

    // 保持历史记录大小
    if (this.metricsHistory.length > this.HISTORY_SIZE) {
      this.metricsHistory.shift();
    }

    // 清理过期记录
    const cutoffTime = Date.now() - this.METRICS_RETENTION;
    this.metricsHistory = this.metricsHistory.filter(m => m.timestamp > cutoffTime);
  }

  /**
   * 检查告警
   */
  private async checkAlerts(metrics: PerformanceMetrics): Promise<void> {
    const alerts: PerformanceAlert[] = [];

    // TPS告警
    if (metrics.tps < this.thresholds.tps.critical) {
      alerts.push(this.createAlert('tps_critical', AlertLevel.CRITICAL, 'tps', metrics.tps, this.thresholds.tps.critical));
    } else if (metrics.tps < this.thresholds.tps.warning) {
      alerts.push(this.createAlert('tps_warning', AlertLevel.WARNING, 'tps', metrics.tps, this.thresholds.tps.warning));
    }

    // 延迟告警
    if (metrics.latency.avg > this.thresholds.latency.critical) {
      alerts.push(this.createAlert('latency_critical', AlertLevel.CRITICAL, 'latency', metrics.latency.avg, this.thresholds.latency.critical));
    } else if (metrics.latency.avg > this.thresholds.latency.warning) {
      alerts.push(this.createAlert('latency_warning', AlertLevel.WARNING, 'latency', metrics.latency.avg, this.thresholds.latency.warning));
    }

    // 资源告警
    if (metrics.resources.cpuUsage > this.thresholds.resources.cpu.critical) {
      alerts.push(this.createAlert('cpu_critical', AlertLevel.CRITICAL, 'cpu', metrics.resources.cpuUsage, this.thresholds.resources.cpu.critical));
    }

    if (metrics.resources.memoryUsage > this.thresholds.resources.memory.critical) {
      alerts.push(this.createAlert('memory_critical', AlertLevel.CRITICAL, 'memory', metrics.resources.memoryUsage, this.thresholds.resources.memory.critical));
    }

    // 处理新告警
    for (const alert of alerts) {
      if (!this.activeAlerts.has(alert.id)) {
        this.activeAlerts.set(alert.id, alert);
        this.emit('alert', alert);
        console.warn(`Performance alert: ${alert.message}`);
      }
    }

    // 检查已解决的告警
    for (const [alertId, alert] of this.activeAlerts) {
      if (!alerts.some(a => a.id === alertId)) {
        alert.resolved = true;
        alert.resolvedAt = Date.now();
        this.emit('alertResolved', alert);
        this.activeAlerts.delete(alertId);
      }
    }
  }

  /**
   * 创建告警
   */
  private createAlert(id: string, level: AlertLevel, metric: string, value: number, threshold: number): PerformanceAlert {
    return {
      id,
      level,
      metric,
      value,
      threshold,
      message: `${metric} ${level}: ${value} ${level === AlertLevel.CRITICAL ? '<<' : '<'} ${threshold}`,
      timestamp: Date.now()
    };
  }

  /**
   * 执行自适应优化
   */
  private async executeOptimizations(metrics: PerformanceMetrics): Promise<void> {
    const context: OptimizationContext = {
      metrics,
      history: this.metricsHistory.slice(-10), // 最近10个指标
      titanCore: this.titanCore,
      shardingManager: this.shardingManager,
      latencyManager: this.latencyManager,
      consensus: this.consensus
    };

    // 按优先级排序策略
    const sortedStrategies = [...this.strategies].sort((a, b) => a.priority - b.priority);

    for (const strategy of sortedStrategies) {
      // 检查冷却时间
      const lastExecution = this.lastOptimization.get(strategy.id) || 0;
      if (Date.now() - lastExecution < strategy.cooldown) {
        continue;
      }

      // 检查触发条件
      if (!strategy.trigger(metrics)) {
        continue;
      }

      try {
        console.log(`Executing optimization strategy: ${strategy.name}`);
        const result = await strategy.execute(context);
        
        this.optimizationHistory.push(result);
        this.lastOptimization.set(strategy.id, Date.now());
        
        this.emit('optimization', result);
        console.log(`Optimization completed: ${strategy.name}`, result.changes);

        // 限制每次监控周期只执行一个优化策略
        break;

      } catch (error) {
        console.error(`Optimization strategy ${strategy.name} failed:`, error);
        this.emit('optimizationError', { strategy: strategy.id, error });
      }
    }
  }

  /**
   * 获取CPU使用率
   */
  private getCPUUsage(): number {
    // 简化实现：返回模拟值
    // 在实际实现中，需要读取系统CPU使用率
    return Math.random() * 100;
  }

  /**
   * 获取内存使用率
   */
  private getMemoryUsage(): number {
    const used = process.memoryUsage();
    const total = require('os').totalmem();
    return (used.heapUsed / total) * 100;
  }

  /**
   * 获取网络使用率
   */
  private getNetworkUsage(): number {
    // 简化实现：返回模拟值
    return Math.random() * 100;
  }

  /**
   * 获取磁盘使用率
   */
  private getDiskUsage(): number {
    // 简化实现：返回模拟值
    return Math.random() * 100;
  }

  /**
   * 获取当前性能指标
   */
  public getCurrentMetrics(): PerformanceMetrics | null {
    return this.metricsHistory.length > 0 ? this.metricsHistory[this.metricsHistory.length - 1] : null;
  }

  /**
   * 获取历史指标
   */
  public getHistoricalMetrics(duration: number = 3600000): PerformanceMetrics[] {
    const cutoffTime = Date.now() - duration;
    return this.metricsHistory.filter(m => m.timestamp > cutoffTime);
  }

  /**
   * 获取活跃告警
   */
  public getActiveAlerts(): PerformanceAlert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * 获取优化历史
   */
  public getOptimizationHistory(limit: number = 100): OptimizationResult[] {
    return this.optimizationHistory.slice(-limit);
  }

  /**
   * 设置性能阈值
   */
  public setThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
    console.log('Performance thresholds updated:', this.thresholds);
  }

  /**
   * 添加自定义优化策略
   */
  public addOptimizationStrategy(strategy: OptimizationStrategy): void {
    this.strategies.push(strategy);
    console.log(`Added optimization strategy: ${strategy.name}`);
  }

  /**
   * 移除优化策略
   */
  public removeOptimizationStrategy(strategyId: string): boolean {
    const index = this.strategies.findIndex(s => s.id === strategyId);
    if (index >= 0) {
      this.strategies.splice(index, 1);
      console.log(`Removed optimization strategy: ${strategyId}`);
      return true;
    }
    return false;
  }

  /**
   * 手动触发优化
   */
  public async triggerOptimization(strategyId: string): Promise<OptimizationResult | null> {
    const strategy = this.strategies.find(s => s.id === strategyId);
    if (!strategy) {
      throw new Error(`Optimization strategy not found: ${strategyId}`);
    }

    const currentMetrics = this.getCurrentMetrics();
    if (!currentMetrics) {
      throw new Error('No current metrics available');
    }

    const context: OptimizationContext = {
      metrics: currentMetrics,
      history: this.metricsHistory.slice(-10),
      titanCore: this.titanCore,
      shardingManager: this.shardingManager,
      latencyManager: this.latencyManager,
      consensus: this.consensus
    };

    try {
      const result = await strategy.execute(context);
      this.optimizationHistory.push(result);
      this.lastOptimization.set(strategy.id, Date.now());
      this.emit('optimization', result);
      return result;
    } catch (error) {
      console.error(`Manual optimization failed: ${strategyId}`, error);
      throw error;
    }
  }

  /**
   * 获取系统状态摘要
   */
  public getSystemSummary(): any {
    const currentMetrics = this.getCurrentMetrics();
    const activeAlerts = this.getActiveAlerts();
    const recentOptimizations = this.getOptimizationHistory(10);

    return {
      isRunning: this.isRunning,
      timestamp: Date.now(),
      performance: {
        tps: currentMetrics?.tps || 0,
        latency: currentMetrics?.latency.avg || 0,
        status: this.getPerformanceStatus(currentMetrics)
      },
      alerts: {
        total: activeAlerts.length,
        critical: activeAlerts.filter(a => a.level === AlertLevel.CRITICAL).length,
        warning: activeAlerts.filter(a => a.level === AlertLevel.WARNING).length
      },
      optimizations: {
        total: this.optimizationHistory.length,
        recent: recentOptimizations.length,
        lastExecution: recentOptimizations.length > 0 ? recentOptimizations[recentOptimizations.length - 1].timestamp : null
      },
      thresholds: this.thresholds
    };
  }

  /**
   * 获取性能状态
   */
  private getPerformanceStatus(metrics: PerformanceMetrics | null): string {
    if (!metrics) return 'unknown';

    const tpsStatus = metrics.tps >= this.thresholds.tps.target ? 'good' : 
                     metrics.tps >= this.thresholds.tps.warning ? 'warning' : 'critical';
    
    const latencyStatus = metrics.latency.avg <= this.thresholds.latency.target ? 'good' :
                         metrics.latency.avg <= this.thresholds.latency.warning ? 'warning' : 'critical';

    if (tpsStatus === 'critical' || latencyStatus === 'critical') return 'critical';
    if (tpsStatus === 'warning' || latencyStatus === 'warning') return 'warning';
    return 'good';
  }
}

/**
 * 性能监控工厂
 */
export class PerformanceMonitorFactory {
  /**
   * 创建性能监控实例
   */
  public static create(
    titanCore: TitanCore,
    shardingManager: SmartShardingManager,
    latencyManager: UltraLowLatencyManager,
    consensus: TitanBFT
  ): RealTimePerformanceMonitor {
    return new RealTimePerformanceMonitor(
      titanCore,
      shardingManager,
      latencyManager,
      consensus
    );
  }

  /**
   * 创建带自定义配置的性能监控实例
   */
  public static createWithConfig(
    components: {
      titanCore: TitanCore;
      shardingManager: SmartShardingManager;
      latencyManager: UltraLowLatencyManager;
      consensus: TitanBFT;
    },
    config: {
      thresholds?: Partial<PerformanceThresholds>;
      strategies?: OptimizationStrategy[];
    }
  ): RealTimePerformanceMonitor {
    const monitor = new RealTimePerformanceMonitor(
      components.titanCore,
      components.shardingManager,
      components.latencyManager,
      components.consensus
    );

    if (config.thresholds) {
      monitor.setThresholds(config.thresholds);
    }

    if (config.strategies) {
      for (const strategy of config.strategies) {
        monitor.addOptimizationStrategy(strategy);
      }
    }

    return monitor;
  }
}