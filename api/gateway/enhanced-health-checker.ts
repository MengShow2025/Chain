/**
 * Enhanced Health Checker for TitanChain API Gateway
 * Implements comprehensive health monitoring with deep checks and auto-failover
 * 
 * Features / 功能特性:
 * - Deep Health Checks / 深度健康检查
 * - Service Dependency Monitoring / 服务依赖监控
 * - Performance Metrics Tracking / 性能指标跟踪
 * - Auto Failover Mechanism / 自动故障转移机制
 * - Circuit Breaker Pattern / 熔断器模式
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

// Types and Interfaces / 类型和接口
export interface HealthCheckConfig {
  enabled: boolean;                // Enable health checks / 启用健康检查
  interval: number;                // Check interval in ms / 检查间隔(毫秒)
  timeout: number;                 // Check timeout in ms / 检查超时时间(毫秒)
  retries: number;                 // Max retry attempts / 最大重试次数
  threshold: {                     // Health thresholds / 健康阈值
    consecutive_failures: number;  // Consecutive failures to mark unhealthy / 连续失败次数标记不健康
    consecutive_successes: number; // Consecutive successes to mark healthy / 连续成功次数标记健康
    response_time: number;         // Max acceptable response time / 最大可接受响应时间
    error_rate: number;            // Max acceptable error rate / 最大可接受错误率
  };
  deep_check: {                    // Deep health check config / 深度健康检查配置
    enabled: boolean;              // Enable deep checks / 启用深度检查
    interval: number;              // Deep check interval / 深度检查间隔
    endpoints: string[];           // Endpoints to check / 要检查的端点
  };
}

export interface ServiceHealth {
  serviceId: string;               // Service identifier / 服务标识
  status: 'healthy' | 'unhealthy' | 'degraded' | 'unknown'; // Health status / 健康状态
  lastCheck: number;               // Last check timestamp / 最后检查时间
  responseTime: number;            // Last response time / 最后响应时间
  consecutiveFailures: number;     // Consecutive failure count / 连续失败次数
  consecutiveSuccesses: number;    // Consecutive success count / 连续成功次数
  errorRate: number;               // Current error rate / 当前错误率
  uptime: number;                  // Service uptime percentage / 服务正常运行时间百分比
  metadata: {                      // Additional metadata / 附加元数据
    version?: string;              // Service version / 服务版本
    build?: string;                // Build information / 构建信息
    dependencies?: DependencyHealth[]; // Dependency health / 依赖健康状态
    performance?: PerformanceMetrics; // Performance metrics / 性能指标
  };
}

export interface DependencyHealth {
  name: string;                    // Dependency name / 依赖名称
  type: 'database' | 'cache' | 'external_api' | 'message_queue' | 'file_system'; // Dependency type / 依赖类型
  status: 'healthy' | 'unhealthy' | 'degraded'; // Dependency status / 依赖状态
  responseTime: number;            // Response time / 响应时间
  lastCheck: number;               // Last check time / 最后检查时间
  errorMessage?: string;           // Error message if unhealthy / 不健康时的错误消息
}

export interface PerformanceMetrics {
  cpu: number;                     // CPU usage percentage / CPU使用率百分比
  memory: number;                  // Memory usage percentage / 内存使用率百分比
  disk: number;                    // Disk usage percentage / 磁盘使用率百分比
  network: {                       // Network metrics / 网络指标
    inbound: number;               // Inbound traffic / 入站流量
    outbound: number;              // Outbound traffic / 出站流量
  };
  activeConnections: number;       // Active connections / 活跃连接数
  queueSize: number;               // Queue size / 队列大小
}

export interface CircuitBreakerState {
  serviceId: string;               // Service identifier / 服务标识
  state: 'closed' | 'open' | 'half_open'; // Circuit breaker state / 熔断器状态
  failureCount: number;            // Failure count / 失败次数
  lastFailureTime: number;         // Last failure timestamp / 最后失败时间
  nextAttemptTime: number;         // Next attempt timestamp / 下次尝试时间
  successCount: number;            // Success count in half-open state / 半开状态下的成功次数
}

// Deep Health Check Implementation / 深度健康检查实现
export class DeepHealthCheck {
  private config: HealthCheckConfig;
  private eventEmitter: EventEmitter;

  constructor(config: HealthCheckConfig) {
    this.config = config;
    this.eventEmitter = new EventEmitter();
  }

  // Perform deep health check / 执行深度健康检查
  async performDeepCheck(serviceId: string, baseUrl: string): Promise<ServiceHealth> {
    const startTime = performance.now();
    const health: ServiceHealth = {
      serviceId,
      status: 'unknown',
      lastCheck: Date.now(),
      responseTime: 0,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      errorRate: 0,
      uptime: 0,
      metadata: {}
    };

    try {
      // Basic connectivity check / 基本连通性检查
      const basicCheck = await this.performBasicCheck(baseUrl);
      
      // Deep endpoint checks / 深度端点检查
      const endpointChecks = await this.performEndpointChecks(baseUrl);
      
      // Dependency checks / 依赖检查
      const dependencyChecks = await this.performDependencyChecks(baseUrl);
      
      // Performance metrics check / 性能指标检查
      const performanceMetrics = await this.performPerformanceCheck(baseUrl);

      // Calculate overall health / 计算整体健康状态
      health.responseTime = performance.now() - startTime;
      health.status = this.calculateOverallHealth(basicCheck, endpointChecks, dependencyChecks, performanceMetrics);
      health.metadata.dependencies = dependencyChecks;
      health.metadata.performance = performanceMetrics;

      // Emit health check event / 发出健康检查事件
      this.eventEmitter.emit('deep_check_completed', { serviceId, health });

      return health;
    } catch (error) {
      health.status = 'unhealthy';
      health.responseTime = performance.now() - startTime;
      
      console.error(`Deep health check failed for ${serviceId}:`, error);
      this.eventEmitter.emit('deep_check_failed', { serviceId, error });
      
      return health;
    }
  }

  private async performBasicCheck(baseUrl: string): Promise<boolean> {
    try {
      // Simulate basic connectivity check / 模拟基本连通性检查
      const response = await this.makeRequest(`${baseUrl}/health`);
      return response.status === 'ok';
    } catch (error) {
      return false;
    }
  }

  private async performEndpointChecks(baseUrl: string): Promise<boolean[]> {
    const results: boolean[] = [];
    
    for (const endpoint of this.config.deep_check.endpoints) {
      try {
        const response = await this.makeRequest(`${baseUrl}${endpoint}`);
        results.push(response !== null);
      } catch (error) {
        results.push(false);
      }
    }
    
    return results;
  }

  private async performDependencyChecks(baseUrl: string): Promise<DependencyHealth[]> {
    const dependencies: DependencyHealth[] = [];
    
    try {
      // Check database dependency / 检查数据库依赖
      const dbHealth = await this.checkDatabaseHealth(baseUrl);
      dependencies.push(dbHealth);
      
      // Check cache dependency / 检查缓存依赖
      const cacheHealth = await this.checkCacheHealth(baseUrl);
      dependencies.push(cacheHealth);
      
      // Check external API dependencies / 检查外部API依赖
      const externalApiHealth = await this.checkExternalApiHealth(baseUrl);
      dependencies.push(externalApiHealth);
      
    } catch (error) {
      console.error('Dependency check failed:', error);
    }
    
    return dependencies;
  }

  private async performPerformanceCheck(baseUrl: string): Promise<PerformanceMetrics> {
    try {
      // Simulate performance metrics collection / 模拟性能指标收集
      const response = await this.makeRequest(`${baseUrl}/metrics`);
      
      return {
        cpu: response?.cpu || Math.random() * 100,
        memory: response?.memory || Math.random() * 100,
        disk: response?.disk || Math.random() * 100,
        network: {
          inbound: response?.network?.inbound || Math.random() * 1000,
          outbound: response?.network?.outbound || Math.random() * 1000
        },
        activeConnections: response?.activeConnections || Math.floor(Math.random() * 100),
        queueSize: response?.queueSize || Math.floor(Math.random() * 50)
      };
    } catch (error) {
      // Return default metrics if check fails / 如果检查失败则返回默认指标
      return {
        cpu: 0,
        memory: 0,
        disk: 0,
        network: { inbound: 0, outbound: 0 },
        activeConnections: 0,
        queueSize: 0
      };
    }
  }

  private async checkDatabaseHealth(baseUrl: string): Promise<DependencyHealth> {
    const startTime = performance.now();
    
    try {
      await this.makeRequest(`${baseUrl}/health/database`);
      
      return {
        name: 'database',
        type: 'database',
        status: 'healthy',
        responseTime: performance.now() - startTime,
        lastCheck: Date.now()
      };
    } catch (error) {
      return {
        name: 'database',
        type: 'database',
        status: 'unhealthy',
        responseTime: performance.now() - startTime,
        lastCheck: Date.now(),
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async checkCacheHealth(baseUrl: string): Promise<DependencyHealth> {
    const startTime = performance.now();
    
    try {
      await this.makeRequest(`${baseUrl}/health/cache`);
      
      return {
        name: 'cache',
        type: 'cache',
        status: 'healthy',
        responseTime: performance.now() - startTime,
        lastCheck: Date.now()
      };
    } catch (error) {
      return {
        name: 'cache',
        type: 'cache',
        status: 'unhealthy',
        responseTime: performance.now() - startTime,
        lastCheck: Date.now(),
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async checkExternalApiHealth(baseUrl: string): Promise<DependencyHealth> {
    const startTime = performance.now();
    
    try {
      await this.makeRequest(`${baseUrl}/health/external`);
      
      return {
        name: 'external_api',
        type: 'external_api',
        status: 'healthy',
        responseTime: performance.now() - startTime,
        lastCheck: Date.now()
      };
    } catch (error) {
      return {
        name: 'external_api',
        type: 'external_api',
        status: 'unhealthy',
        responseTime: performance.now() - startTime,
        lastCheck: Date.now(),
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private calculateOverallHealth(
    basicCheck: boolean,
    endpointChecks: boolean[],
    dependencyChecks: DependencyHealth[],
    performanceMetrics: PerformanceMetrics
  ): 'healthy' | 'unhealthy' | 'degraded' {
    // Basic check must pass / 基本检查必须通过
    if (!basicCheck) {
      return 'unhealthy';
    }

    // Check endpoint health / 检查端点健康状态
    const endpointSuccessRate = endpointChecks.filter(check => check).length / endpointChecks.length;
    
    // Check dependency health / 检查依赖健康状态
    const healthyDependencies = dependencyChecks.filter(dep => dep.status === 'healthy').length;
    const dependencyHealthRate = healthyDependencies / dependencyChecks.length;
    
    // Check performance metrics / 检查性能指标
    const performanceScore = this.calculatePerformanceScore(performanceMetrics);
    
    // Calculate overall score / 计算总体分数
    const overallScore = (endpointSuccessRate * 0.4 + dependencyHealthRate * 0.4 + performanceScore * 0.2);
    
    if (overallScore >= 0.8) {
      return 'healthy';
    } else if (overallScore >= 0.5) {
      return 'degraded';
    } else {
      return 'unhealthy';
    }
  }

  private calculatePerformanceScore(metrics: PerformanceMetrics): number {
    // Calculate performance score based on thresholds / 基于阈值计算性能分数
    const cpuScore = Math.max(0, 1 - metrics.cpu / 100);
    const memoryScore = Math.max(0, 1 - metrics.memory / 100);
    const diskScore = Math.max(0, 1 - metrics.disk / 100);
    
    return (cpuScore + memoryScore + diskScore) / 3;
  }

  private async makeRequest(url: string): Promise<any> {
    // Mock HTTP request implementation / 模拟HTTP请求实现
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.1) { // 90% success rate / 90%成功率
          resolve({
            status: 'ok',
            timestamp: Date.now(),
            cpu: Math.random() * 100,
            memory: Math.random() * 100,
            disk: Math.random() * 100,
            network: {
              inbound: Math.random() * 1000,
              outbound: Math.random() * 1000
            },
            activeConnections: Math.floor(Math.random() * 100),
            queueSize: Math.floor(Math.random() * 50)
          });
        } else {
          reject(new Error('Simulated request failure'));
        }
      }, Math.random() * 100 + 50); // Random delay 50-150ms / 随机延迟50-150毫秒
    });
  }

  // Subscribe to events / 订阅事件
  on(event: string, callback: (data: any) => void): void {
    this.eventEmitter.on(event, callback);
  }
}

// Service Dependency Checker / 服务依赖检查器
export class DependencyChecker {
  private dependencies: Map<string, DependencyHealth> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private eventEmitter: EventEmitter;

  constructor() {
    this.eventEmitter = new EventEmitter();
  }

  // Add dependency to monitor / 添加要监控的依赖
  addDependency(name: string, type: DependencyHealth['type'], checkUrl: string): void {
    const dependency: DependencyHealth = {
      name,
      type,
      status: 'healthy',
      responseTime: 0,
      lastCheck: 0
    };

    this.dependencies.set(name, dependency);
    console.log(`Dependency Checker: Added dependency ${name} (${type})`);
  }

  // Remove dependency / 移除依赖
  removeDependency(name: string): void {
    this.dependencies.delete(name);
    console.log(`Dependency Checker: Removed dependency ${name}`);
  }

  // Start monitoring dependencies / 开始监控依赖
  startMonitoring(interval: number = 30000): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(async () => {
      await this.checkAllDependencies();
    }, interval);

    console.log(`Dependency Checker: Started monitoring with ${interval}ms interval`);
  }

  // Stop monitoring dependencies / 停止监控依赖
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    console.log('Dependency Checker: Stopped monitoring');
  }

  // Check all dependencies / 检查所有依赖
  async checkAllDependencies(): Promise<Map<string, DependencyHealth>> {
    const results = new Map<string, DependencyHealth>();

    for (const [name, dependency] of this.dependencies.entries()) {
      try {
        const updatedDependency = await this.checkSingleDependency(dependency);
        this.dependencies.set(name, updatedDependency);
        results.set(name, updatedDependency);

        // Emit dependency status change event / 发出依赖状态变更事件
        if (updatedDependency.status !== dependency.status) {
          this.eventEmitter.emit('dependency_status_changed', {
            name,
            oldStatus: dependency.status,
            newStatus: updatedDependency.status,
            dependency: updatedDependency
          });
        }
      } catch (error) {
        console.error(`Failed to check dependency ${name}:`, error);
      }
    }

    return results;
  }

  private async checkSingleDependency(dependency: DependencyHealth): Promise<DependencyHealth> {
    const startTime = performance.now();
    
    try {
      // Simulate dependency check based on type / 根据类型模拟依赖检查
      const isHealthy = await this.simulateDependencyCheck(dependency.type);
      
      return {
        ...dependency,
        status: isHealthy ? 'healthy' : 'unhealthy',
        responseTime: performance.now() - startTime,
        lastCheck: Date.now(),
        errorMessage: isHealthy ? undefined : 'Simulated dependency failure'
      };
    } catch (error) {
      return {
        ...dependency,
        status: 'unhealthy',
        responseTime: performance.now() - startTime,
        lastCheck: Date.now(),
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async simulateDependencyCheck(type: DependencyHealth['type']): Promise<boolean> {
    // Simulate different failure rates for different dependency types / 为不同依赖类型模拟不同的失败率
    const failureRates = {
      database: 0.05,      // 5% failure rate / 5%失败率
      cache: 0.02,         // 2% failure rate / 2%失败率
      external_api: 0.15,  // 15% failure rate / 15%失败率
      message_queue: 0.08, // 8% failure rate / 8%失败率
      file_system: 0.03    // 3% failure rate / 3%失败率
    };

    const failureRate = failureRates[type] || 0.1;
    
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(Math.random() > failureRate);
      }, Math.random() * 100 + 50); // Random delay 50-150ms / 随机延迟50-150毫秒
    });
  }

  // Get dependency status / 获取依赖状态
  getDependencyStatus(name: string): DependencyHealth | null {
    return this.dependencies.get(name) || null;
  }

  // Get all dependencies status / 获取所有依赖状态
  getAllDependencies(): Map<string, DependencyHealth> {
    return new Map(this.dependencies);
  }

  // Subscribe to events / 订阅事件
  on(event: string, callback: (data: any) => void): void {
    this.eventEmitter.on(event, callback);
  }
}

// Performance Monitor / 性能监控器
export class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetrics> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private eventEmitter: EventEmitter;
  private thresholds: {
    cpu: number;
    memory: number;
    disk: number;
    responseTime: number;
  };

  constructor(thresholds = { cpu: 80, memory: 85, disk: 90, responseTime: 1000 }) {
    this.eventEmitter = new EventEmitter();
    this.thresholds = thresholds;
  }

  // Start performance monitoring / 开始性能监控
  startMonitoring(services: string[], interval: number = 10000): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(async () => {
      for (const serviceId of services) {
        await this.collectMetrics(serviceId);
      }
    }, interval);

    console.log(`Performance Monitor: Started monitoring ${services.length} services`);
  }

  // Stop performance monitoring / 停止性能监控
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.log('Performance Monitor: Stopped monitoring');
  }

  // Collect performance metrics / 收集性能指标
  async collectMetrics(serviceId: string): Promise<PerformanceMetrics> {
    try {
      // Simulate metrics collection / 模拟指标收集
      const metrics: PerformanceMetrics = {
        cpu: Math.random() * 100,
        memory: Math.random() * 100,
        disk: Math.random() * 100,
        network: {
          inbound: Math.random() * 1000,
          outbound: Math.random() * 1000
        },
        activeConnections: Math.floor(Math.random() * 100),
        queueSize: Math.floor(Math.random() * 50)
      };

      this.metrics.set(serviceId, metrics);

      // Check thresholds and emit alerts / 检查阈值并发出警报
      this.checkThresholds(serviceId, metrics);

      return metrics;
    } catch (error) {
      console.error(`Failed to collect metrics for ${serviceId}:`, error);
      throw error;
    }
  }

  private checkThresholds(serviceId: string, metrics: PerformanceMetrics): void {
    const alerts: string[] = [];

    if (metrics.cpu > this.thresholds.cpu) {
      alerts.push(`High CPU usage: ${metrics.cpu.toFixed(1)}%`);
    }

    if (metrics.memory > this.thresholds.memory) {
      alerts.push(`High memory usage: ${metrics.memory.toFixed(1)}%`);
    }

    if (metrics.disk > this.thresholds.disk) {
      alerts.push(`High disk usage: ${metrics.disk.toFixed(1)}%`);
    }

    if (alerts.length > 0) {
      this.eventEmitter.emit('performance_alert', {
        serviceId,
        alerts,
        metrics,
        timestamp: Date.now()
      });
    }
  }

  // Get performance metrics / 获取性能指标
  getMetrics(serviceId: string): PerformanceMetrics | null {
    return this.metrics.get(serviceId) || null;
  }

  // Get all metrics / 获取所有指标
  getAllMetrics(): Map<string, PerformanceMetrics> {
    return new Map(this.metrics);
  }

  // Subscribe to events / 订阅事件
  on(event: string, callback: (data: any) => void): void {
    this.eventEmitter.on(event, callback);
  }
}

// Auto Failover Manager / 自动故障转移管理器
export class AutoFailover {
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private eventEmitter: EventEmitter;
  private config: {
    failureThreshold: number;      // Failures to open circuit / 打开熔断器的失败次数
    recoveryTimeout: number;       // Time to wait before retry / 重试前等待时间
    successThreshold: number;      // Successes to close circuit / 关闭熔断器的成功次数
  };

  constructor(config = { failureThreshold: 5, recoveryTimeout: 30000, successThreshold: 3 }) {
    this.eventEmitter = new EventEmitter();
    this.config = config;
  }

  // Initialize circuit breaker for service / 为服务初始化熔断器
  initializeCircuitBreaker(serviceId: string): void {
    const circuitBreaker: CircuitBreakerState = {
      serviceId,
      state: 'closed',
      failureCount: 0,
      lastFailureTime: 0,
      nextAttemptTime: 0,
      successCount: 0
    };

    this.circuitBreakers.set(serviceId, circuitBreaker);
    console.log(`Auto Failover: Initialized circuit breaker for ${serviceId}`);
  }

  // Record request result / 记录请求结果
  recordResult(serviceId: string, success: boolean): boolean {
    let circuitBreaker = this.circuitBreakers.get(serviceId);
    
    if (!circuitBreaker) {
      this.initializeCircuitBreaker(serviceId);
      circuitBreaker = this.circuitBreakers.get(serviceId)!;
    }

    const now = Date.now();

    if (success) {
      return this.handleSuccess(circuitBreaker, now);
    } else {
      return this.handleFailure(circuitBreaker, now);
    }
  }

  // Check if request should be allowed / 检查是否应该允许请求
  shouldAllowRequest(serviceId: string): boolean {
    const circuitBreaker = this.circuitBreakers.get(serviceId);
    
    if (!circuitBreaker) {
      return true; // Allow if no circuit breaker exists / 如果没有熔断器则允许
    }

    const now = Date.now();

    switch (circuitBreaker.state) {
      case 'closed':
        return true;
      
      case 'open':
        if (now >= circuitBreaker.nextAttemptTime) {
          // Transition to half-open / 转换到半开状态
          circuitBreaker.state = 'half_open';
          circuitBreaker.successCount = 0;
          this.circuitBreakers.set(serviceId, circuitBreaker);
          
          this.eventEmitter.emit('circuit_breaker_half_open', { serviceId, circuitBreaker });
          return true;
        }
        return false;
      
      case 'half_open':
        return true;
      
      default:
        return true;
    }
  }

  private handleSuccess(circuitBreaker: CircuitBreakerState, now: number): boolean {
    switch (circuitBreaker.state) {
      case 'closed':
        // Reset failure count on success / 成功时重置失败计数
        circuitBreaker.failureCount = 0;
        break;
      
      case 'half_open':
        circuitBreaker.successCount++;
        
        if (circuitBreaker.successCount >= this.config.successThreshold) {
          // Close circuit breaker / 关闭熔断器
          circuitBreaker.state = 'closed';
          circuitBreaker.failureCount = 0;
          circuitBreaker.successCount = 0;
          
          this.eventEmitter.emit('circuit_breaker_closed', { 
            serviceId: circuitBreaker.serviceId, 
            circuitBreaker 
          });
          
          console.log(`Auto Failover: Circuit breaker closed for ${circuitBreaker.serviceId}`);
        }
        break;
    }

    this.circuitBreakers.set(circuitBreaker.serviceId, circuitBreaker);
    return true;
  }

  private handleFailure(circuitBreaker: CircuitBreakerState, now: number): boolean {
    circuitBreaker.failureCount++;
    circuitBreaker.lastFailureTime = now;

    switch (circuitBreaker.state) {
      case 'closed':
        if (circuitBreaker.failureCount >= this.config.failureThreshold) {
          // Open circuit breaker / 打开熔断器
          circuitBreaker.state = 'open';
          circuitBreaker.nextAttemptTime = now + this.config.recoveryTimeout;
          
          this.eventEmitter.emit('circuit_breaker_opened', { 
            serviceId: circuitBreaker.serviceId, 
            circuitBreaker 
          });
          
          console.log(`Auto Failover: Circuit breaker opened for ${circuitBreaker.serviceId}`);
        }
        break;
      
      case 'half_open':
        // Return to open state / 返回打开状态
        circuitBreaker.state = 'open';
        circuitBreaker.nextAttemptTime = now + this.config.recoveryTimeout;
        circuitBreaker.successCount = 0;
        
        this.eventEmitter.emit('circuit_breaker_opened', { 
          serviceId: circuitBreaker.serviceId, 
          circuitBreaker 
        });
        
        console.log(`Auto Failover: Circuit breaker reopened for ${circuitBreaker.serviceId}`);
        break;
    }

    this.circuitBreakers.set(circuitBreaker.serviceId, circuitBreaker);
    return false;
  }

  // Get circuit breaker state / 获取熔断器状态
  getCircuitBreakerState(serviceId: string): CircuitBreakerState | null {
    return this.circuitBreakers.get(serviceId) || null;
  }

  // Get all circuit breaker states / 获取所有熔断器状态
  getAllCircuitBreakers(): Map<string, CircuitBreakerState> {
    return new Map(this.circuitBreakers);
  }

  // Get statistics / 获取统计信息
  getStats(): any {
    const states = Array.from(this.circuitBreakers.values());
    
    return {
      totalCircuitBreakers: states.length,
      closedCount: states.filter(cb => cb.state === 'closed').length,
      openCount: states.filter(cb => cb.state === 'open').length,
      halfOpenCount: states.filter(cb => cb.state === 'half_open').length,
      circuitBreakers: states
    };
  }

  // Subscribe to events / 订阅事件
  on(event: string, callback: (data: any) => void): void {
    this.eventEmitter.on(event, callback);
  }
}

// Enhanced Health Checker Main Class / 增强健康检查器主类
export class EnhancedHealthChecker {
  private config: HealthCheckConfig;
  private services: Map<string, ServiceHealth> = new Map();
  private deepHealthCheck: DeepHealthCheck;
  private dependencyChecker: DependencyChecker;
  private performanceMonitor: PerformanceMonitor;
  private autoFailover: AutoFailover;
  private eventEmitter: EventEmitter;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(config: HealthCheckConfig) {
    this.config = config;
    this.deepHealthCheck = new DeepHealthCheck(config);
    this.dependencyChecker = new DependencyChecker();
    this.performanceMonitor = new PerformanceMonitor();
    this.autoFailover = new AutoFailover();
    this.eventEmitter = new EventEmitter();

    this.setupEventHandlers();
  }

  // Start health checking / 开始健康检查
  start(): void {
    if (!this.config.enabled) {
      console.log('Enhanced Health Checker: Disabled by configuration');
      return;
    }

    // Start regular health checks / 开始常规健康检查
    this.startRegularChecks();
    
    // Start dependency monitoring / 开始依赖监控
    this.dependencyChecker.startMonitoring();
    
    // Start performance monitoring / 开始性能监控
    const serviceIds = Array.from(this.services.keys());
    this.performanceMonitor.startMonitoring(serviceIds);

    console.log('Enhanced Health Checker: Started all monitoring systems');
  }

  // Stop health checking / 停止健康检查
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    this.dependencyChecker.stopMonitoring();
    this.performanceMonitor.stopMonitoring();

    console.log('Enhanced Health Checker: Stopped all monitoring systems');
  }

  // Add service to monitor / 添加要监控的服务
  addService(serviceId: string, baseUrl: string): void {
    const health: ServiceHealth = {
      serviceId,
      status: 'unknown',
      lastCheck: 0,
      responseTime: 0,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      errorRate: 0,
      uptime: 0,
      metadata: {}
    };

    this.services.set(serviceId, health);
    this.autoFailover.initializeCircuitBreaker(serviceId);

    console.log(`Enhanced Health Checker: Added service ${serviceId}`);
  }

  // Remove service from monitoring / 从监控中移除服务
  removeService(serviceId: string): void {
    this.services.delete(serviceId);
    console.log(`Enhanced Health Checker: Removed service ${serviceId}`);
  }

  // Perform health check for service / 为服务执行健康检查
  async checkService(serviceId: string): Promise<ServiceHealth> {
    const service = this.services.get(serviceId);
    if (!service) {
      throw new Error(`Service ${serviceId} not found`);
    }

    // Check if circuit breaker allows request / 检查熔断器是否允许请求
    if (!this.autoFailover.shouldAllowRequest(serviceId)) {
      service.status = 'unhealthy';
      service.lastCheck = Date.now();
      return service;
    }

    try {
      // Perform deep health check / 执行深度健康检查
      const baseUrl = `http://localhost:3000`; // Mock base URL / 模拟基础URL
      const healthResult = await this.deepHealthCheck.performDeepCheck(serviceId, baseUrl);
      
      // Update service health / 更新服务健康状态
      const updatedHealth = this.updateServiceHealth(service, healthResult, true);
      
      // Record result in circuit breaker / 在熔断器中记录结果
      this.autoFailover.recordResult(serviceId, healthResult.status === 'healthy');
      
      this.services.set(serviceId, updatedHealth);
      
      // Emit health check event / 发出健康检查事件
      this.eventEmitter.emit('service_health_updated', { serviceId, health: updatedHealth });
      
      return updatedHealth;
    } catch (error) {
      // Handle check failure / 处理检查失败
      const updatedHealth = this.updateServiceHealth(service, null, false);
      
      // Record failure in circuit breaker / 在熔断器中记录失败
      this.autoFailover.recordResult(serviceId, false);
      
      this.services.set(serviceId, updatedHealth);
      
      console.error(`Health check failed for ${serviceId}:`, error);
      this.eventEmitter.emit('service_health_check_failed', { serviceId, error });
      
      return updatedHealth;
    }
  }

  private updateServiceHealth(
    currentHealth: ServiceHealth, 
    checkResult: ServiceHealth | null, 
    success: boolean
  ): ServiceHealth {
    const updatedHealth = { ...currentHealth };
    updatedHealth.lastCheck = Date.now();

    if (success && checkResult) {
      updatedHealth.status = checkResult.status;
      updatedHealth.responseTime = checkResult.responseTime;
      updatedHealth.consecutiveFailures = 0;
      updatedHealth.consecutiveSuccesses++;
      updatedHealth.metadata = checkResult.metadata;
    } else {
      updatedHealth.status = 'unhealthy';
      updatedHealth.consecutiveFailures++;
      updatedHealth.consecutiveSuccesses = 0;
    }

    // Calculate uptime / 计算正常运行时间
    const totalChecks = updatedHealth.consecutiveFailures + updatedHealth.consecutiveSuccesses;
    if (totalChecks > 0) {
      updatedHealth.uptime = (updatedHealth.consecutiveSuccesses / totalChecks) * 100;
    }

    return updatedHealth;
  }

  private startRegularChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(async () => {
      const serviceIds = Array.from(this.services.keys());
      
      for (const serviceId of serviceIds) {
        try {
          await this.checkService(serviceId);
        } catch (error) {
          console.error(`Regular health check failed for ${serviceId}:`, error);
        }
      }
    }, this.config.interval);
  }

  private setupEventHandlers(): void {
    // Handle dependency status changes / 处理依赖状态变更
    this.dependencyChecker.on('dependency_status_changed', (data) => {
      this.eventEmitter.emit('dependency_status_changed', data);
    });

    // Handle performance alerts / 处理性能警报
    this.performanceMonitor.on('performance_alert', (data) => {
      this.eventEmitter.emit('performance_alert', data);
    });

    // Handle circuit breaker events / 处理熔断器事件
    this.autoFailover.on('circuit_breaker_opened', (data) => {
      this.eventEmitter.emit('circuit_breaker_opened', data);
    });

    this.autoFailover.on('circuit_breaker_closed', (data) => {
      this.eventEmitter.emit('circuit_breaker_closed', data);
    });
  }

  // Get service health / 获取服务健康状态
  getServiceHealth(serviceId: string): ServiceHealth | null {
    return this.services.get(serviceId) || null;
  }

  // Get all services health / 获取所有服务健康状态
  getAllServicesHealth(): Map<string, ServiceHealth> {
    return new Map(this.services);
  }

  // Get comprehensive health report / 获取综合健康报告
  getHealthReport(): any {
    const services = Array.from(this.services.values());
    const dependencies = this.dependencyChecker.getAllDependencies();
    const circuitBreakers = this.autoFailover.getAllCircuitBreakers();

    return {
      timestamp: Date.now(),
      overall: {
        totalServices: services.length,
        healthyServices: services.filter(s => s.status === 'healthy').length,
        unhealthyServices: services.filter(s => s.status === 'unhealthy').length,
        degradedServices: services.filter(s => s.status === 'degraded').length
      },
      services: services,
      dependencies: Array.from(dependencies.values()),
      circuitBreakers: Array.from(circuitBreakers.values()),
      performanceMetrics: this.performanceMonitor.getAllMetrics()
    };
  }

  // Subscribe to events / 订阅事件
  on(event: string, callback: (data: any) => void): void {
    this.eventEmitter.on(event, callback);
  }
}

// Factory function to create enhanced health checker / 创建增强健康检查器的工厂函数
export function createEnhancedHealthChecker(config: Partial<HealthCheckConfig> = {}): EnhancedHealthChecker {
  const defaultConfig: HealthCheckConfig = {
    enabled: true,
    interval: 30000,
    timeout: 5000,
    retries: 3,
    threshold: {
      consecutive_failures: 3,
      consecutive_successes: 2,
      response_time: 1000,
      error_rate: 0.1
    },
    deep_check: {
      enabled: true,
      interval: 60000,
      endpoints: ['/health', '/metrics', '/status']
    }
  };

  const finalConfig = { ...defaultConfig, ...config };
  return new EnhancedHealthChecker(finalConfig);
}

// Export all components / 导出所有组件
export {
  DeepHealthCheck,
  DependencyChecker,
  PerformanceMonitor,
  AutoFailover
};

export default EnhancedHealthChecker;