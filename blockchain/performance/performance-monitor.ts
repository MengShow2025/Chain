import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

/**
 * 性能指标类型
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
    requestsPerSecond: number;
    bytesPerSecond: number;
    transactionsPerSecond: number;
  };
  resources: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    networkUsage: number;
  };
  errors: {
    errorRate: number;
    timeoutRate: number;
    retryRate: number;
  };
  availability: number;
}

/**
 * 性能阈值配置
 */
export interface PerformanceThresholds {
  maxLatencyP95: number; // 最大P95延迟 (ms)
  minTPS: number; // 最小TPS
  maxErrorRate: number; // 最大错误率 (%)
  minAvailability: number; // 最小可用性 (%)
  maxCpuUsage: number; // 最大CPU使用率 (%)
  maxMemoryUsage: number; // 最大内存使用率 (%)
}

/**
 * 性能警报
 */
export interface PerformanceAlert {
  id: string;
  type: 'latency' | 'tps' | 'error_rate' | 'availability' | 'resource';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
  resolved: boolean;
}

/**
 * 请求跟踪信息
 */
interface RequestTrace {
  id: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  error?: string;
  size?: number;
}

/**
 * 性能监控器
 */
export class PerformanceMonitor extends EventEmitter {
  private metrics: PerformanceMetrics[] = [];
  private requests: Map<string, RequestTrace> = new Map();
  private latencies: number[] = [];
  private thresholds: PerformanceThresholds;
  private alerts: PerformanceAlert[] = [];
  private isRunning: boolean = false;
  private monitoringInterval?: NodeJS.Timeout;
  private maxMetricsHistory: number = 1000;
  private maxLatencyHistory: number = 10000;

  // 统计计数器
  private totalRequests: number = 0;
  private successfulRequests: number = 0;
  private failedRequests: number = 0;
  private totalBytes: number = 0;
  private totalTransactions: number = 0;

  constructor(thresholds: PerformanceThresholds) {
    super();
    this.thresholds = thresholds;
    
    console.log('PerformanceMonitor initialized with thresholds:', thresholds);
  }

  /**
   * 启动性能监控
   */
  start(intervalMs: number = 5000): void {
    if (this.isRunning) {
      console.log('PerformanceMonitor is already running');
      return;
    }

    this.isRunning = true;
    
    // 定期收集性能指标
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);

    console.log(`PerformanceMonitor started with ${intervalMs}ms interval`);
    this.emit('monitor:started');
  }

  /**
   * 停止性能监控
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('PerformanceMonitor is not running');
      return;
    }

    this.isRunning = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    console.log('PerformanceMonitor stopped');
    this.emit('monitor:stopped');
  }

  /**
   * 开始请求跟踪
   */
  startRequest(requestId: string): void {
    const trace: RequestTrace = {
      id: requestId,
      startTime: performance.now(),
      success: false
    };
    
    this.requests.set(requestId, trace);
    this.totalRequests++;
  }

  /**
   * 结束请求跟踪
   */
  endRequest(requestId: string, success: boolean = true, error?: string, size?: number): void {
    const trace = this.requests.get(requestId);
    if (!trace) {
      console.warn(`Request trace not found: ${requestId}`);
      return;
    }

    trace.endTime = performance.now();
    trace.duration = trace.endTime - trace.startTime;
    trace.success = success;
    trace.error = error;
    trace.size = size;

    // 更新统计
    if (success) {
      this.successfulRequests++;
    } else {
      this.failedRequests++;
    }

    if (size) {
      this.totalBytes += size;
    }

    // 记录延迟
    this.latencies.push(trace.duration);
    
    // 限制延迟历史大小
    if (this.latencies.length > this.maxLatencyHistory) {
      this.latencies.shift();
    }

    // 清理请求跟踪
    this.requests.delete(requestId);
  }

  /**
   * 记录交易
   */
  recordTransaction(count: number = 1): void {
    this.totalTransactions += count;
  }

  /**
   * 收集性能指标
   */
  private collectMetrics(): void {
    const now = Date.now();
    const currentMetrics = this.calculateCurrentMetrics(now);
    
    // 添加到历史记录
    this.metrics.push(currentMetrics);
    
    // 限制历史大小
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics.shift();
    }

    // 检查阈值并生成警报
    this.checkThresholds(currentMetrics);

    // 发出指标更新事件
    this.emit('metrics:updated', currentMetrics);
  }

  /**
   * 计算当前性能指标
   */
  private calculateCurrentMetrics(timestamp: number): PerformanceMetrics {
    // 计算延迟统计
    const latencyStats = this.calculateLatencyStats();
    
    // 计算TPS（基于最近5秒的数据）
    const recentMetrics = this.metrics.filter(m => timestamp - m.timestamp < 5000);
    const tps = this.calculateTPS(recentMetrics);
    
    // 计算吞吐量
    const throughput = this.calculateThroughput();
    
    // 获取资源使用情况
    const resources = this.getResourceUsage();
    
    // 计算错误率
    const errors = this.calculateErrorRates();
    
    // 计算可用性
    const availability = this.calculateAvailability();

    return {
      timestamp,
      tps,
      latency: latencyStats,
      throughput,
      resources,
      errors,
      availability
    };
  }

  /**
   * 计算延迟统计
   */
  private calculateLatencyStats(): PerformanceMetrics['latency'] {
    if (this.latencies.length === 0) {
      return { avg: 0, p50: 0, p95: 0, p99: 0, max: 0 };
    }

    const sorted = [...this.latencies].sort((a, b) => a - b);
    const len = sorted.length;

    return {
      avg: sorted.reduce((a, b) => a + b, 0) / len,
      p50: sorted[Math.floor(len * 0.5)],
      p95: sorted[Math.floor(len * 0.95)],
      p99: sorted[Math.floor(len * 0.99)],
      max: sorted[len - 1]
    };
  }

  /**
   * 计算TPS
   */
  private calculateTPS(recentMetrics: PerformanceMetrics[]): number {
    if (recentMetrics.length < 2) {
      return this.totalTransactions / ((Date.now() - (this.metrics[0]?.timestamp || Date.now())) / 1000);
    }

    const timeSpan = (recentMetrics[recentMetrics.length - 1].timestamp - recentMetrics[0].timestamp) / 1000;
    const transactionCount = recentMetrics.reduce((sum, m) => sum + m.throughput.transactionsPerSecond, 0);
    
    return timeSpan > 0 ? transactionCount / timeSpan : 0;
  }

  /**
   * 计算吞吐量
   */
  private calculateThroughput(): PerformanceMetrics['throughput'] {
    const now = Date.now();
    const timeSpan = this.metrics.length > 0 ? (now - this.metrics[0].timestamp) / 1000 : 1;

    return {
      requestsPerSecond: this.totalRequests / timeSpan,
      bytesPerSecond: this.totalBytes / timeSpan,
      transactionsPerSecond: this.totalTransactions / timeSpan
    };
  }

  /**
   * 获取资源使用情况
   */
  private getResourceUsage(): PerformanceMetrics['resources'] {
    const memUsage = process.memoryUsage();
    
    return {
      cpuUsage: this.getCPUUsage(),
      memoryUsage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      diskUsage: 0, // 需要实际实现
      networkUsage: 0 // 需要实际实现
    };
  }

  /**
   * 获取CPU使用率（简化实现）
   */
  private getCPUUsage(): number {
    // 简化的CPU使用率计算
    // 实际实现需要使用系统调用或第三方库
    return Math.random() * 20 + 10; // 模拟10-30%的CPU使用率
  }

  /**
   * 计算错误率
   */
  private calculateErrorRates(): PerformanceMetrics['errors'] {
    const total = this.totalRequests;
    const failed = this.failedRequests;
    
    return {
      errorRate: total > 0 ? (failed / total) * 100 : 0,
      timeoutRate: 0, // 需要实际跟踪超时
      retryRate: 0 // 需要实际跟踪重试
    };
  }

  /**
   * 计算可用性
   */
  private calculateAvailability(): number {
    const total = this.totalRequests;
    const successful = this.successfulRequests;
    
    return total > 0 ? (successful / total) * 100 : 100;
  }

  /**
   * 检查性能阈值
   */
  private checkThresholds(metrics: PerformanceMetrics): void {
    const alerts: PerformanceAlert[] = [];

    // 检查延迟阈值
    if (metrics.latency.p95 > this.thresholds.maxLatencyP95) {
      alerts.push({
        id: `latency-${Date.now()}`,
        type: 'latency',
        severity: 'high',
        message: `P95延迟过高: ${metrics.latency.p95.toFixed(2)}ms`,
        value: metrics.latency.p95,
        threshold: this.thresholds.maxLatencyP95,
        timestamp: metrics.timestamp,
        resolved: false
      });
    }

    // 检查TPS阈值
    if (metrics.tps < this.thresholds.minTPS) {
      alerts.push({
        id: `tps-${Date.now()}`,
        type: 'tps',
        severity: 'medium',
        message: `TPS过低: ${metrics.tps.toFixed(0)}`,
        value: metrics.tps,
        threshold: this.thresholds.minTPS,
        timestamp: metrics.timestamp,
        resolved: false
      });
    }

    // 检查错误率阈值
    if (metrics.errors.errorRate > this.thresholds.maxErrorRate) {
      alerts.push({
        id: `error-${Date.now()}`,
        type: 'error_rate',
        severity: 'high',
        message: `错误率过高: ${metrics.errors.errorRate.toFixed(2)}%`,
        value: metrics.errors.errorRate,
        threshold: this.thresholds.maxErrorRate,
        timestamp: metrics.timestamp,
        resolved: false
      });
    }

    // 检查可用性阈值
    if (metrics.availability < this.thresholds.minAvailability) {
      alerts.push({
        id: `availability-${Date.now()}`,
        type: 'availability',
        severity: 'critical',
        message: `可用性过低: ${metrics.availability.toFixed(2)}%`,
        value: metrics.availability,
        threshold: this.thresholds.minAvailability,
        timestamp: metrics.timestamp,
        resolved: false
      });
    }

    // 检查资源使用率
    if (metrics.resources.cpuUsage > this.thresholds.maxCpuUsage) {
      alerts.push({
        id: `cpu-${Date.now()}`,
        type: 'resource',
        severity: 'medium',
        message: `CPU使用率过高: ${metrics.resources.cpuUsage.toFixed(2)}%`,
        value: metrics.resources.cpuUsage,
        threshold: this.thresholds.maxCpuUsage,
        timestamp: metrics.timestamp,
        resolved: false
      });
    }

    if (metrics.resources.memoryUsage > this.thresholds.maxMemoryUsage) {
      alerts.push({
        id: `memory-${Date.now()}`,
        type: 'resource',
        severity: 'medium',
        message: `内存使用率过高: ${metrics.resources.memoryUsage.toFixed(2)}%`,
        value: metrics.resources.memoryUsage,
        threshold: this.thresholds.maxMemoryUsage,
        timestamp: metrics.timestamp,
        resolved: false
      });
    }

    // 添加新警报
    for (const alert of alerts) {
      this.alerts.push(alert);
      this.emit('alert:triggered', alert);
      console.warn(`⚠️ 性能警报: ${alert.message}`);
    }
  }

  /**
   * 获取当前性能指标
   */
  getCurrentMetrics(): PerformanceMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  /**
   * 获取历史性能指标
   */
  getHistoricalMetrics(limit?: number): PerformanceMetrics[] {
    if (limit) {
      return this.metrics.slice(-limit);
    }
    return [...this.metrics];
  }

  /**
   * 获取活跃警报
   */
  getActiveAlerts(): PerformanceAlert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  /**
   * 获取所有警报
   */
  getAllAlerts(): PerformanceAlert[] {
    return [...this.alerts];
  }

  /**
   * 解决警报
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      this.emit('alert:resolved', alert);
      return true;
    }
    return false;
  }

  /**
   * 获取性能摘要
   */
  getPerformanceSummary(): any {
    const current = this.getCurrentMetrics();
    const activeAlerts = this.getActiveAlerts();
    
    return {
      current: current ? {
        tps: Math.round(current.tps),
        latencyP95: Math.round(current.latency.p95 * 100) / 100,
        availability: Math.round(current.availability * 100) / 100,
        errorRate: Math.round(current.errors.errorRate * 100) / 100
      } : null,
      thresholds: this.thresholds,
      alerts: {
        active: activeAlerts.length,
        critical: activeAlerts.filter(a => a.severity === 'critical').length,
        high: activeAlerts.filter(a => a.severity === 'high').length
      },
      statistics: {
        totalRequests: this.totalRequests,
        successfulRequests: this.successfulRequests,
        failedRequests: this.failedRequests,
        totalTransactions: this.totalTransactions
      }
    };
  }

  /**
   * 重置统计数据
   */
  reset(): void {
    this.metrics = [];
    this.requests.clear();
    this.latencies = [];
    this.alerts = [];
    this.totalRequests = 0;
    this.successfulRequests = 0;
    this.failedRequests = 0;
    this.totalBytes = 0;
    this.totalTransactions = 0;
    
    console.log('PerformanceMonitor statistics reset');
    this.emit('monitor:reset');
  }
}

/**
 * 默认性能阈值
 */
export const defaultPerformanceThresholds: PerformanceThresholds = {
  maxLatencyP95: 100, // 100ms
  minTPS: 1000, // 1000 TPS
  maxErrorRate: 1, // 1%
  minAvailability: 99.9, // 99.9%
  maxCpuUsage: 80, // 80%
  maxMemoryUsage: 85 // 85%
};