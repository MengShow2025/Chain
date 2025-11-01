import { EventEmitter } from 'events';

/**
 * 服务实例接口
 */
export interface ServiceInstance {
  id: string;
  host: string;
  port: number;
  protocol: 'http' | 'https';
  weight: number;
  status: ServiceStatus;
  healthCheckUrl?: string;
  metadata?: ServiceMetadata;
  lastHealthCheck?: number;
  responseTime?: number;
  errorCount?: number;
}

/**
 * 服务状态枚举
 */
export enum ServiceStatus {
  HEALTHY = 'healthy',
  UNHEALTHY = 'unhealthy',
  DRAINING = 'draining',
  UNKNOWN = 'unknown'
}

/**
 * 服务元数据
 */
export interface ServiceMetadata {
  version: string;
  region?: string;
  zone?: string;
  tags?: string[];
  capabilities?: string[];
}

/**
 * 负载均衡策略
 */
export enum LoadBalancingStrategy {
  ROUND_ROBIN = 'round_robin',
  WEIGHTED_ROUND_ROBIN = 'weighted_round_robin',
  LEAST_CONNECTIONS = 'least_connections',
  LEAST_RESPONSE_TIME = 'least_response_time',
  IP_HASH = 'ip_hash',
  RANDOM = 'random'
}

/**
 * 负载均衡配置
 */
export interface LoadBalancerConfig {
  strategy: LoadBalancingStrategy;
  healthCheckInterval: number;
  healthCheckTimeout: number;
  maxRetries: number;
  retryDelay: number;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
}

/**
 * 请求上下文
 */
export interface RequestContext {
  clientIp: string;
  userAgent?: string;
  sessionId?: string;
  headers?: { [key: string]: string };
}

/**
 * 负载均衡结果
 */
export interface LoadBalancingResult {
  instance: ServiceInstance | null;
  error?: string;
  retryAfter?: number;
}

/**
 * 负载均衡器统计信息
 */
export interface LoadBalancerStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  activeConnections: number;
  healthyInstances: number;
  unhealthyInstances: number;
}

/**
 * 负载均衡器类
 */
export class LoadBalancer extends EventEmitter {
  private config: LoadBalancerConfig;
  private instances: Map<string, ServiceInstance>;
  private roundRobinIndex: number;
  private connectionCounts: Map<string, number>;
  private circuitBreakers: Map<string, CircuitBreaker>;
  private stats: LoadBalancerStats;
  private healthCheckInterval: NodeJS.Timeout | null;

  constructor(config: Partial<LoadBalancerConfig> = {}) {
    super();
    
    this.config = {
      strategy: LoadBalancingStrategy.ROUND_ROBIN,
      healthCheckInterval: 30000, // 30秒
      healthCheckTimeout: 5000,   // 5秒
      maxRetries: 3,
      retryDelay: 1000,
      circuitBreakerThreshold: 5,
      circuitBreakerTimeout: 60000, // 1分钟
      ...config
    };
    
    this.instances = new Map();
    this.roundRobinIndex = 0;
    this.connectionCounts = new Map();
    this.circuitBreakers = new Map();
    this.healthCheckInterval = null;
    
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      activeConnections: 0,
      healthyInstances: 0,
      unhealthyInstances: 0
    };
    
    console.log('LoadBalancer initialized with strategy:', this.config.strategy);
    this.startHealthChecks();
  }

  /**
   * 注册服务实例
   */
  registerInstance(instance: ServiceInstance): void {
    this.instances.set(instance.id, {
      ...instance,
      status: ServiceStatus.UNKNOWN,
      lastHealthCheck: 0,
      responseTime: 0,
      errorCount: 0
    });
    
    this.connectionCounts.set(instance.id, 0);
    this.circuitBreakers.set(instance.id, new CircuitBreaker(
      this.config.circuitBreakerThreshold,
      this.config.circuitBreakerTimeout
    ));
    
    console.log(`Service instance registered: ${instance.id} (${instance.host}:${instance.port})`);
    this.emit('instance:registered', instance);
    
    // 立即进行健康检查
    this.performHealthCheck(instance.id);
  }

  /**
   * 注销服务实例
   */
  unregisterInstance(instanceId: string): boolean {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      return false;
    }
    
    this.instances.delete(instanceId);
    this.connectionCounts.delete(instanceId);
    this.circuitBreakers.delete(instanceId);
    
    console.log(`Service instance unregistered: ${instanceId}`);
    this.emit('instance:unregistered', instance);
    
    return true;
  }

  /**
   * 选择服务实例
   */
  selectInstance(context?: RequestContext): LoadBalancingResult {
    this.stats.totalRequests++;
    
    const healthyInstances = this.getHealthyInstances();
    
    if (healthyInstances.length === 0) {
      this.stats.failedRequests++;
      return {
        instance: null,
        error: 'No healthy instances available',
        retryAfter: 30000
      };
    }
    
    let selectedInstance: ServiceInstance | null = null;
    
    try {
      switch (this.config.strategy) {
        case LoadBalancingStrategy.ROUND_ROBIN:
          selectedInstance = this.selectRoundRobin(healthyInstances);
          break;
        case LoadBalancingStrategy.WEIGHTED_ROUND_ROBIN:
          selectedInstance = this.selectWeightedRoundRobin(healthyInstances);
          break;
        case LoadBalancingStrategy.LEAST_CONNECTIONS:
          selectedInstance = this.selectLeastConnections(healthyInstances);
          break;
        case LoadBalancingStrategy.LEAST_RESPONSE_TIME:
          selectedInstance = this.selectLeastResponseTime(healthyInstances);
          break;
        case LoadBalancingStrategy.IP_HASH:
          selectedInstance = this.selectIpHash(healthyInstances, context?.clientIp || '');
          break;
        case LoadBalancingStrategy.RANDOM:
          selectedInstance = this.selectRandom(healthyInstances);
          break;
        default:
          selectedInstance = this.selectRoundRobin(healthyInstances);
      }
      
      if (selectedInstance) {
        // 检查熔断器状态
        const circuitBreaker = this.circuitBreakers.get(selectedInstance.id);
        if (circuitBreaker && circuitBreaker.isOpen()) {
          return {
            instance: null,
            error: 'Circuit breaker is open',
            retryAfter: circuitBreaker.getRetryAfter()
          };
        }
        
        // 增加连接计数
        const currentConnections = this.connectionCounts.get(selectedInstance.id) || 0;
        this.connectionCounts.set(selectedInstance.id, currentConnections + 1);
        this.stats.activeConnections++;
        
        this.stats.successfulRequests++;
        this.emit('instance:selected', selectedInstance);
      }
      
      return { instance: selectedInstance };
      
    } catch (error) {
      this.stats.failedRequests++;
      return {
        instance: null,
        error: error instanceof Error ? error.message : 'Unknown selection error'
      };
    }
  }

  /**
   * 释放连接
   */
  releaseConnection(instanceId: string, responseTime?: number, success: boolean = true): void {
    const currentConnections = this.connectionCounts.get(instanceId) || 0;
    if (currentConnections > 0) {
      this.connectionCounts.set(instanceId, currentConnections - 1);
      this.stats.activeConnections--;
    }
    
    const instance = this.instances.get(instanceId);
    if (instance && responseTime !== undefined) {
      // 更新响应时间（指数移动平均）
      const alpha = 0.1;
      instance.responseTime = instance.responseTime! * (1 - alpha) + responseTime * alpha;
      
      // 更新平均响应时间统计
      this.updateAverageResponseTime(responseTime);
    }
    
    // 更新熔断器状态
    const circuitBreaker = this.circuitBreakers.get(instanceId);
    if (circuitBreaker) {
      if (success) {
        circuitBreaker.recordSuccess();
      } else {
        circuitBreaker.recordFailure();
        if (instance) {
          instance.errorCount = (instance.errorCount || 0) + 1;
        }
      }
    }
    
    this.emit('connection:released', { instanceId, responseTime, success });
  }

  /**
   * 轮询策略
   */
  private selectRoundRobin(instances: ServiceInstance[]): ServiceInstance {
    const instance = instances[this.roundRobinIndex % instances.length];
    this.roundRobinIndex = (this.roundRobinIndex + 1) % instances.length;
    return instance;
  }

  /**
   * 加权轮询策略
   */
  private selectWeightedRoundRobin(instances: ServiceInstance[]): ServiceInstance {
    const totalWeight = instances.reduce((sum, instance) => sum + instance.weight, 0);
    let randomWeight = Math.random() * totalWeight;
    
    for (const instance of instances) {
      randomWeight -= instance.weight;
      if (randomWeight <= 0) {
        return instance;
      }
    }
    
    return instances[0]; // 回退到第一个实例
  }

  /**
   * 最少连接策略
   */
  private selectLeastConnections(instances: ServiceInstance[]): ServiceInstance {
    let minConnections = Infinity;
    let selectedInstance = instances[0];
    
    for (const instance of instances) {
      const connections = this.connectionCounts.get(instance.id) || 0;
      if (connections < minConnections) {
        minConnections = connections;
        selectedInstance = instance;
      }
    }
    
    return selectedInstance;
  }

  /**
   * 最短响应时间策略
   */
  private selectLeastResponseTime(instances: ServiceInstance[]): ServiceInstance {
    let minResponseTime = Infinity;
    let selectedInstance = instances[0];
    
    for (const instance of instances) {
      const responseTime = instance.responseTime || 0;
      if (responseTime < minResponseTime) {
        minResponseTime = responseTime;
        selectedInstance = instance;
      }
    }
    
    return selectedInstance;
  }

  /**
   * IP哈希策略
   */
  private selectIpHash(instances: ServiceInstance[], clientIp: string): ServiceInstance {
    const hash = this.hashString(clientIp);
    const index = hash % instances.length;
    return instances[index];
  }

  /**
   * 随机策略
   */
  private selectRandom(instances: ServiceInstance[]): ServiceInstance {
    const index = Math.floor(Math.random() * instances.length);
    return instances[index];
  }

  /**
   * 获取健康的实例
   */
  private getHealthyInstances(): ServiceInstance[] {
    const healthy: ServiceInstance[] = [];
    const unhealthy: ServiceInstance[] = [];
    
    for (const instance of this.instances.values()) {
      if (instance.status === ServiceStatus.HEALTHY) {
        healthy.push(instance);
      } else {
        unhealthy.push(instance);
      }
    }
    
    this.stats.healthyInstances = healthy.length;
    this.stats.unhealthyInstances = unhealthy.length;
    
    return healthy;
  }

  /**
   * 开始健康检查
   */
  private startHealthChecks(): void {
    if (this.healthCheckInterval) {
      return;
    }
    
    this.healthCheckInterval = setInterval(() => {
      this.performAllHealthChecks();
    }, this.config.healthCheckInterval);
    
    console.log('Health checks started');
  }

  /**
   * 停止健康检查
   */
  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      console.log('Health checks stopped');
    }
  }

  /**
   * 执行所有健康检查
   */
  private async performAllHealthChecks(): Promise<void> {
    const checkPromises: Promise<void>[] = [];
    
    for (const instanceId of this.instances.keys()) {
      checkPromises.push(this.performHealthCheck(instanceId));
    }
    
    await Promise.allSettled(checkPromises);
  }

  /**
   * 执行单个实例的健康检查
   */
  private async performHealthCheck(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      return;
    }
    
    const startTime = Date.now();
    
    try {
      // 模拟健康检查请求
      const isHealthy = await this.checkInstanceHealth(instance);
      const responseTime = Date.now() - startTime;
      
      const previousStatus = instance.status;
      instance.status = isHealthy ? ServiceStatus.HEALTHY : ServiceStatus.UNHEALTHY;
      instance.lastHealthCheck = Date.now();
      instance.responseTime = responseTime;
      
      if (previousStatus !== instance.status) {
        console.log(`Instance ${instanceId} status changed: ${previousStatus} -> ${instance.status}`);
        this.emit('instance:status_changed', { instance, previousStatus });
      }
      
    } catch (error) {
      const previousStatus = instance.status;
      instance.status = ServiceStatus.UNHEALTHY;
      instance.lastHealthCheck = Date.now();
      instance.errorCount = (instance.errorCount || 0) + 1;
      
      if (previousStatus !== instance.status) {
        console.log(`Instance ${instanceId} health check failed:`, error);
        this.emit('instance:status_changed', { instance, previousStatus });
      }
    }
  }

  /**
   * 检查实例健康状态
   */
  private async checkInstanceHealth(instance: ServiceInstance): Promise<boolean> {
    // 模拟健康检查逻辑
    return new Promise((resolve) => {
      setTimeout(() => {
        // 90% 的概率返回健康状态
        resolve(Math.random() > 0.1);
      }, Math.random() * 100 + 50); // 50-150ms 响应时间
    });
  }

  /**
   * 字符串哈希函数
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash);
  }

  /**
   * 更新平均响应时间
   */
  private updateAverageResponseTime(responseTime: number): void {
    const alpha = 0.1;
    this.stats.averageResponseTime = this.stats.averageResponseTime * (1 - alpha) + responseTime * alpha;
  }

  /**
   * 获取统计信息
   */
  getStats(): LoadBalancerStats {
    return { ...this.stats };
  }

  /**
   * 获取所有实例状态
   */
  getInstancesStatus(): ServiceInstance[] {
    return Array.from(this.instances.values());
  }

  /**
   * 获取实例详情
   */
  getInstanceDetails(instanceId: string): ServiceInstance | null {
    return this.instances.get(instanceId) || null;
  }

  /**
   * 设置实例权重
   */
  setInstanceWeight(instanceId: string, weight: number): boolean {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      return false;
    }
    
    instance.weight = weight;
    console.log(`Instance ${instanceId} weight updated to ${weight}`);
    this.emit('instance:weight_changed', { instanceId, weight });
    
    return true;
  }

  /**
   * 排空实例（停止发送新请求）
   */
  drainInstance(instanceId: string): boolean {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      return false;
    }
    
    instance.status = ServiceStatus.DRAINING;
    console.log(`Instance ${instanceId} is being drained`);
    this.emit('instance:draining', instance);
    
    return true;
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    this.stopHealthChecks();
    this.instances.clear();
    this.connectionCounts.clear();
    this.circuitBreakers.clear();
    this.removeAllListeners();
    
    console.log('LoadBalancer cleaned up');
  }
}

/**
 * 熔断器类
 */
class CircuitBreaker {
  private failureThreshold: number;
  private timeout: number;
  private failureCount: number;
  private lastFailureTime: number;
  private state: 'closed' | 'open' | 'half-open';

  constructor(failureThreshold: number, timeout: number) {
    this.failureThreshold = failureThreshold;
    this.timeout = timeout;
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.state = 'closed';
  }

  /**
   * 记录成功
   */
  recordSuccess(): void {
    this.failureCount = 0;
    this.state = 'closed';
  }

  /**
   * 记录失败
   */
  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
    }
  }

  /**
   * 检查熔断器是否开启
   */
  isOpen(): boolean {
    if (this.state === 'closed') {
      return false;
    }
    
    if (this.state === 'open') {
      // 检查是否可以进入半开状态
      if (Date.now() - this.lastFailureTime >= this.timeout) {
        this.state = 'half-open';
        return false;
      }
      return true;
    }
    
    // half-open 状态允许一个请求通过
    return false;
  }

  /**
   * 获取重试时间
   */
  getRetryAfter(): number {
    if (this.state === 'open') {
      return this.timeout - (Date.now() - this.lastFailureTime);
    }
    return 0;
  }

  /**
   * 获取状态
   */
  getState(): string {
    return this.state;
  }
}