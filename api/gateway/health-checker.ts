// Health Checker implementation for service monitoring / 服务监控的健康检查器实现
import { EventEmitter } from 'events';

// Health check configuration interface / 健康检查配置接口
export interface HealthCheckConfig {
  id: string;
  name: string;
  type: HealthCheckType;
  target: string;
  interval: number;
  timeout: number;
  retries: number;
  enabled: boolean;
}

// Health check types / 健康检查类型
export enum HealthCheckType {
  HTTP = 'http',
  TCP = 'tcp',
  PING = 'ping',
  SCRIPT = 'script'
}

// Health check result interface / 健康检查结果接口
export interface HealthCheckResult {
  id: string;
  name: string;
  status: HealthStatus;
  responseTime: number;
  timestamp: number;
  error?: string;
  details?: any;
}

// Health status enum / 健康状态枚举
export enum HealthStatus {
  HEALTHY = 'healthy',
  UNHEALTHY = 'unhealthy',
  WARNING = 'warning',
  UNKNOWN = 'unknown'
}

// Health check statistics / 健康检查统计
export interface HealthCheckStats {
  totalChecks: number;
  successfulChecks: number;
  failedChecks: number;
  averageResponseTime: number;
  uptime: number;
  lastCheckTime: number;
}

// Main Health Checker class / 主要健康检查器类
export class HealthChecker extends EventEmitter {
  private checks: Map<string, HealthCheckConfig> = new Map();
  private results: Map<string, HealthCheckResult> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private stats: Map<string, HealthCheckStats> = new Map();
  private isRunning = false;

  constructor() {
    super();
  }

  // Add a health check / 添加健康检查
  addCheck(config: HealthCheckConfig): void {
    this.checks.set(config.id, { ...config });
    
    // Initialize stats / 初始化统计
    this.stats.set(config.id, {
      totalChecks: 0,
      successfulChecks: 0,
      failedChecks: 0,
      averageResponseTime: 0,
      uptime: 0,
      lastCheckTime: 0
    });

    // Start the check if running / 如果正在运行则启动检查
    if (this.isRunning && config.enabled) {
      this.startCheck(config.id);
    }

    console.log(`Health check added: ${config.name} (${config.id})`);
  }

  // Remove a health check / 移除健康检查
  removeCheck(id: string): void {
    this.stopCheck(id);
    this.checks.delete(id);
    this.results.delete(id);
    this.stats.delete(id);
    
    console.log(`Health check removed: ${id}`);
  }

  // Get health check result / 获取健康检查结果
  getResult(id: string): HealthCheckResult | undefined {
    return this.results.get(id);
  }

  // Get all health check results / 获取所有健康检查结果
  getAllResults(): Map<string, HealthCheckResult> {
    return new Map(this.results);
  }

  // Get health check statistics / 获取健康检查统计
  getStats(id: string): HealthCheckStats | undefined {
    return this.stats.get(id);
  }

  // Get all statistics / 获取所有统计
  getAllStats(): Map<string, HealthCheckStats> {
    return new Map(this.stats);
  }

  // Start all health checks / 启动所有健康检查
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    
    // Start all enabled checks / 启动所有启用的检查
    for (const [id, config] of Array.from(this.checks.entries())) {
      if (config.enabled) {
        this.startCheck(id);
      }
    }

    console.log('Health Checker started');
  }

  // Stop all health checks / 停止所有健康检查
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // Stop all checks / 停止所有检查
    for (const id of Array.from(this.checks.keys())) {
      this.stopCheck(id);
    }

    console.log('Health Checker stopped');
  }

  // Start a specific health check / 启动特定的健康检查
  private startCheck(id: string): void {
    const config = this.checks.get(id);
    if (!config) {
      return;
    }

    // Stop existing interval / 停止现有间隔
    this.stopCheck(id);

    // Start new interval / 启动新间隔
    const interval = setInterval(async () => {
      await this.performCheck(id);
    }, config.interval);

    this.intervals.set(id, interval);

    // Perform initial check / 执行初始检查
    this.performCheck(id);
  }

  // Stop a specific health check / 停止特定的健康检查
  private stopCheck(id: string): void {
    const interval = this.intervals.get(id);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(id);
    }
  }

  // Perform a health check / 执行健康检查
  private async performCheck(id: string): Promise<void> {
    const config = this.checks.get(id);
    if (!config) {
      return;
    }

    const startTime = Date.now();
    let result: HealthCheckResult;

    try {
      const isHealthy = await this.executeCheck(config);
      const responseTime = Date.now() - startTime;

      result = {
        id: config.id,
        name: config.name,
        status: isHealthy ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY,
        responseTime,
        timestamp: Date.now()
      };

      // Update statistics / 更新统计
      this.updateStats(id, true, responseTime);

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      result = {
        id: config.id,
        name: config.name,
        status: HealthStatus.UNHEALTHY,
        responseTime,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error)
      };

      // Update statistics / 更新统计
      this.updateStats(id, false, responseTime);
    }

    // Store result / 存储结果
    const previousResult = this.results.get(id);
    this.results.set(id, result);

    // Emit events / 发出事件
    this.emit('check_completed', result);

    // Emit status change event if status changed / 如果状态改变则发出状态变化事件
    if (!previousResult || previousResult.status !== result.status) {
      this.emit('status_changed', {
        id,
        previousStatus: previousResult?.status,
        currentStatus: result.status,
        result
      });

      console.log(`Health check status changed: ${config.name} -> ${result.status}`);
    }
  }

  // Execute the actual health check / 执行实际的健康检查
  private async executeCheck(config: HealthCheckConfig): Promise<boolean> {
    switch (config.type) {
      case HealthCheckType.HTTP:
        return this.performHttpCheck(config);
      case HealthCheckType.TCP:
        return this.performTcpCheck(config);
      case HealthCheckType.PING:
        return this.performPingCheck(config);
      case HealthCheckType.SCRIPT:
        return this.performScriptCheck(config);
      default:
        throw new Error(`Unsupported health check type: ${config.type}`);
    }
  }

  // Perform HTTP health check / 执行HTTP健康检查
  private async performHttpCheck(config: HealthCheckConfig): Promise<boolean> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);

    try {
      const response = await fetch(config.target, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      clearTimeout(timeoutId);
      return false;
    }
  }

  // Perform TCP health check / 执行TCP健康检查
  private async performTcpCheck(config: HealthCheckConfig): Promise<boolean> {
    return new Promise((resolve) => {
      const net = require('net');
      const socket = new net.Socket();
      
      const timer = setTimeout(() => {
        socket.destroy();
        resolve(false);
      }, config.timeout);

      const [host, portStr] = config.target.split(':');
      const port = parseInt(portStr);

      socket.connect(port, host, () => {
        clearTimeout(timer);
        socket.destroy();
        resolve(true);
      });

      socket.on('error', () => {
        clearTimeout(timer);
        resolve(false);
      });
    });
  }

  // Perform ping health check / 执行ping健康检查
  private async performPingCheck(config: HealthCheckConfig): Promise<boolean> {
    return new Promise((resolve) => {
      const { exec } = require('child_process');
      const command = process.platform === 'win32' 
        ? `ping -n 1 ${config.target}`
        : `ping -c 1 ${config.target}`;

      exec(command, { timeout: config.timeout }, (error: any) => {
        resolve(!error);
      });
    });
  }

  // Perform script health check / 执行脚本健康检查
  private async performScriptCheck(config: HealthCheckConfig): Promise<boolean> {
    return new Promise((resolve) => {
      const { exec } = require('child_process');
      
      exec(config.target, { timeout: config.timeout }, (error: any, stdout: string, stderr: string) => {
        if (error) {
          resolve(false);
        } else {
          // Consider successful if exit code is 0 / 如果退出代码为0则认为成功
          resolve(true);
        }
      });
    });
  }

  // Update statistics / 更新统计
  private updateStats(id: string, success: boolean, responseTime: number): void {
    const stats = this.stats.get(id);
    if (!stats) {
      return;
    }

    stats.totalChecks++;
    stats.lastCheckTime = Date.now();

    if (success) {
      stats.successfulChecks++;
    } else {
      stats.failedChecks++;
    }

    // Update average response time / 更新平均响应时间
    stats.averageResponseTime = 
      ((stats.averageResponseTime * (stats.totalChecks - 1)) + responseTime) / stats.totalChecks;

    // Calculate uptime percentage / 计算正常运行时间百分比
    stats.uptime = stats.totalChecks > 0 ? 
      (stats.successfulChecks / stats.totalChecks) * 100 : 0;

    this.stats.set(id, stats);
  }

  // Get overall health status / 获取整体健康状态
  getOverallStatus(): HealthStatus {
    if (this.results.size === 0) {
      return HealthStatus.UNKNOWN;
    }

    let healthyCount = 0;
    let unhealthyCount = 0;
    let warningCount = 0;

    for (const result of Array.from(this.results.values())) {
      switch (result.status) {
        case HealthStatus.HEALTHY:
          healthyCount++;
          break;
        case HealthStatus.UNHEALTHY:
          unhealthyCount++;
          break;
        case HealthStatus.WARNING:
          warningCount++;
          break;
      }
    }

    // Determine overall status / 确定整体状态
    if (unhealthyCount > 0) {
      return HealthStatus.UNHEALTHY;
    } else if (warningCount > 0) {
      return HealthStatus.WARNING;
    } else if (healthyCount > 0) {
      return HealthStatus.HEALTHY;
    } else {
      return HealthStatus.UNKNOWN;
    }
  }

  // Get summary of all health checks / 获取所有健康检查的摘要
  getSummary(): any {
    const summary = {
      overallStatus: this.getOverallStatus(),
      totalChecks: this.checks.size,
      runningChecks: this.intervals.size,
      results: {} as any,
      timestamp: Date.now()
    };

    for (const [id, result] of Array.from(this.results.entries())) {
      const stats = this.stats.get(id);
      summary.results[id] = {
        ...result,
        stats: stats ? {
          uptime: stats.uptime.toFixed(2) + '%',
          averageResponseTime: Math.round(stats.averageResponseTime) + 'ms',
          totalChecks: stats.totalChecks
        } : null
      };
    }

    return summary;
  }

  // Check if health checker is running / 检查健康检查器是否正在运行
  isActive(): boolean {
    return this.isRunning;
  }
}