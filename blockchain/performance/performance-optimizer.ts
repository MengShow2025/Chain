import { EventEmitter } from 'events';
import { PerformanceMonitor, PerformanceMetrics, PerformanceAlert } from './performance-monitor';

/**
 * 优化策略类型
 */
export type OptimizationStrategy = 
  | 'scale_up'           // 垂直扩展
  | 'scale_out'          // 水平扩展
  | 'cache_optimization' // 缓存优化
  | 'load_balancing'     // 负载均衡
  | 'resource_tuning'    // 资源调优
  | 'circuit_breaker'    // 熔断器
  | 'rate_limiting'      // 限流
  | 'batch_processing'   // 批处理
  | 'connection_pooling' // 连接池
  | 'memory_optimization'; // 内存优化

/**
 * 优化动作
 */
export interface OptimizationAction {
  id: string;
  strategy: OptimizationStrategy;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedImpact: number; // 预估影响 (0-100)
  cost: number; // 成本评估 (0-100)
  parameters: Record<string, any>;
  timestamp: number;
  executed: boolean;
  result?: OptimizationResult;
}

/**
 * 优化结果
 */
export interface OptimizationResult {
  success: boolean;
  message: string;
  metricsImprovement: {
    tpsBefore: number;
    tpsAfter: number;
    latencyBefore: number;
    latencyAfter: number;
    availabilityBefore: number;
    availabilityAfter: number;
  };
  executionTime: number;
  timestamp: number;
}

/**
 * 优化配置
 */
export interface OptimizerConfig {
  autoOptimization: boolean;
  optimizationInterval: number; // ms
  maxConcurrentOptimizations: number;
  rollbackOnFailure: boolean;
  minImpactThreshold: number; // 最小影响阈值
  maxCostThreshold: number; // 最大成本阈值
}

/**
 * 性能优化器
 */
export class PerformanceOptimizer extends EventEmitter {
  private monitor: PerformanceMonitor;
  private config: OptimizerConfig;
  private actions: OptimizationAction[] = [];
  private executingActions: Set<string> = new Set();
  private optimizationHistory: OptimizationResult[] = [];
  private isRunning: boolean = false;
  private optimizationInterval?: NodeJS.Timeout;

  // 优化策略权重
  private strategyWeights: Record<OptimizationStrategy, number> = {
    scale_up: 0.8,
    scale_out: 0.9,
    cache_optimization: 0.7,
    load_balancing: 0.8,
    resource_tuning: 0.6,
    circuit_breaker: 0.7,
    rate_limiting: 0.5,
    batch_processing: 0.6,
    connection_pooling: 0.7,
    memory_optimization: 0.8
  };

  constructor(monitor: PerformanceMonitor, config: OptimizerConfig) {
    super();
    this.monitor = monitor;
    this.config = config;

    // 监听性能警报
    this.monitor.on('alert:triggered', (alert: PerformanceAlert) => {
      this.handlePerformanceAlert(alert);
    });

    // 监听性能指标更新
    this.monitor.on('metrics:updated', (metrics: PerformanceMetrics) => {
      this.analyzePerformance(metrics);
    });

    console.log('PerformanceOptimizer initialized');
  }

  /**
   * 启动优化器
   */
  start(): void {
    if (this.isRunning) {
      console.log('PerformanceOptimizer is already running');
      return;
    }

    this.isRunning = true;

    if (this.config.autoOptimization) {
      this.optimizationInterval = setInterval(() => {
        this.runOptimizationCycle();
      }, this.config.optimizationInterval);
    }

    console.log('PerformanceOptimizer started');
    this.emit('optimizer:started');
  }

  /**
   * 停止优化器
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('PerformanceOptimizer is not running');
      return;
    }

    this.isRunning = false;

    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
      this.optimizationInterval = undefined;
    }

    console.log('PerformanceOptimizer stopped');
    this.emit('optimizer:stopped');
  }

  /**
   * 处理性能警报
   */
  private handlePerformanceAlert(alert: PerformanceAlert): void {
    console.log(`🔧 处理性能警报: ${alert.message}`);

    const actions = this.generateOptimizationActions(alert);
    for (const action of actions) {
      this.addOptimizationAction(action);
    }

    if (this.config.autoOptimization) {
      this.executeHighPriorityActions();
    }
  }

  /**
   * 分析性能指标
   */
  private analyzePerformance(metrics: PerformanceMetrics): void {
    // 基于性能趋势生成优化建议
    const trendActions = this.analyzeTrends(metrics);
    for (const action of trendActions) {
      this.addOptimizationAction(action);
    }
  }

  /**
   * 分析性能趋势
   */
  private analyzeTrends(metrics: PerformanceMetrics): OptimizationAction[] {
    const actions: OptimizationAction[] = [];
    const historical = this.monitor.getHistoricalMetrics(10);

    if (historical.length < 5) return actions;

    // 分析TPS趋势
    const tpsTrend = this.calculateTrend(historical.map(m => m.tps));
    if (tpsTrend < -0.1) { // TPS下降趋势
      actions.push(this.createOptimizationAction('scale_out', {
        reason: 'TPS下降趋势',
        currentTPS: metrics.tps,
        targetTPS: metrics.tps * 1.2
      }));
    }

    // 分析延迟趋势
    const latencyTrend = this.calculateTrend(historical.map(m => m.latency.p95));
    if (latencyTrend > 0.1) { // 延迟上升趋势
      actions.push(this.createOptimizationAction('cache_optimization', {
        reason: '延迟上升趋势',
        currentLatency: metrics.latency.p95,
        targetLatency: metrics.latency.p95 * 0.8
      }));
    }

    // 分析资源使用趋势
    const cpuTrend = this.calculateTrend(historical.map(m => m.resources.cpuUsage));
    if (cpuTrend > 0.1 && metrics.resources.cpuUsage > 70) {
      actions.push(this.createOptimizationAction('resource_tuning', {
        reason: 'CPU使用率持续上升',
        currentCpuUsage: metrics.resources.cpuUsage
      }));
    }

    return actions;
  }

  /**
   * 计算趋势（简单线性回归斜率）
   */
  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
    const sumX2 = values.reduce((sum, _, x) => sum + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  /**
   * 根据警报生成优化动作
   */
  private generateOptimizationActions(alert: PerformanceAlert): OptimizationAction[] {
    const actions: OptimizationAction[] = [];

    switch (alert.type) {
      case 'latency':
        actions.push(
          this.createOptimizationAction('cache_optimization', {
            alertId: alert.id,
            currentLatency: alert.value,
            targetLatency: alert.threshold
          }),
          this.createOptimizationAction('load_balancing', {
            alertId: alert.id,
            reason: '延迟过高，需要负载均衡'
          })
        );
        break;

      case 'tps':
        actions.push(
          this.createOptimizationAction('scale_out', {
            alertId: alert.id,
            currentTPS: alert.value,
            targetTPS: alert.threshold
          }),
          this.createOptimizationAction('batch_processing', {
            alertId: alert.id,
            reason: 'TPS过低，启用批处理'
          })
        );
        break;

      case 'error_rate':
        actions.push(
          this.createOptimizationAction('circuit_breaker', {
            alertId: alert.id,
            currentErrorRate: alert.value,
            targetErrorRate: alert.threshold
          }),
          this.createOptimizationAction('rate_limiting', {
            alertId: alert.id,
            reason: '错误率过高，启用限流'
          })
        );
        break;

      case 'resource':
        actions.push(
          this.createOptimizationAction('resource_tuning', {
            alertId: alert.id,
            resourceType: 'cpu',
            currentUsage: alert.value
          }),
          this.createOptimizationAction('memory_optimization', {
            alertId: alert.id,
            reason: '资源使用率过高'
          })
        );
        break;
    }

    return actions;
  }

  /**
   * 创建优化动作
   */
  private createOptimizationAction(
    strategy: OptimizationStrategy,
    parameters: Record<string, any>
  ): OptimizationAction {
    const priority = this.calculatePriority(strategy, parameters);
    const estimatedImpact = this.estimateImpact(strategy, parameters);
    const cost = this.estimateCost(strategy, parameters);

    return {
      id: `${strategy}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      strategy,
      description: this.getActionDescription(strategy, parameters),
      priority,
      estimatedImpact,
      cost,
      parameters,
      timestamp: Date.now(),
      executed: false
    };
  }

  /**
   * 计算优化动作优先级
   */
  private calculatePriority(
    strategy: OptimizationStrategy,
    parameters: Record<string, any>
  ): OptimizationAction['priority'] {
    const weight = this.strategyWeights[strategy];
    const urgency = parameters.alertId ? 1.0 : 0.5;
    const score = weight * urgency;

    if (score >= 0.8) return 'critical';
    if (score >= 0.6) return 'high';
    if (score >= 0.4) return 'medium';
    return 'low';
  }

  /**
   * 估算优化影响
   */
  private estimateImpact(
    strategy: OptimizationStrategy,
    parameters: Record<string, any>
  ): number {
    const baseImpact: Record<OptimizationStrategy, number> = {
      scale_up: 70,
      scale_out: 80,
      cache_optimization: 60,
      load_balancing: 65,
      resource_tuning: 50,
      circuit_breaker: 40,
      rate_limiting: 30,
      batch_processing: 55,
      connection_pooling: 45,
      memory_optimization: 60
    };

    return baseImpact[strategy] + Math.random() * 20 - 10; // 添加随机变化
  }

  /**
   * 估算优化成本
   */
  private estimateCost(
    strategy: OptimizationStrategy,
    parameters: Record<string, any>
  ): number {
    const baseCost: Record<OptimizationStrategy, number> = {
      scale_up: 80,
      scale_out: 90,
      cache_optimization: 30,
      load_balancing: 40,
      resource_tuning: 20,
      circuit_breaker: 25,
      rate_limiting: 15,
      batch_processing: 35,
      connection_pooling: 30,
      memory_optimization: 40
    };

    return baseCost[strategy] + Math.random() * 20 - 10; // 添加随机变化
  }

  /**
   * 获取动作描述
   */
  private getActionDescription(
    strategy: OptimizationStrategy,
    parameters: Record<string, any>
  ): string {
    const descriptions: Record<OptimizationStrategy, string> = {
      scale_up: '垂直扩展：增加单节点资源',
      scale_out: '水平扩展：增加节点数量',
      cache_optimization: '缓存优化：提升缓存命中率',
      load_balancing: '负载均衡：优化请求分发',
      resource_tuning: '资源调优：优化资源配置',
      circuit_breaker: '熔断器：防止级联故障',
      rate_limiting: '限流：控制请求速率',
      batch_processing: '批处理：提高处理效率',
      connection_pooling: '连接池：优化连接管理',
      memory_optimization: '内存优化：减少内存使用'
    };

    let description = descriptions[strategy];
    if (parameters.reason) {
      description += ` (${parameters.reason})`;
    }

    return description;
  }

  /**
   * 添加优化动作
   */
  private addOptimizationAction(action: OptimizationAction): void {
    // 检查是否已存在相似的动作
    const similar = this.actions.find(a => 
      a.strategy === action.strategy && 
      !a.executed && 
      Math.abs(a.timestamp - action.timestamp) < 60000 // 1分钟内
    );

    if (similar) {
      console.log(`跳过重复的优化动作: ${action.strategy}`);
      return;
    }

    this.actions.push(action);
    this.emit('action:added', action);
    console.log(`➕ 添加优化动作: ${action.description} (优先级: ${action.priority})`);
  }

  /**
   * 执行高优先级动作
   */
  private executeHighPriorityActions(): void {
    const highPriorityActions = this.actions
      .filter(a => !a.executed && (a.priority === 'critical' || a.priority === 'high'))
      .filter(a => !this.executingActions.has(a.id))
      .sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      })
      .slice(0, this.config.maxConcurrentOptimizations);

    for (const action of highPriorityActions) {
      this.executeOptimizationAction(action);
    }
  }

  /**
   * 运行优化周期
   */
  private runOptimizationCycle(): void {
    console.log('🔄 运行优化周期');

    // 执行待处理的优化动作
    const pendingActions = this.actions
      .filter(a => !a.executed)
      .filter(a => !this.executingActions.has(a.id))
      .filter(a => a.estimatedImpact >= this.config.minImpactThreshold)
      .filter(a => a.cost <= this.config.maxCostThreshold)
      .sort((a, b) => {
        // 按优先级和影响/成本比排序
        const scoreA = a.estimatedImpact / Math.max(a.cost, 1);
        const scoreB = b.estimatedImpact / Math.max(b.cost, 1);
        return scoreB - scoreA;
      })
      .slice(0, this.config.maxConcurrentOptimizations);

    for (const action of pendingActions) {
      this.executeOptimizationAction(action);
    }

    this.emit('optimization:cycle', {
      pendingActions: pendingActions.length,
      executingActions: this.executingActions.size
    });
  }

  /**
   * 执行优化动作
   */
  async executeOptimizationAction(action: OptimizationAction): Promise<void> {
    if (this.executingActions.has(action.id)) {
      console.log(`优化动作已在执行中: ${action.id}`);
      return;
    }

    this.executingActions.add(action.id);
    console.log(`🚀 执行优化动作: ${action.description}`);

    const startTime = Date.now();
    const metricsBefore = this.monitor.getCurrentMetrics();

    try {
      // 执行具体的优化策略
      const success = await this.executeStrategy(action.strategy, action.parameters);
      
      // 等待一段时间让优化生效
      await this.sleep(5000);
      
      const metricsAfter = this.monitor.getCurrentMetrics();
      const executionTime = Date.now() - startTime;

      const result: OptimizationResult = {
        success,
        message: success ? '优化执行成功' : '优化执行失败',
        metricsImprovement: {
          tpsBefore: metricsBefore?.tps || 0,
          tpsAfter: metricsAfter?.tps || 0,
          latencyBefore: metricsBefore?.latency.p95 || 0,
          latencyAfter: metricsAfter?.latency.p95 || 0,
          availabilityBefore: metricsBefore?.availability || 0,
          availabilityAfter: metricsAfter?.availability || 0
        },
        executionTime,
        timestamp: Date.now()
      };

      action.executed = true;
      action.result = result;
      this.optimizationHistory.push(result);

      this.emit('action:completed', { action, result });
      console.log(`✅ 优化动作完成: ${action.description} (${success ? '成功' : '失败'})`);

      if (success) {
        this.logOptimizationSuccess(action, result);
      } else if (this.config.rollbackOnFailure) {
        await this.rollbackOptimization(action);
      }

    } catch (error) {
      console.error(`❌ 优化动作执行失败: ${action.description}`, error);
      
      const result: OptimizationResult = {
        success: false,
        message: `执行失败: ${error instanceof Error ? error.message : '未知错误'}`,
        metricsImprovement: {
          tpsBefore: metricsBefore?.tps || 0,
          tpsAfter: metricsBefore?.tps || 0,
          latencyBefore: metricsBefore?.latency.p95 || 0,
          latencyAfter: metricsBefore?.latency.p95 || 0,
          availabilityBefore: metricsBefore?.availability || 0,
          availabilityAfter: metricsBefore?.availability || 0
        },
        executionTime: Date.now() - startTime,
        timestamp: Date.now()
      };

      action.executed = true;
      action.result = result;
      this.optimizationHistory.push(result);

      this.emit('action:failed', { action, result, error });

    } finally {
      this.executingActions.delete(action.id);
    }
  }

  /**
   * 执行具体的优化策略
   */
  private async executeStrategy(
    strategy: OptimizationStrategy,
    parameters: Record<string, any>
  ): Promise<boolean> {
    console.log(`执行优化策略: ${strategy}`, parameters);

    // 模拟优化策略执行
    switch (strategy) {
      case 'scale_out':
        return this.executeScaleOut(parameters);
      case 'cache_optimization':
        return this.executeCacheOptimization(parameters);
      case 'load_balancing':
        return this.executeLoadBalancing(parameters);
      case 'resource_tuning':
        return this.executeResourceTuning(parameters);
      case 'circuit_breaker':
        return this.executeCircuitBreaker(parameters);
      case 'rate_limiting':
        return this.executeRateLimiting(parameters);
      case 'batch_processing':
        return this.executeBatchProcessing(parameters);
      case 'connection_pooling':
        return this.executeConnectionPooling(parameters);
      case 'memory_optimization':
        return this.executeMemoryOptimization(parameters);
      default:
        console.warn(`未知的优化策略: ${strategy}`);
        return false;
    }
  }

  /**
   * 执行水平扩展
   */
  private async executeScaleOut(parameters: Record<string, any>): Promise<boolean> {
    console.log('执行水平扩展优化');
    // 模拟扩展节点
    await this.sleep(2000);
    return Math.random() > 0.2; // 80%成功率
  }

  /**
   * 执行缓存优化
   */
  private async executeCacheOptimization(parameters: Record<string, any>): Promise<boolean> {
    console.log('执行缓存优化');
    // 模拟缓存配置优化
    await this.sleep(1000);
    return Math.random() > 0.1; // 90%成功率
  }

  /**
   * 执行负载均衡优化
   */
  private async executeLoadBalancing(parameters: Record<string, any>): Promise<boolean> {
    console.log('执行负载均衡优化');
    // 模拟负载均衡配置
    await this.sleep(1500);
    return Math.random() > 0.15; // 85%成功率
  }

  /**
   * 执行资源调优
   */
  private async executeResourceTuning(parameters: Record<string, any>): Promise<boolean> {
    console.log('执行资源调优');
    // 模拟资源配置调整
    await this.sleep(1000);
    return Math.random() > 0.1; // 90%成功率
  }

  /**
   * 执行熔断器配置
   */
  private async executeCircuitBreaker(parameters: Record<string, any>): Promise<boolean> {
    console.log('执行熔断器配置');
    // 模拟熔断器设置
    await this.sleep(500);
    return Math.random() > 0.05; // 95%成功率
  }

  /**
   * 执行限流配置
   */
  private async executeRateLimiting(parameters: Record<string, any>): Promise<boolean> {
    console.log('执行限流配置');
    // 模拟限流设置
    await this.sleep(500);
    return Math.random() > 0.05; // 95%成功率
  }

  /**
   * 执行批处理优化
   */
  private async executeBatchProcessing(parameters: Record<string, any>): Promise<boolean> {
    console.log('执行批处理优化');
    // 模拟批处理配置
    await this.sleep(1000);
    return Math.random() > 0.1; // 90%成功率
  }

  /**
   * 执行连接池优化
   */
  private async executeConnectionPooling(parameters: Record<string, any>): Promise<boolean> {
    console.log('执行连接池优化');
    // 模拟连接池配置
    await this.sleep(800);
    return Math.random() > 0.1; // 90%成功率
  }

  /**
   * 执行内存优化
   */
  private async executeMemoryOptimization(parameters: Record<string, any>): Promise<boolean> {
    console.log('执行内存优化');
    // 模拟内存优化
    await this.sleep(1200);
    return Math.random() > 0.15; // 85%成功率
  }

  /**
   * 记录优化成功
   */
  private logOptimizationSuccess(action: OptimizationAction, result: OptimizationResult): void {
    const improvement = result.metricsImprovement;
    const tpsImprovement = improvement.tpsAfter - improvement.tpsBefore;
    const latencyImprovement = improvement.latencyBefore - improvement.latencyAfter;
    
    console.log(`📈 优化效果:
      - TPS: ${improvement.tpsBefore.toFixed(0)} → ${improvement.tpsAfter.toFixed(0)} (${tpsImprovement > 0 ? '+' : ''}${tpsImprovement.toFixed(0)})
      - 延迟: ${improvement.latencyBefore.toFixed(2)}ms → ${improvement.latencyAfter.toFixed(2)}ms (${latencyImprovement > 0 ? '-' : '+'}${Math.abs(latencyImprovement).toFixed(2)}ms)
      - 可用性: ${improvement.availabilityBefore.toFixed(2)}% → ${improvement.availabilityAfter.toFixed(2)}%`);
  }

  /**
   * 回滚优化
   */
  private async rollbackOptimization(action: OptimizationAction): Promise<void> {
    console.log(`🔄 回滚优化动作: ${action.description}`);
    // 实际实现需要根据具体的优化策略进行回滚
    await this.sleep(1000);
    console.log(`✅ 优化动作已回滚: ${action.description}`);
  }

  /**
   * 睡眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取优化统计
   */
  getOptimizationStats(): any {
    const executed = this.actions.filter(a => a.executed);
    const successful = executed.filter(a => a.result?.success);
    const failed = executed.filter(a => !a.result?.success);

    return {
      total: this.actions.length,
      executed: executed.length,
      successful: successful.length,
      failed: failed.length,
      pending: this.actions.filter(a => !a.executed).length,
      executing: this.executingActions.size,
      successRate: executed.length > 0 ? (successful.length / executed.length) * 100 : 0,
      averageExecutionTime: this.optimizationHistory.length > 0 
        ? this.optimizationHistory.reduce((sum, r) => sum + r.executionTime, 0) / this.optimizationHistory.length
        : 0
    };
  }

  /**
   * 获取优化建议
   */
  getOptimizationRecommendations(): OptimizationAction[] {
    return this.actions
      .filter(a => !a.executed)
      .filter(a => a.estimatedImpact >= this.config.minImpactThreshold)
      .filter(a => a.cost <= this.config.maxCostThreshold)
      .sort((a, b) => {
        const scoreA = a.estimatedImpact / Math.max(a.cost, 1);
        const scoreB = b.estimatedImpact / Math.max(b.cost, 1);
        return scoreB - scoreA;
      })
      .slice(0, 10);
  }

  /**
   * 手动执行优化动作
   */
  async executeAction(actionId: string): Promise<boolean> {
    const action = this.actions.find(a => a.id === actionId);
    if (!action) {
      console.error(`优化动作不存在: ${actionId}`);
      return false;
    }

    if (action.executed) {
      console.error(`优化动作已执行: ${actionId}`);
      return false;
    }

    await this.executeOptimizationAction(action);
    return action.result?.success || false;
  }

  /**
   * 清理历史数据
   */
  cleanup(maxAge: number = 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - maxAge;
    
    // 清理旧的优化动作
    this.actions = this.actions.filter(a => a.timestamp > cutoff || !a.executed);
    
    // 清理旧的优化历史
    this.optimizationHistory = this.optimizationHistory.filter(r => r.timestamp > cutoff);
    
    console.log('优化器历史数据已清理');
  }
}

/**
 * 默认优化器配置
 */
export const defaultOptimizerConfig: OptimizerConfig = {
  autoOptimization: true,
  optimizationInterval: 30000, // 30秒
  maxConcurrentOptimizations: 3,
  rollbackOnFailure: true,
  minImpactThreshold: 30, // 最小30%影响
  maxCostThreshold: 70 // 最大70%成本
};