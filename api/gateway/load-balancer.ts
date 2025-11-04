// Load Balancer implementation for service distribution / 服务分发的负载均衡器实现
import { EventEmitter } from 'events';

// Service instance interface / 服务实例接口
export interface ServiceInstance {
  id: string;
  host: string;
  port: number;
  protocol: 'http' | 'https';
  weight: number;
  status: ServiceStatus;
  metadata: ServiceMetadata;
  healthScore: number;
  lastHealthCheck: number;
  connections: number;
  responseTime: number;
}

// Service status enum / 服务状态枚举
export enum ServiceStatus {
  HEALTHY = 'healthy',
  UNHEALTHY = 'unhealthy',
  DRAINING = 'draining',
  UNKNOWN = 'unknown'
}

// Service metadata interface / 服务元数据接口
export interface ServiceMetadata {
  version: string;
  region: string;
  zone: string;
  tags: string[];
  capabilities: string[];
}

// Load balancing strategies / 负载均衡策略
export enum LoadBalanceStrategy {
  ROUND_ROBIN = 'round_robin',
  WEIGHTED_ROUND_ROBIN = 'weighted_round_robin',
  LEAST_CONNECTIONS = 'least_connections',
  WEIGHTED_LEAST_CONNECTIONS = 'weighted_least_connections',
  RANDOM = 'random',
  WEIGHTED_RANDOM = 'weighted_random',
  IP_HASH = 'ip_hash',
  LEAST_RESPONSE_TIME = 'least_response_time',
  HEALTH_BASED = 'health_based'
}

// Load balancer configuration / 负载均衡器配置
export interface LoadBalancerConfig {
  strategy: LoadBalanceStrategy;
  healthCheckInterval: number;
  maxRetries: number;
  retryDelay: number;
  sessionAffinity: boolean;
  stickySessionTtl: number;
  circuitBreakerEnabled: boolean;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
}

// Request context for load balancing / 负载均衡的请求上下文
export interface RequestContext {
  clientIp: string;
  sessionId?: string;
  headers: Record<string, string>;
  path: string;
  method: string;
  timestamp: number;
}

// Load balancer statistics / 负载均衡器统计
export interface LoadBalancerStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  activeConnections: number;
  instanceStats: Map<string, InstanceStats>;
}

// Instance statistics / 实例统计
export interface InstanceStats {
  requests: number;
  successes: number;
  failures: number;
  averageResponseTime: number;
  connections: number;
  lastUsed: number;
}

// Circuit breaker state / 断路器状态
export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

// Circuit breaker for instance / 实例断路器
interface CircuitBreaker {
  state: CircuitState;
  failures: number;
  lastFailureTime: number;
  nextAttemptTime: number;
}

// Main Load Balancer class / 主要负载均衡器类
export class LoadBalancer extends EventEmitter {
  private instances: Map<string, ServiceInstance> = new Map();
  private config: LoadBalancerConfig;
  private stats: LoadBalancerStats;
  private roundRobinIndex = 0;
  private stickySessions: Map<string, string> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private healthCheckTimer?: NodeJS.Timeout;

  constructor(config: LoadBalancerConfig) {
    super();
    this.config = { ...config };
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      activeConnections: 0,
      instanceStats: new Map()
    };

    this.startHealthChecks();
  }

  // Add service instance / 添加服务实例
  addInstance(instance: ServiceInstance): void {
    this.instances.set(instance.id, { ...instance });
    
    // Initialize instance stats / 初始化实例统计
    this.stats.instanceStats.set(instance.id, {
      requests: 0,
      successes: 0,
      failures: 0,
      averageResponseTime: 0,
      connections: 0,
      lastUsed: 0
    });

    // Initialize circuit breaker / 初始化断路器
    if (this.config.circuitBreakerEnabled) {
      this.circuitBreakers.set(instance.id, {
        state: CircuitState.CLOSED,
        failures: 0,
        lastFailureTime: 0,
        nextAttemptTime: 0
      });
    }

    console.log(`Load balancer: Instance added ${instance.id} (${instance.host}:${instance.port})`);
    this.emit('instance_added', instance);
  }

  // Remove service instance / 移除服务实例
  removeInstance(instanceId: string): void {
    const instance = this.instances.get(instanceId);
    if (instance) {
      this.instances.delete(instanceId);
      this.stats.instanceStats.delete(instanceId);
      this.circuitBreakers.delete(instanceId);
      
      // Remove sticky sessions for this instance / 移除此实例的粘性会话
        const sessionsToDelete: string[] = [];
        this.stickySessions.forEach((id, sessionId) => {
          if (id === instanceId) {
            sessionsToDelete.push(sessionId);
          }
        });
        sessionsToDelete.forEach(sessionId => this.stickySessions.delete(sessionId));

      console.log(`Load balancer: Instance removed ${instanceId}`);
      this.emit('instance_removed', instance);
    }
  }

  // Update instance status / 更新实例状态
  updateInstanceStatus(instanceId: string, status: ServiceStatus, healthScore?: number): void {
    const instance = this.instances.get(instanceId);
    if (instance) {
      instance.status = status;
      if (healthScore !== undefined) {
        instance.healthScore = healthScore;
      }
      instance.lastHealthCheck = Date.now();

      console.log(`Load balancer: Instance ${instanceId} status updated to ${status}`);
      this.emit('instance_status_changed', { instanceId, status, healthScore });
    }
  }

  // Get next instance for request / 获取请求的下一个实例
  getNextInstance(context: RequestContext): ServiceInstance | null {
    const availableInstances = this.getAvailableInstances();
    
    if (availableInstances.length === 0) {
      console.warn('Load balancer: No available instances');
      return null;
    }

    // Check for sticky session / 检查粘性会话
     if (this.config.sessionAffinity && context.sessionId) {
       const stickyInstanceId = this.stickySessions.get(context.sessionId);
       if (stickyInstanceId) {
         const stickyInstance = availableInstances.find(i => i.id === stickyInstanceId);
         if (stickyInstance) {
           return stickyInstance;
         } else {
           // Remove invalid sticky session / 移除无效的粘性会话
           this.stickySessions.delete(context.sessionId);
         }
       }
     }

    let selectedInstance: ServiceInstance;

    // Apply load balancing strategy / 应用负载均衡策略
    switch (this.config.strategy) {
      case LoadBalanceStrategy.ROUND_ROBIN:
        selectedInstance = this.roundRobinSelect(availableInstances);
        break;
      case LoadBalanceStrategy.WEIGHTED_ROUND_ROBIN:
        selectedInstance = this.weightedRoundRobinSelect(availableInstances);
        break;
      case LoadBalanceStrategy.LEAST_CONNECTIONS:
        selectedInstance = this.leastConnectionsSelect(availableInstances);
        break;
      case LoadBalanceStrategy.WEIGHTED_LEAST_CONNECTIONS:
        selectedInstance = this.weightedLeastConnectionsSelect(availableInstances);
        break;
      case LoadBalanceStrategy.RANDOM:
        selectedInstance = this.randomSelect(availableInstances);
        break;
      case LoadBalanceStrategy.WEIGHTED_RANDOM:
        selectedInstance = this.weightedRandomSelect(availableInstances);
        break;
      case LoadBalanceStrategy.IP_HASH:
        selectedInstance = this.ipHashSelect(availableInstances, context.clientIp);
        break;
      case LoadBalanceStrategy.LEAST_RESPONSE_TIME:
        selectedInstance = this.leastResponseTimeSelect(availableInstances);
        break;
      case LoadBalanceStrategy.HEALTH_BASED:
        selectedInstance = this.healthBasedSelect(availableInstances);
        break;
      default:
        selectedInstance = this.roundRobinSelect(availableInstances);
    }

    // Set sticky session if enabled / 如果启用则设置粘性会话
     if (this.config.sessionAffinity && context.sessionId) {
       this.stickySessions.set(context.sessionId, selectedInstance.id);
       
       // Set TTL for sticky session / 为粘性会话设置TTL
       setTimeout(() => {
         this.stickySessions.delete(context.sessionId!);
       }, this.config.stickySessionTtl);
     }

    return selectedInstance;
  }

  // Get available instances (healthy and not circuit broken) / 获取可用实例（健康且未断路）
  private getAvailableInstances(): ServiceInstance[] {
    const now = Date.now();
    return Array.from(this.instances.values()).filter(instance => {
      // Check health status / 检查健康状态
      if (instance.status !== ServiceStatus.HEALTHY) {
        return false;
      }

      // Check circuit breaker / 检查断路器
      if (this.config.circuitBreakerEnabled) {
        const breaker = this.circuitBreakers.get(instance.id);
        if (breaker) {
          if (breaker.state === CircuitState.OPEN) {
            if (now < breaker.nextAttemptTime) {
              return false;
            } else {
              // Move to half-open state / 转换到半开状态
              breaker.state = CircuitState.HALF_OPEN;
            }
          }
        }
      }

      return true;
    });
  }

  // Round robin selection / 轮询选择
  private roundRobinSelect(instances: ServiceInstance[]): ServiceInstance {
    const instance = instances[this.roundRobinIndex % instances.length];
    this.roundRobinIndex = (this.roundRobinIndex + 1) % instances.length;
    return instance;
  }

  // Weighted round robin selection / 加权轮询选择
  private weightedRoundRobinSelect(instances: ServiceInstance[]): ServiceInstance {
    const totalWeight = instances.reduce((sum, instance) => sum + instance.weight, 0);
    let randomWeight = Math.random() * totalWeight;
    
    for (const instance of instances) {
      randomWeight -= instance.weight;
      if (randomWeight <= 0) {
        return instance;
      }
    }
    
    return instances[0];
  }

  // Least connections selection / 最少连接选择
  private leastConnectionsSelect(instances: ServiceInstance[]): ServiceInstance {
    return instances.reduce((min, instance) => 
      instance.connections < min.connections ? instance : min
    );
  }

  // Weighted least connections selection / 加权最少连接选择
  private weightedLeastConnectionsSelect(instances: ServiceInstance[]): ServiceInstance {
    return instances.reduce((min, instance) => {
      const minRatio = min.connections / min.weight;
      const instanceRatio = instance.connections / instance.weight;
      return instanceRatio < minRatio ? instance : min;
    });
  }

  // Random selection / 随机选择
  private randomSelect(instances: ServiceInstance[]): ServiceInstance {
    const randomIndex = Math.floor(Math.random() * instances.length);
    return instances[randomIndex];
  }

  // Weighted random selection / 加权随机选择
  private weightedRandomSelect(instances: ServiceInstance[]): ServiceInstance {
    return this.weightedRoundRobinSelect(instances); // Same logic / 相同逻辑
  }

  // IP hash selection / IP哈希选择
  private ipHashSelect(instances: ServiceInstance[], clientIp: string): ServiceInstance {
    const hash = this.hashString(clientIp);
    const index = hash % instances.length;
    return instances[index];
  }

  // Least response time selection / 最少响应时间选择
  private leastResponseTimeSelect(instances: ServiceInstance[]): ServiceInstance {
    return instances.reduce((min, instance) => 
      instance.responseTime < min.responseTime ? instance : min
    );
  }

  // Health-based selection / 基于健康的选择
  private healthBasedSelect(instances: ServiceInstance[]): ServiceInstance {
    return instances.reduce((best, instance) => 
      instance.healthScore > best.healthScore ? instance : best
    );
  }

  // Hash string function / 字符串哈希函数
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer / 转换为32位整数
    }
    return Math.abs(hash);
  }

  // Record request result / 记录请求结果
  recordRequest(instanceId: string, success: boolean, responseTime: number): void {
    const instance = this.instances.get(instanceId);
    const instanceStats = this.stats.instanceStats.get(instanceId);
    
    if (instance && instanceStats) {
      // Update instance stats / 更新实例统计
      instanceStats.requests++;
      instanceStats.lastUsed = Date.now();
      
      if (success) {
        instanceStats.successes++;
        this.stats.successfulRequests++;
      } else {
        instanceStats.failures++;
        this.stats.failedRequests++;
      }

      // Update response time / 更新响应时间
      instanceStats.averageResponseTime = 
        ((instanceStats.averageResponseTime * (instanceStats.requests - 1)) + responseTime) / instanceStats.requests;
      
      instance.responseTime = instanceStats.averageResponseTime;

      // Update global stats / 更新全局统计
      this.stats.totalRequests++;
      this.stats.averageResponseTime = 
        ((this.stats.averageResponseTime * (this.stats.totalRequests - 1)) + responseTime) / this.stats.totalRequests;

      // Handle circuit breaker / 处理断路器
      if (this.config.circuitBreakerEnabled) {
        this.updateCircuitBreaker(instanceId, success);
      }
    }
  }

  // Update circuit breaker state / 更新断路器状态
  private updateCircuitBreaker(instanceId: string, success: boolean): void {
    const breaker = this.circuitBreakers.get(instanceId);
    if (!breaker) return;

    const now = Date.now();

    if (success) {
      if (breaker.state === CircuitState.HALF_OPEN) {
        // Reset circuit breaker / 重置断路器
        breaker.state = CircuitState.CLOSED;
        breaker.failures = 0;
        console.log(`Circuit breaker closed for instance ${instanceId}`);
      }
    } else {
      breaker.failures++;
      breaker.lastFailureTime = now;

      if (breaker.state === CircuitState.CLOSED && 
          breaker.failures >= this.config.circuitBreakerThreshold) {
        // Open circuit breaker / 打开断路器
        breaker.state = CircuitState.OPEN;
        breaker.nextAttemptTime = now + this.config.circuitBreakerTimeout;
        console.log(`Circuit breaker opened for instance ${instanceId}`);
        this.emit('circuit_breaker_opened', instanceId);
      } else if (breaker.state === CircuitState.HALF_OPEN) {
        // Back to open state / 回到打开状态
        breaker.state = CircuitState.OPEN;
        breaker.nextAttemptTime = now + this.config.circuitBreakerTimeout;
      }
    }
  }

  // Start connection tracking / 开始连接跟踪
  startConnection(instanceId: string): void {
    const instance = this.instances.get(instanceId);
    const instanceStats = this.stats.instanceStats.get(instanceId);
    
    if (instance && instanceStats) {
      instance.connections++;
      instanceStats.connections++;
      this.stats.activeConnections++;
    }
  }

  // End connection tracking / 结束连接跟踪
  endConnection(instanceId: string): void {
    const instance = this.instances.get(instanceId);
    const instanceStats = this.stats.instanceStats.get(instanceId);
    
    if (instance && instanceStats) {
      instance.connections = Math.max(0, instance.connections - 1);
      instanceStats.connections = Math.max(0, instanceStats.connections - 1);
      this.stats.activeConnections = Math.max(0, this.stats.activeConnections - 1);
    }
  }

  // Start health checks / 开始健康检查
  private startHealthChecks(): void {
    if (this.config.healthCheckInterval > 0) {
      this.healthCheckTimer = setInterval(() => {
        this.performHealthChecks();
      }, this.config.healthCheckInterval);
    }
  }

  // Perform health checks on all instances / 对所有实例执行健康检查
  private async performHealthChecks(): Promise<void> {
    const promises = Array.from(this.instances.values()).map(instance => 
      this.checkInstanceHealth(instance)
    );
    
    await Promise.allSettled(promises);
  }

  // Check health of a single instance / 检查单个实例的健康状态
  private async checkInstanceHealth(instance: ServiceInstance): Promise<void> {
    try {
      const startTime = Date.now();
      const url = `${instance.protocol}://${instance.host}:${instance.port}/health`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        this.updateInstanceStatus(instance.id, ServiceStatus.HEALTHY, 100);
        instance.responseTime = responseTime;
      } else {
        this.updateInstanceStatus(instance.id, ServiceStatus.UNHEALTHY, 0);
      }
    } catch (error) {
      this.updateInstanceStatus(instance.id, ServiceStatus.UNHEALTHY, 0);
      console.warn(`Health check failed for instance ${instance.id}:`, error);
    }
  }

  // Get load balancer statistics / 获取负载均衡器统计
  getStats(): LoadBalancerStats {
    return {
      ...this.stats,
      instanceStats: new Map(this.stats.instanceStats)
    };
  }

  // Get instance by ID / 根据ID获取实例
  getInstance(instanceId: string): ServiceInstance | undefined {
    return this.instances.get(instanceId);
  }

  // Get all instances / 获取所有实例
  getAllInstances(): ServiceInstance[] {
    return Array.from(this.instances.values());
  }

  // Get healthy instances / 获取健康实例
  getHealthyInstances(): ServiceInstance[] {
    return Array.from(this.instances.values()).filter(
      instance => instance.status === ServiceStatus.HEALTHY
    );
  }

  // Update configuration / 更新配置
  updateConfig(newConfig: Partial<LoadBalancerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart health checks if interval changed / 如果间隔改变则重启健康检查
    if (newConfig.healthCheckInterval !== undefined) {
      if (this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer);
      }
      this.startHealthChecks();
    }
    
    console.log('Load balancer configuration updated');
    this.emit('config_updated', this.config);
  }

  // Clean up sticky sessions / 清理粘性会话
  private cleanupStickySessions(): void {
    // This would be called periodically to remove expired sessions / 这将定期调用以移除过期会话
    // Implementation depends on TTL tracking / 实现取决于TTL跟踪
  }

  // Stop load balancer / 停止负载均衡器
  stop(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
    
    this.instances.clear();
     this.stats.instanceStats.clear();
     this.circuitBreakers.clear();
     this.stickySessions.clear();
    
    console.log('Load balancer stopped');
    this.emit('stopped');
  }

  // Get load balancer status / 获取负载均衡器状态
  getStatus(): any {
    return {
      strategy: this.config.strategy,
      totalInstances: this.instances.size,
      healthyInstances: this.getHealthyInstances().length,
      activeConnections: this.stats.activeConnections,
      totalRequests: this.stats.totalRequests,
      successRate: this.stats.totalRequests > 0 ? 
        (this.stats.successfulRequests / this.stats.totalRequests * 100).toFixed(2) + '%' : '0%',
      averageResponseTime: Math.round(this.stats.averageResponseTime) + 'ms',
      circuitBreakers: Array.from(this.circuitBreakers.entries()).map(([id, breaker]) => ({
        instanceId: id,
        state: breaker.state,
        failures: breaker.failures
      }))
    };
  }

  // Get service status for all instances / 获取所有实例的服务状态
  getServiceStatus(): any {
    return Array.from(this.instances.values()).map(instance => {
      const stats = this.stats.instanceStats.get(instance.id);
      const breaker = this.circuitBreakers.get(instance.id);
      
      return {
        id: instance.id,
        host: instance.host,
        port: instance.port,
        protocol: instance.protocol,
        status: instance.status,
        weight: instance.weight,
        healthScore: instance.healthScore,
        lastHealthCheck: new Date(instance.lastHealthCheck).toISOString(),
        connections: instance.connections,
        responseTime: instance.responseTime,
        metadata: instance.metadata,
        stats: stats ? {
          requests: stats.requests,
          successes: stats.successes,
          failures: stats.failures,
          averageResponseTime: Math.round(stats.averageResponseTime),
          lastUsed: stats.lastUsed > 0 ? new Date(stats.lastUsed).toISOString() : null
        } : null,
        circuitBreaker: breaker ? {
          state: breaker.state,
          failures: breaker.failures,
          lastFailureTime: breaker.lastFailureTime > 0 ? new Date(breaker.lastFailureTime).toISOString() : null,
          nextAttemptTime: breaker.nextAttemptTime > 0 ? new Date(breaker.nextAttemptTime).toISOString() : null
        } : null
      };
    });
  }
}