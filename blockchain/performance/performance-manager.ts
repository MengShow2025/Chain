import { EventEmitter } from 'events';
import { PerformanceMonitor, defaultPerformanceThresholds, PerformanceMetrics } from './performance-monitor';
import { PerformanceOptimizer, defaultOptimizerConfig } from './performance-optimizer';
import PerformanceTuner from './performance-tuner';
import { getPerformanceConfig, applyPerformanceConfig } from './performance-config';

/**
 * 性能管理器状态
 */
export interface PerformanceManagerState {
  isRunning: boolean;
  monitoringEnabled: boolean;
  optimizationEnabled: boolean;
  tuningEnabled: boolean;
  currentTPS: number;
  currentLatency: number;
  currentAvailability: number;
  targetTPS: number;
  targetLatency: number;
  targetAvailability: number;
  achievementRate: {
    tps: number;
    latency: number;
    availability: number;
  };
}

/**
 * 性能报告
 */
export interface PerformanceReport {
  timestamp: number;
  duration: number;
  summary: {
    averageTPS: number;
    averageLatency: number;
    averageAvailability: number;
    totalRequests: number;
    totalTransactions: number;
    errorRate: number;
  };
  achievements: {
    tpsAchieved: boolean;
    latencyAchieved: boolean;
    availabilityAchieved: boolean;
    overallScore: number;
  };
  optimizations: {
    totalActions: number;
    successfulActions: number;
    failedActions: number;
    averageImpact: number;
  };
  tuning: {
    parametersAdjusted: number;
    averageImprovement: number;
    bestResult: any;
  };
  recommendations: string[];
}

/**
 * 性能管理器
 * 统一管理性能监控、优化和调优
 */
export class PerformanceManager extends EventEmitter {
  private monitor: PerformanceMonitor;
  private optimizer: PerformanceOptimizer;
  private tuner: PerformanceTuner;
  private isRunning: boolean = false;
  private startTime?: number;
  private reportInterval?: NodeJS.Timeout;
  
  // 性能目标
  private targets = {
    tps: 200000, // 200k TPS
    latency: 100, // 100ms P95延迟
    availability: 99.9 // 99.9%可用性
  };

  constructor() {
    super();
    
    // 初始化组件
    this.monitor = new PerformanceMonitor({
      ...defaultPerformanceThresholds,
      minTPS: this.targets.tps,
      maxLatencyP95: this.targets.latency,
      minAvailability: this.targets.availability
    });

    this.optimizer = new PerformanceOptimizer(this.monitor, {
      ...defaultOptimizerConfig,
      autoOptimization: true
    });

    this.tuner = new PerformanceTuner(this.monitor);

    this.setupEventListeners();
    console.log('PerformanceManager initialized');
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 监控事件
    this.monitor.on('alert:triggered', (alert) => {
      this.emit('performance:alert', alert);
      console.log(`🚨 性能警报: ${alert.message}`);
    });

    this.monitor.on('metrics:updated', (metrics) => {
      this.emit('performance:metrics', metrics);
      this.checkTargetAchievement(metrics);
    });

    // 优化事件
    this.optimizer.on('action:completed', ({ action, result }) => {
      this.emit('performance:optimization', { action, result });
      console.log(`🔧 优化完成: ${action.description} - ${result.success ? '成功' : '失败'}`);
    });

    // 调优事件
    this.tuner.on('parameter:tuned', (result) => {
      this.emit('performance:tuning', result);
      console.log(`⚙️ 参数调优: ${result.parameter} 性能提升 ${Math.round(result.score * 100)}%`);
    });
  }

  /**
   * 启动性能管理
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('PerformanceManager is already running');
      return;
    }

    this.isRunning = true;
    this.startTime = Date.now();
    
    console.log('🚀 启动性能管理系统');
    console.log(`目标: TPS=${this.targets.tps}, 延迟<${this.targets.latency}ms, 可用性>${this.targets.availability}%`);

    try {
      // 应用性能配置
      const config = getPerformanceConfig();
      applyPerformanceConfig(config);

      // 启动监控
      this.monitor.start(1000); // 1秒间隔
      console.log('✅ 性能监控已启动');

      // 启动优化器
      this.optimizer.start();
      console.log('✅ 性能优化器已启动');

      // 设置定期报告
      this.reportInterval = setInterval(() => {
        this.generatePeriodicReport();
      }, 60000); // 每分钟生成报告

      this.emit('manager:started');
      console.log('✅ 性能管理系统启动完成');

    } catch (error) {
      console.error('❌ 性能管理系统启动失败:', error);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * 停止性能管理
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('PerformanceManager is not running');
      return;
    }

    this.isRunning = false;

    // 停止组件
    this.monitor.stop();
    this.optimizer.stop();
    this.tuner.stopAutoTuning();

    // 清理定时器
    if (this.reportInterval) {
      clearInterval(this.reportInterval);
      this.reportInterval = undefined;
    }

    this.emit('manager:stopped');
    console.log('⏹️ 性能管理系统已停止');
  }

  /**
   * 开始自动调优
   */
  async startAutoTuning(): Promise<void> {
    if (!this.isRunning) {
      throw new Error('性能管理系统未启动');
    }

    console.log('🔧 开始自动性能调优');
    await this.tuner.startAutoTuning();
  }

  /**
   * 停止自动调优
   */
  stopAutoTuning(): void {
    this.tuner.stopAutoTuning();
    console.log('⏹️ 自动性能调优已停止');
  }

  /**
   * 检查目标达成情况
   */
  private checkTargetAchievement(metrics: PerformanceMetrics): void {
    const tpsAchieved = metrics.tps >= this.targets.tps;
    const latencyAchieved = metrics.latency.p95 <= this.targets.latency;
    const availabilityAchieved = metrics.availability >= this.targets.availability;

    const achievement = {
      tps: tpsAchieved,
      latency: latencyAchieved,
      availability: availabilityAchieved,
      overall: tpsAchieved && latencyAchieved && availabilityAchieved
    };

    if (achievement.overall) {
      console.log('🎯 所有性能目标已达成!');
      this.emit('performance:target_achieved', achievement);
    }

    // 发出目标检查事件
    this.emit('performance:target_check', achievement);
  }

  /**
   * 获取当前状态
   */
  getCurrentState(): PerformanceManagerState {
    const currentMetrics = this.monitor.getCurrentMetrics();
    
    return {
      isRunning: this.isRunning,
      monitoringEnabled: this.monitor.getCurrentMetrics() !== null,
      optimizationEnabled: this.optimizer.getOptimizationStats().total > 0,
      tuningEnabled: this.tuner.getTuningStats().isRunning,
      currentTPS: currentMetrics?.tps || 0,
      currentLatency: currentMetrics?.latency.p95 || 0,
      currentAvailability: currentMetrics?.availability || 0,
      targetTPS: this.targets.tps,
      targetLatency: this.targets.latency,
      targetAvailability: this.targets.availability,
      achievementRate: {
        tps: currentMetrics ? (currentMetrics.tps / this.targets.tps) * 100 : 0,
        latency: currentMetrics ? Math.max(0, (this.targets.latency - currentMetrics.latency.p95) / this.targets.latency * 100) : 0,
        availability: currentMetrics ? (currentMetrics.availability / this.targets.availability) * 100 : 0
      }
    };
  }

  /**
   * 生成定期报告
   */
  private generatePeriodicReport(): void {
    const report = this.generateReport();
    this.emit('performance:report', report);
    
    // 简化的控制台输出
    console.log(`📊 性能报告 - TPS: ${Math.round(report.summary.averageTPS)}, 延迟: ${Math.round(report.summary.averageLatency * 100) / 100}ms, 可用性: ${Math.round(report.summary.averageAvailability * 100) / 100}%`);
  }

  /**
   * 生成完整性能报告
   */
  generateReport(): PerformanceReport {
    const now = Date.now();
    const duration = this.startTime ? now - this.startTime : 0;
    
    // 获取历史指标
    const historicalMetrics = this.monitor.getHistoricalMetrics();
    const currentMetrics = this.monitor.getCurrentMetrics();
    
    // 计算平均值
    const averageTPS = historicalMetrics.length > 0 
      ? historicalMetrics.reduce((sum, m) => sum + m.tps, 0) / historicalMetrics.length
      : 0;
    
    const averageLatency = historicalMetrics.length > 0
      ? historicalMetrics.reduce((sum, m) => sum + m.latency.p95, 0) / historicalMetrics.length
      : 0;
    
    const averageAvailability = historicalMetrics.length > 0
      ? historicalMetrics.reduce((sum, m) => sum + m.availability, 0) / historicalMetrics.length
      : 0;

    // 获取统计信息
    const performanceSummary = this.monitor.getPerformanceSummary();
    const optimizationStats = this.optimizer.getOptimizationStats();
    const tuningStats = this.tuner.getTuningStats();

    // 计算达成情况
    const tpsAchieved = averageTPS >= this.targets.tps;
    const latencyAchieved = averageLatency <= this.targets.latency;
    const availabilityAchieved = averageAvailability >= this.targets.availability;
    
    const overallScore = (
      (tpsAchieved ? 1 : averageTPS / this.targets.tps) * 0.4 +
      (latencyAchieved ? 1 : Math.max(0, (this.targets.latency - averageLatency) / this.targets.latency)) * 0.3 +
      (availabilityAchieved ? 1 : averageAvailability / this.targets.availability) * 0.3
    ) * 100;

    // 生成建议
    const recommendations = this.generateRecommendations(currentMetrics);

    return {
      timestamp: now,
      duration,
      summary: {
        averageTPS: Math.round(averageTPS),
        averageLatency: Math.round(averageLatency * 100) / 100,
        averageAvailability: Math.round(averageAvailability * 100) / 100,
        totalRequests: performanceSummary.statistics?.totalRequests || 0,
        totalTransactions: performanceSummary.statistics?.totalTransactions || 0,
        errorRate: currentMetrics?.errors.errorRate || 0
      },
      achievements: {
        tpsAchieved,
        latencyAchieved,
        availabilityAchieved,
        overallScore: Math.round(overallScore * 100) / 100
      },
      optimizations: {
        totalActions: optimizationStats.total,
        successfulActions: optimizationStats.successful,
        failedActions: optimizationStats.failed,
        averageImpact: optimizationStats.averageExecutionTime
      },
      tuning: {
        parametersAdjusted: tuningStats.tunedParameters,
        averageImprovement: tuningStats.averageImprovement,
        bestResult: tuningStats.bestResult
      },
      recommendations
    };
  }

  /**
   * 生成性能建议
   */
  private generateRecommendations(metrics: PerformanceMetrics | null): string[] {
    const recommendations: string[] = [];

    if (!metrics) {
      recommendations.push('启动性能监控以获取性能数据');
      return recommendations;
    }

    // TPS建议
    if (metrics.tps < this.targets.tps) {
      const gap = this.targets.tps - metrics.tps;
      if (gap > this.targets.tps * 0.5) {
        recommendations.push('TPS严重不足，建议进行水平扩展和架构优化');
      } else if (gap > this.targets.tps * 0.2) {
        recommendations.push('TPS不足，建议优化批处理和并发处理');
      } else {
        recommendations.push('TPS接近目标，建议进行细微调优');
      }
    }

    // 延迟建议
    if (metrics.latency.p95 > this.targets.latency) {
      const excess = metrics.latency.p95 - this.targets.latency;
      if (excess > this.targets.latency) {
        recommendations.push('延迟过高，建议优化缓存策略和数据库查询');
      } else if (excess > this.targets.latency * 0.5) {
        recommendations.push('延迟偏高，建议优化网络配置和负载均衡');
      } else {
        recommendations.push('延迟略高，建议进行算法优化');
      }
    }

    // 可用性建议
    if (metrics.availability < this.targets.availability) {
      const deficit = this.targets.availability - metrics.availability;
      if (deficit > 1) {
        recommendations.push('可用性严重不足，建议加强容错机制和监控');
      } else if (deficit > 0.1) {
        recommendations.push('可用性不足，建议优化错误处理和重试机制');
      } else {
        recommendations.push('可用性接近目标，建议完善监控和告警');
      }
    }

    // 错误率建议
    if (metrics.errors.errorRate > 1) {
      recommendations.push('错误率过高，建议检查系统稳定性和输入验证');
    }

    // 资源使用建议
    if (metrics.resources.cpuUsage > 80) {
      recommendations.push('CPU使用率过高，建议优化算法或增加计算资源');
    }

    if (metrics.resources.memoryUsage > 85) {
      recommendations.push('内存使用率过高，建议优化内存管理或增加内存');
    }

    // 如果所有目标都达成
    if (recommendations.length === 0) {
      recommendations.push('所有性能目标已达成，建议继续监控并保持当前配置');
      recommendations.push('可以考虑进一步提升目标或优化成本效率');
    }

    return recommendations;
  }

  /**
   * 执行性能基准测试
   */
  async runBenchmark(duration: number = 60000): Promise<PerformanceReport> {
    console.log(`🏃 开始性能基准测试 (${duration / 1000}秒)`);
    
    if (!this.isRunning) {
      await this.start();
    }

    const startTime = Date.now();
    
    // 模拟高负载
    const loadSimulation = setInterval(() => {
      // 模拟大量请求
      for (let i = 0; i < 100; i++) {
        const requestId = `benchmark-${Date.now()}-${i}`;
        this.monitor.startRequest(requestId);
        
        setTimeout(() => {
          this.monitor.endRequest(requestId, Math.random() > 0.01);
        }, 5 + Math.random() * 20);
      }
      
      // 模拟交易
      this.monitor.recordTransaction(50);
    }, 100);

    // 等待测试完成
    await new Promise(resolve => setTimeout(resolve, duration));
    
    // 停止负载模拟
    clearInterval(loadSimulation);
    
    console.log('✅ 性能基准测试完成');
    
    return this.generateReport();
  }

  /**
   * 获取性能摘要
   */
  getPerformanceSummary(): any {
    const state = this.getCurrentState();
    const monitorSummary = this.monitor.getPerformanceSummary();
    const optimizationStats = this.optimizer.getOptimizationStats();
    const tuningStats = this.tuner.getTuningStats();

    return {
      state,
      monitoring: monitorSummary,
      optimization: optimizationStats,
      tuning: tuningStats,
      targets: this.targets,
      uptime: this.startTime ? Date.now() - this.startTime : 0
    };
  }

  /**
   * 设置性能目标
   */
  setTargets(targets: Partial<typeof this.targets>): void {
    this.targets = { ...this.targets, ...targets };
    console.log('🎯 性能目标已更新:', this.targets);
    this.emit('targets:updated', this.targets);
  }

  /**
   * 获取性能目标
   */
  getTargets(): typeof this.targets {
    return { ...this.targets };
  }

  /**
   * 重置性能统计
   */
  reset(): void {
    this.monitor.reset();
    console.log('🔄 性能统计已重置');
    this.emit('manager:reset');
  }
}

export default PerformanceManager;