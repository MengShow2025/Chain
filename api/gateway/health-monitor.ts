// Health Monitor service for comprehensive system monitoring / 综合系统监控的健康监控服务
import { EventEmitter } from 'events';
import { HealthChecker, HealthCheckConfig as BaseHealthCheckConfig, HealthCheckResult as BaseHealthCheckResult, HealthStatus } from './health-checker';

// Extended health check types / 扩展健康检查类型
export enum SystemHealthCheckType {
  MEMORY = 'memory',
  CPU = 'cpu',
  DISK = 'disk',
  CUSTOM = 'custom'
}

// Extended health check configuration interface / 扩展健康检查配置接口
export interface SystemHealthCheckConfig {
  id: string;
  name: string;
  type: SystemHealthCheckType;
  target: string;
  interval: number;
  timeout: number;
  retries: number;
  enabled: boolean;
  thresholds?: HealthThresholds;
  metadata?: Record<string, any>;
}

// Health thresholds for different metrics / 不同指标的健康阈值
export interface HealthThresholds {
  warning: number;
  critical: number;
  unit?: string;
}

// Extended health check result interface / 扩展健康检查结果接口
export interface SystemHealthCheckResult {
  id: string;
  name: string;
  status: HealthStatus;
  value?: number;
  responseTime: number;
  timestamp: number;
  error?: string;
  details?: Record<string, any>;
}

// Health history entry / 健康历史记录条目
export interface HealthHistory {
  timestamp: number;
  status: HealthStatus;
  value?: number;
  responseTime: number;
  error?: string;
}

// Health monitor statistics / 健康监控统计
export interface HealthMonitorStats {
  totalChecks: number;
  activeChecks: number;
  healthyChecks: number;
  warningChecks: number;
  criticalChecks: number;
  averageResponseTime: number;
  uptime: number;
  lastCheckTime: number;
}

// System metrics interface / 系统指标接口
export interface SystemMetrics {
  memory: {
    used: number;
    total: number;
    percentage: number;
    available: number;
  };
  cpu: {
    usage: number;
    loadAverage: number[];
    cores: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
    available: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
  };
  process: {
    pid: number;
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  };
}

// Health monitor configuration / 健康监控配置
export interface HealthMonitorConfig {
  enabled: boolean;
  checkInterval: number;
  historyRetention: number;
  alertThresholds: {
    consecutiveFailures: number;
    responseTimeThreshold: number;
  };
  systemMetrics: {
    enabled: boolean;
    interval: number;
  };
  notifications: {
    enabled: boolean;
    webhookUrl?: string;
    emailRecipients?: string[];
  };
}

// Main Health Monitor class / 主要健康监控类
export class HealthMonitor extends EventEmitter {
  private config: HealthMonitorConfig;
  private healthChecker: HealthChecker;
  private systemChecks: Map<string, SystemHealthCheckConfig> = new Map();
  private results: Map<string, SystemHealthCheckResult> = new Map();
  private history: Map<string, HealthHistory[]> = new Map();
  private stats: HealthMonitorStats;
  private systemMetrics?: SystemMetrics;
  private monitorTimer?: NodeJS.Timeout;
  private metricsTimer?: NodeJS.Timeout;
  private isRunning = false;

  constructor(config: HealthMonitorConfig) {
    super();
    this.config = { ...config };
    this.healthChecker = new HealthChecker();
    
    this.stats = {
      totalChecks: 0,
      activeChecks: 0,
      healthyChecks: 0,
      warningChecks: 0,
      criticalChecks: 0,
      averageResponseTime: 0,
      uptime: 0,
      lastCheckTime: 0
    };

    this.setupHealthChecker();
    this.setupSystemChecks();
  }

  // Setup health checker event handlers / 设置健康检查器事件处理程序
  private setupHealthChecker(): void {
    this.healthChecker.on('check_completed', (result: BaseHealthCheckResult) => {
      this.handleStandardCheckResult(result);
    });

    this.healthChecker.on('status_changed', (event: any) => {
      this.handleStatusChange(event);
    });
  }

  // Setup default system health checks / 设置默认系统健康检查
  private setupSystemChecks(): void {
    // Memory usage check / 内存使用检查
    this.addSystemCheck({
      id: 'system_memory',
      name: 'System Memory Usage',
      type: SystemHealthCheckType.MEMORY,
      target: 'memory',
      interval: 30000,
      timeout: 1000,
      retries: 0,
      enabled: true,
      thresholds: {
        warning: 80,
        critical: 95,
        unit: '%'
      }
    });

    // CPU usage check / CPU使用检查
    this.addSystemCheck({
      id: 'system_cpu',
      name: 'System CPU Usage',
      type: SystemHealthCheckType.CPU,
      target: 'cpu',
      interval: 30000,
      timeout: 1000,
      retries: 0,
      enabled: true,
      thresholds: {
        warning: 80,
        critical: 95,
        unit: '%'
      }
    });

    // Disk usage check / 磁盘使用检查
    this.addSystemCheck({
      id: 'system_disk',
      name: 'System Disk Usage',
      type: SystemHealthCheckType.DISK,
      target: '/',
      interval: 60000,
      timeout: 1000,
      retries: 0,
      enabled: true,
      thresholds: {
        warning: 85,
        critical: 95,
        unit: '%'
      }
    });
  }

  // Add standard health check / 添加标准健康检查
  addHealthCheck(config: BaseHealthCheckConfig): void {
    this.healthChecker.addCheck(config);
    console.log(`Health monitor: Standard check added ${config.name} (${config.id})`);
    this.emit('check_added', config);
  }

  // Add system health check / 添加系统健康检查
  addSystemCheck(config: SystemHealthCheckConfig): void {
    this.systemChecks.set(config.id, { ...config });
    
    // Initialize history / 初始化历史记录
    this.history.set(config.id, []);

    console.log(`Health monitor: System check added ${config.name} (${config.id})`);
    this.emit('system_check_added', config);
  }

  // Remove health check / 移除健康检查
  removeCheck(checkId: string): void {
    // Try to remove from standard checks first / 首先尝试从标准检查中移除
    this.healthChecker.removeCheck(checkId);

    // Remove from system checks / 从系统检查中移除
    const config = this.systemChecks.get(checkId);
    if (config) {
      this.systemChecks.delete(checkId);
      this.results.delete(checkId);
      this.history.delete(checkId);

      console.log(`Health monitor: System check removed ${checkId}`);
      this.emit('system_check_removed', config);
    }
  }

  // Start health monitoring / 开始健康监控
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    
    // Start health checker / 启动健康检查器
    this.healthChecker.start();

    // Start monitoring timer / 启动监控定时器
    if (this.config.checkInterval > 0) {
      this.monitorTimer = setInterval(() => {
        this.performSystemChecks();
      }, this.config.checkInterval);
    }

    // Start system metrics collection / 启动系统指标收集
    if (this.config.systemMetrics.enabled) {
      this.metricsTimer = setInterval(() => {
        this.collectSystemMetrics();
      }, this.config.systemMetrics.interval);
    }

    console.log('Health Monitor started');
    this.emit('started');
  }

  // Stop health monitoring / 停止健康监控
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // Stop health checker / 停止健康检查器
    this.healthChecker.stop();

    // Clear timers / 清除定时器
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = undefined;
    }

    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = undefined;
    }

    console.log('Health Monitor stopped');
    this.emit('stopped');
  }

  // Perform system health checks / 执行系统健康检查
  private async performSystemChecks(): Promise<void> {
    const systemChecks = Array.from(this.systemChecks.values()).filter(
      check => check.enabled
    );

    for (const check of systemChecks) {
      try {
        const result = await this.performSystemCheck(check);
        this.handleSystemCheckResult(result);
      } catch (error) {
        console.error(`System check failed for ${check.id}:`, error);
      }
    }
  }

  // Perform individual system check / 执行单个系统检查
  private async performSystemCheck(config: SystemHealthCheckConfig): Promise<SystemHealthCheckResult> {
    const startTime = Date.now();
    
    try {
      let value: number;
      let status: HealthStatus;
      let details: Record<string, any> = {};

      switch (config.type) {
        case SystemHealthCheckType.MEMORY:
          value = await this.checkMemoryUsage();
          details = { memoryUsage: value };
          break;
        case SystemHealthCheckType.CPU:
          value = await this.checkCpuUsage();
          details = { cpuUsage: value };
          break;
        case SystemHealthCheckType.DISK:
          value = await this.checkDiskUsage(config.target);
          details = { diskUsage: value, path: config.target };
          break;
        default:
          throw new Error(`Unsupported system check type: ${config.type}`);
      }

      // Determine status based on thresholds / 根据阈值确定状态
      if (config.thresholds) {
        if (value >= config.thresholds.critical) {
          status = HealthStatus.UNHEALTHY;
        } else if (value >= config.thresholds.warning) {
          status = HealthStatus.WARNING;
        } else {
          status = HealthStatus.HEALTHY;
        }
      } else {
        status = HealthStatus.HEALTHY;
      }

      return {
        id: config.id,
        name: config.name,
        status,
        value,
        responseTime: Date.now() - startTime,
        timestamp: Date.now(),
        details
      };

    } catch (error) {
      return {
        id: config.id,
        name: config.name,
        status: HealthStatus.UNHEALTHY,
        responseTime: Date.now() - startTime,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  // Check memory usage percentage / 检查内存使用百分比
  private async checkMemoryUsage(): Promise<number> {
    const memUsage = process.memoryUsage();
    const totalMem = memUsage.heapTotal;
    const usedMem = memUsage.heapUsed;
    return (usedMem / totalMem) * 100;
  }

  // Check CPU usage percentage / 检查CPU使用百分比
  private async checkCpuUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const totalUsage = (endUsage.user + endUsage.system) / 1000;
        const cpuPercent = Math.min(100, (totalUsage / 100) * 100);
        resolve(cpuPercent);
      }, 100);
    });
  }

  // Check disk usage percentage / 检查磁盘使用百分比
  private async checkDiskUsage(path: string): Promise<number> {
    // Simplified disk usage check / 简化的磁盘使用检查
    // In a real implementation, you would use fs.statSync or similar / 在实际实现中，您会使用fs.statSync或类似方法
    return Math.random() * 100; // Mock implementation / 模拟实现
  }

  // Collect system metrics / 收集系统指标
  private async collectSystemMetrics(): Promise<void> {
    try {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      this.systemMetrics = {
        memory: {
          used: memUsage.heapUsed,
          total: memUsage.heapTotal,
          percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
          available: memUsage.heapTotal - memUsage.heapUsed
        },
        cpu: {
          usage: await this.checkCpuUsage(),
          loadAverage: [0, 0, 0], // Would use os.loadavg() in real implementation / 在实际实现中会使用os.loadavg()
          cores: 1 // Would use os.cpus().length in real implementation / 在实际实现中会使用os.cpus().length
        },
        disk: {
          used: 0,
          total: 0,
          percentage: 0,
          available: 0
        },
        network: {
          bytesIn: 0,
          bytesOut: 0,
          packetsIn: 0,
          packetsOut: 0
        },
        process: {
          pid: process.pid,
          uptime: process.uptime(),
          memoryUsage: memUsage,
          cpuUsage: cpuUsage
        }
      };

      this.emit('metrics_collected', this.systemMetrics);
    } catch (error) {
      console.error('Failed to collect system metrics:', error);
    }
  }

  // Handle standard health check result / 处理标准健康检查结果
  private handleStandardCheckResult(result: BaseHealthCheckResult): void {
    // Convert to system result format / 转换为系统结果格式
    const systemResult: SystemHealthCheckResult = {
      id: result.id,
      name: result.name,
      status: result.status,
      responseTime: result.responseTime,
      timestamp: result.timestamp,
      error: result.error
    };

    this.handleSystemCheckResult(systemResult);
  }

  // Handle system health check result / 处理系统健康检查结果
  private handleSystemCheckResult(result: SystemHealthCheckResult): void {
    // Store result / 存储结果
    this.results.set(result.id, result);

    // Add to history / 添加到历史记录
    const history = this.history.get(result.id) || [];
    history.push({
      timestamp: result.timestamp,
      status: result.status,
      value: result.value,
      responseTime: result.responseTime,
      error: result.error
    });

    // Limit history size / 限制历史记录大小
    if (history.length > this.config.historyRetention) {
      history.splice(0, history.length - this.config.historyRetention);
    }
    this.history.set(result.id, history);

    // Update statistics / 更新统计
    this.updateStats(result);

    // Emit events / 发出事件
    this.emit('check_result', result);

    // Check for alerts / 检查警报
    this.checkAlerts(result);
  }

  // Handle status change / 处理状态变化
  private handleStatusChange(event: any): void {
    console.log(`Health status changed: ${event.id} -> ${event.currentStatus}`);
    this.emit('status_changed', event);
  }

  // Update statistics / 更新统计
  private updateStats(result: SystemHealthCheckResult): void {
    this.stats.totalChecks++;
    this.stats.lastCheckTime = result.timestamp;

    // Update status counts / 更新状态计数
    this.stats.activeChecks = this.systemChecks.size;
    this.stats.healthyChecks = 0;
    this.stats.warningChecks = 0;
    this.stats.criticalChecks = 0;

    for (const res of Array.from(this.results.values())) {
      switch (res.status) {
        case HealthStatus.HEALTHY:
          this.stats.healthyChecks++;
          break;
        case HealthStatus.WARNING:
          this.stats.warningChecks++;
          break;
        case HealthStatus.UNHEALTHY:
          this.stats.criticalChecks++;
          break;
      }
    }

    // Update average response time / 更新平均响应时间
    this.stats.averageResponseTime = 
      ((this.stats.averageResponseTime * (this.stats.totalChecks - 1)) + result.responseTime) / this.stats.totalChecks;

    // Calculate uptime / 计算正常运行时间
    this.stats.uptime = this.stats.totalChecks > 0 ? 
      (this.stats.healthyChecks / this.results.size) * 100 : 0;
  }

  // Check for alerts / 检查警报
  private checkAlerts(result: SystemHealthCheckResult): void {
    if (!this.config.notifications.enabled) {
      return;
    }

    const history = this.history.get(result.id) || [];
    const recentFailures = history
      .slice(-this.config.alertThresholds.consecutiveFailures)
      .filter(h => h.status !== HealthStatus.HEALTHY);

    // Check for consecutive failures / 检查连续失败
    if (recentFailures.length >= this.config.alertThresholds.consecutiveFailures) {
      this.sendAlert({
        type: 'consecutive_failures',
        checkId: result.id,
        checkName: result.name,
        failures: recentFailures.length,
        threshold: this.config.alertThresholds.consecutiveFailures
      });
    }

    // Check for high response time / 检查高响应时间
    if (result.responseTime > this.config.alertThresholds.responseTimeThreshold) {
      this.sendAlert({
        type: 'high_response_time',
        checkId: result.id,
        checkName: result.name,
        responseTime: result.responseTime,
        threshold: this.config.alertThresholds.responseTimeThreshold
      });
    }
  }

  // Send alert notification / 发送警报通知
  private async sendAlert(alert: any): Promise<void> {
    try {
      console.log('Alert triggered:', alert);
      this.emit('alert', alert);

      // Send webhook notification if configured / 如果配置了webhook则发送通知
      if (this.config.notifications.webhookUrl) {
        await this.sendWebhookAlert(alert);
      }

      // Send email notification if configured / 如果配置了邮件则发送通知
      if (this.config.notifications.emailRecipients?.length) {
        await this.sendEmailAlert(alert);
      }
    } catch (error) {
      console.error('Failed to send alert:', error);
    }
  }

  // Send webhook alert / 发送webhook警报
  private async sendWebhookAlert(alert: any): Promise<void> {
    if (!this.config.notifications.webhookUrl) return;

    try {
      const response = await fetch(this.config.notifications.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          alert,
          source: 'TitanChain Health Monitor'
        })
      });

      if (!response.ok) {
        throw new Error(`Webhook request failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Webhook alert failed:', error);
    }
  }

  // Send email alert / 发送邮件警报
  private async sendEmailAlert(alert: any): Promise<void> {
    // Email implementation would go here / 邮件实现将在这里
    console.log('Email alert would be sent to:', this.config.notifications.emailRecipients);
  }

  // Get health check result / 获取健康检查结果
  getResult(checkId: string): SystemHealthCheckResult | undefined {
    return this.results.get(checkId);
  }

  // Get all health check results / 获取所有健康检查结果
  getAllResults(): Map<string, SystemHealthCheckResult> {
    return new Map(this.results);
  }

  // Get health check history / 获取健康检查历史
  getHistory(checkId: string): HealthHistory[] {
    return this.history.get(checkId) || [];
  }

  // Get statistics / 获取统计
  getStats(): HealthMonitorStats {
    return { ...this.stats };
  }

  // Get system metrics / 获取系统指标
  getSystemMetrics(): SystemMetrics | undefined {
    return this.systemMetrics ? { ...this.systemMetrics } : undefined;
  }

  // Get overall health status / 获取整体健康状态
  getOverallStatus(): HealthStatus {
    if (this.results.size === 0) {
      return HealthStatus.UNKNOWN;
    }

    let hasUnhealthy = false;
    let hasWarning = false;

    for (const result of Array.from(this.results.values())) {
      if (result.status === HealthStatus.UNHEALTHY) {
        hasUnhealthy = true;
      } else if (result.status === HealthStatus.WARNING) {
        hasWarning = true;
      }
    }

    if (hasUnhealthy) {
      return HealthStatus.UNHEALTHY;
    } else if (hasWarning) {
      return HealthStatus.WARNING;
    } else {
      return HealthStatus.HEALTHY;
    }
  }

  // Get health summary / 获取健康摘要
  getSummary(): any {
    return {
      overallStatus: this.getOverallStatus(),
      stats: this.getStats(),
      systemMetrics: this.getSystemMetrics(),
      checks: Array.from(this.results.values()),
      timestamp: Date.now()
    };
  }

  // Update configuration / 更新配置
  updateConfig(newConfig: Partial<HealthMonitorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    console.log('Health Monitor configuration updated');
    this.emit('config_updated', this.config);
  }

  // Check if monitor is running / 检查监控器是否正在运行
  isActive(): boolean {
    return this.isRunning;
  }
}