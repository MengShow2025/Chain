import { EventEmitter } from 'events';
import { ServiceInstance, ServiceStatus } from './load-balancer';

/**
 * 健康检查类型
 */
export enum HealthCheckType {
  HTTP = 'http',
  TCP = 'tcp',
  GRPC = 'grpc',
  CUSTOM = 'custom'
}

/**
 * 健康检查配置
 */
export interface HealthCheckConfig {
  id: string;
  name: string;
  type: HealthCheckType;
  target: string; // URL, 地址或自定义标识
  interval: number; // 检查间隔（毫秒）
  timeout: number; // 超时时间（毫秒）
  retries: number; // 重试次数
  successThreshold: number; // 连续成功次数阈值
  failureThreshold: number; // 连续失败次数阈值
  headers?: Record<string, string>; // HTTP 头部
  expectedStatus?: number; // 期望的HTTP状态码
  expectedResponse?: string; // 期望的响应内容
  customCheck?: (target: string) => Promise<boolean>; // 自定义检查函数
}

/**
 * 健康检查结果
 */
export interface HealthCheckResult {
  checkId: string;
  target: string;
  success: boolean;
  responseTime: number;
  timestamp: number;
  error?: string;
  statusCode?: number;
  response?: string;
}

/**
 * 健康状态历史
 */
export interface HealthHistory {
  target: string;
  results: HealthCheckResult[];
  currentStatus: ServiceStatus;
  consecutiveSuccesses: number;
  consecutiveFailures: number;
  lastStatusChange: number;
  uptime: number;
  downtime: number;
}

/**
 * 健康监控统计
 */
export interface HealthMonitorStats {
  totalChecks: number;
  activeChecks: number;
  successfulChecks: number;
  failedChecks: number;
  averageResponseTime: number;
  uptimePercentage: number;
  checksPerMinute: number;
}

/**
 * 健康监控器
 */
export class HealthMonitor extends EventEmitter {
  private checks: Map<string, HealthCheckConfig>;
  private intervals: Map<string, NodeJS.Timeout>;
  private history: Map<string, HealthHistory>;
  private stats: HealthMonitorStats;
  private maxHistorySize: number;
  private isRunning: boolean;

  constructor(maxHistorySize: number = 100) {
    super();
    
    this.checks = new Map();
    this.intervals = new Map();
    this.history = new Map();
    this.maxHistorySize = maxHistorySize;
    this.isRunning = false;
    
    this.stats = {
      totalChecks: 0,
      activeChecks: 0,
      successfulChecks: 0,
      failedChecks: 0,
      averageResponseTime: 0,
      uptimePercentage: 0,
      checksPerMinute: 0
    };
    
    console.log('HealthMonitor initialized');
  }

  /**
   * 添加健康检查
   */
  addHealthCheck(config: HealthCheckConfig): boolean {
    try {
      if (this.checks.has(config.id)) {
        console.log(`Health check ${config.id} already exists, updating...`);
        this.removeHealthCheck(config.id);
      }
      
      this.checks.set(config.id, config);
      
      // 初始化历史记录
      if (!this.history.has(config.target)) {
        this.history.set(config.target, {
          target: config.target,
          results: [],
          currentStatus: ServiceStatus.UNKNOWN,
          consecutiveSuccesses: 0,
          consecutiveFailures: 0,
          lastStatusChange: Date.now(),
          uptime: 0,
          downtime: 0
        });
      }
      
      // 如果监控器正在运行，立即启动检查
      if (this.isRunning) {
        this.startCheck(config);
      }
      
      console.log(`Health check added: ${config.id} (${config.target})`);
      return true;
      
    } catch (error) {
      console.error('Failed to add health check:', error);
      return false;
    }
  }

  /**
   * 移除健康检查
   */
  removeHealthCheck(checkId: string): boolean {
    try {
      const config = this.checks.get(checkId);
      if (!config) {
        console.log(`Health check not found: ${checkId}`);
        return false;
      }
      
      // 停止检查
      this.stopCheck(checkId);
      
      // 移除配置
      this.checks.delete(checkId);
      
      console.log(`Health check removed: ${checkId}`);
      return true;
      
    } catch (error) {
      console.error('Failed to remove health check:', error);
      return false;
    }
  }

  /**
   * 启动监控
   */
  start(): void {
    if (this.isRunning) {
      console.log('HealthMonitor is already running');
      return;
    }
    
    this.isRunning = true;
    
    // 启动所有健康检查
    for (const config of this.checks.values()) {
      this.startCheck(config);
    }
    
    // 启动统计更新
    setInterval(() => {
      this.updateStats();
    }, 60000); // 每分钟更新一次
    
    console.log(`HealthMonitor started with ${this.checks.size} checks`);
    this.emit('monitor:started');
  }

  /**
   * 停止监控
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('HealthMonitor is not running');
      return;
    }
    
    this.isRunning = false;
    
    // 停止所有检查
    for (const checkId of this.checks.keys()) {
      this.stopCheck(checkId);
    }
    
    console.log('HealthMonitor stopped');
    this.emit('monitor:stopped');
  }

  /**
   * 启动单个检查
   */
  private startCheck(config: HealthCheckConfig): void {
    // 停止现有检查
    this.stopCheck(config.id);
    
    // 立即执行一次检查
    this.performCheck(config);
    
    // 设置定期检查
    const interval = setInterval(() => {
      this.performCheck(config);
    }, config.interval);
    
    this.intervals.set(config.id, interval);
    
    console.log(`Health check started: ${config.id} (interval: ${config.interval}ms)`);
  }

  /**
   * 停止单个检查
   */
  private stopCheck(checkId: string): void {
    const interval = this.intervals.get(checkId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(checkId);
      console.log(`Health check stopped: ${checkId}`);
    }
  }

  /**
   * 执行健康检查
   */
  private async performCheck(config: HealthCheckConfig): Promise<void> {
    const startTime = Date.now();
    let result: HealthCheckResult;
    
    try {
      const success = await this.executeCheck(config);
      const responseTime = Date.now() - startTime;
      
      result = {
        checkId: config.id,
        target: config.target,
        success,
        responseTime,
        timestamp: startTime,
        error: success ? undefined : 'Check failed'
      };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      result = {
        checkId: config.id,
        target: config.target,
        success: false,
        responseTime,
        timestamp: startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
    
    // 处理检查结果
    this.processCheckResult(config, result);
  }

  /**
   * 执行具体的健康检查
   */
  private async executeCheck(config: HealthCheckConfig): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Health check timeout'));
      }, config.timeout);
      
      const cleanup = () => clearTimeout(timeout);
      
      try {
        switch (config.type) {
          case HealthCheckType.HTTP:
            this.performHttpCheck(config)
              .then(result => {
                cleanup();
                resolve(result);
              })
              .catch(error => {
                cleanup();
                reject(error);
              });
            break;
            
          case HealthCheckType.TCP:
            this.performTcpCheck(config)
              .then(result => {
                cleanup();
                resolve(result);
              })
              .catch(error => {
                cleanup();
                reject(error);
              });
            break;
            
          case HealthCheckType.CUSTOM:
            if (config.customCheck) {
              config.customCheck(config.target)
                .then(result => {
                  cleanup();
                  resolve(result);
                })
                .catch(error => {
                  cleanup();
                  reject(error);
                });
            } else {
              cleanup();
              reject(new Error('Custom check function not provided'));
            }
            break;
            
          default:
            cleanup();
            reject(new Error(`Unsupported check type: ${config.type}`));
        }
        
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  }

  /**
   * 执行HTTP健康检查
   */
  private async performHttpCheck(config: HealthCheckConfig): Promise<boolean> {
    // 模拟HTTP检查
    return new Promise((resolve) => {
      setTimeout(() => {
        // 90% 成功率
        const success = Math.random() > 0.1;
        resolve(success);
      }, Math.random() * 100 + 50); // 50-150ms 响应时间
    });
  }

  /**
   * 执行TCP健康检查
   */
  private async performTcpCheck(config: HealthCheckConfig): Promise<boolean> {
    // 模拟TCP检查
    return new Promise((resolve) => {
      setTimeout(() => {
        // 95% 成功率
        const success = Math.random() > 0.05;
        resolve(success);
      }, Math.random() * 50 + 25); // 25-75ms 响应时间
    });
  }

  /**
   * 处理检查结果
   */
  private processCheckResult(config: HealthCheckConfig, result: HealthCheckResult): void {
    const history = this.history.get(config.target);
    if (!history) {
      console.error(`No history found for target: ${config.target}`);
      return;
    }
    
    // 添加结果到历史
    history.results.push(result);
    
    // 限制历史大小
    if (history.results.length > this.maxHistorySize) {
      history.results.shift();
    }
    
    // 更新连续成功/失败计数
    if (result.success) {
      history.consecutiveSuccesses++;
      history.consecutiveFailures = 0;
    } else {
      history.consecutiveFailures++;
      history.consecutiveSuccesses = 0;
    }
    
    // 确定新状态
    const previousStatus = history.currentStatus;
    let newStatus = previousStatus;
    
    if (history.consecutiveSuccesses >= config.successThreshold) {
      newStatus = ServiceStatus.HEALTHY;
    } else if (history.consecutiveFailures >= config.failureThreshold) {
      newStatus = ServiceStatus.UNHEALTHY;
    }
    
    // 状态变化处理
    if (newStatus !== previousStatus) {
      history.currentStatus = newStatus;
      history.lastStatusChange = Date.now();
      
      console.log(`Health status changed: ${config.target} ${previousStatus} -> ${newStatus}`);
      
      this.emit('health:status_changed', {
        target: config.target,
        checkId: config.id,
        previousStatus,
        currentStatus: newStatus,
        result
      });
    }
    
    // 更新正常运行时间统计
    this.updateUptimeStats(history, result);
    
    // 触发检查完成事件
    this.emit('health:check_completed', {
      target: config.target,
      checkId: config.id,
      result,
      status: history.currentStatus
    });
    
    // 更新全局统计
    this.stats.totalChecks++;
    if (result.success) {
      this.stats.successfulChecks++;
    } else {
      this.stats.failedChecks++;
    }
  }

  /**
   * 更新正常运行时间统计
   */
  private updateUptimeStats(history: HealthHistory, result: HealthCheckResult): void {
    const now = Date.now();
    const timeSinceLastChange = now - history.lastStatusChange;
    
    if (history.currentStatus === ServiceStatus.HEALTHY) {
      history.uptime += timeSinceLastChange;
    } else if (history.currentStatus === ServiceStatus.UNHEALTHY) {
      history.downtime += timeSinceLastChange;
    }
  }

  /**
   * 获取目标健康状态
   */
  getHealthStatus(target: string): ServiceStatus {
    const history = this.history.get(target);
    return history ? history.currentStatus : ServiceStatus.UNKNOWN;
  }

  /**
   * 获取目标健康历史
   */
  getHealthHistory(target: string): HealthHistory | null {
    return this.history.get(target) || null;
  }

  /**
   * 获取所有健康状态
   */
  getAllHealthStatus(): Map<string, ServiceStatus> {
    const statusMap = new Map<string, ServiceStatus>();
    
    for (const [target, history] of this.history) {
      statusMap.set(target, history.currentStatus);
    }
    
    return statusMap;
  }

  /**
   * 获取健康的目标列表
   */
  getHealthyTargets(): string[] {
    const healthyTargets: string[] = [];
    
    for (const [target, history] of this.history) {
      if (history.currentStatus === ServiceStatus.HEALTHY) {
        healthyTargets.push(target);
      }
    }
    
    return healthyTargets;
  }

  /**
   * 获取不健康的目标列表
   */
  getUnhealthyTargets(): string[] {
    const unhealthyTargets: string[] = [];
    
    for (const [target, history] of this.history) {
      if (history.currentStatus === ServiceStatus.UNHEALTHY) {
        unhealthyTargets.push(target);
      }
    }
    
    return unhealthyTargets;
  }

  /**
   * 手动触发检查
   */
  async triggerCheck(checkId: string): Promise<HealthCheckResult | null> {
    const config = this.checks.get(checkId);
    if (!config) {
      console.log(`Health check not found: ${checkId}`);
      return null;
    }
    
    const startTime = Date.now();
    
    try {
      const success = await this.executeCheck(config);
      const responseTime = Date.now() - startTime;
      
      const result: HealthCheckResult = {
        checkId: config.id,
        target: config.target,
        success,
        responseTime,
        timestamp: startTime
      };
      
      this.processCheckResult(config, result);
      return result;
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      const result: HealthCheckResult = {
        checkId: config.id,
        target: config.target,
        success: false,
        responseTime,
        timestamp: startTime,
        error: error instanceof Error ? error.message : String(error)
      };
      
      this.processCheckResult(config, result);
      return result;
    }
  }

  /**
   * 更新统计信息
   */
  private updateStats(): void {
    this.stats.activeChecks = this.checks.size;
    
    // 计算平均响应时间
    let totalResponseTime = 0;
    let totalResults = 0;
    
    for (const history of this.history.values()) {
      for (const result of history.results) {
        totalResponseTime += result.responseTime;
        totalResults++;
      }
    }
    
    this.stats.averageResponseTime = totalResults > 0 ? totalResponseTime / totalResults : 0;
    
    // 计算正常运行时间百分比
    let totalUptime = 0;
    let totalTime = 0;
    
    for (const history of this.history.values()) {
      totalUptime += history.uptime;
      totalTime += history.uptime + history.downtime;
    }
    
    this.stats.uptimePercentage = totalTime > 0 ? (totalUptime / totalTime) * 100 : 0;
    
    // 计算每分钟检查次数
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    let checksInLastMinute = 0;
    
    for (const history of this.history.values()) {
      checksInLastMinute += history.results.filter(
        result => result.timestamp > oneMinuteAgo
      ).length;
    }
    
    this.stats.checksPerMinute = checksInLastMinute;
  }

  /**
   * 获取统计信息
   */
  getStats(): HealthMonitorStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * 获取检查配置列表
   */
  getCheckConfigs(): HealthCheckConfig[] {
    return Array.from(this.checks.values());
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    this.stop();
    
    this.checks.clear();
    this.history.clear();
    this.removeAllListeners();
    
    console.log('HealthMonitor cleaned up');
  }
}