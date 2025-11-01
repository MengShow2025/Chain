import { EventEmitter } from 'events';
import { ServiceInstance, ServiceStatus, ServiceMetadata } from './load-balancer';

/**
 * 服务注册信息
 */
export interface ServiceRegistration {
  serviceName: string;
  instance: ServiceInstance;
  ttl?: number; // 生存时间（秒）
  tags?: string[];
  checks?: HealthCheck[];
}

/**
 * 健康检查配置
 */
export interface HealthCheck {
  id: string;
  name: string;
  type: 'http' | 'tcp' | 'script';
  url?: string;
  interval: number;
  timeout: number;
  deregisterCriticalServiceAfter?: number;
}

/**
 * 服务查询条件
 */
export interface ServiceQuery {
  serviceName?: string;
  tags?: string[];
  status?: ServiceStatus;
  region?: string;
  zone?: string;
  version?: string;
}

/**
 * 服务发现事件
 */
export interface ServiceDiscoveryEvent {
  type: 'service_registered' | 'service_deregistered' | 'service_updated' | 'health_changed';
  serviceName: string;
  instance: ServiceInstance;
  timestamp: number;
}

/**
 * 服务目录
 */
export interface ServiceCatalog {
  [serviceName: string]: {
    instances: ServiceInstance[];
    lastUpdated: number;
    metadata?: any;
  };
}

/**
 * 服务发现统计信息
 */
export interface ServiceDiscoveryStats {
  totalServices: number;
  totalInstances: number;
  healthyInstances: number;
  unhealthyInstances: number;
  registrationsPerMinute: number;
  deregistrationsPerMinute: number;
}

/**
 * 服务发现类
 */
export class ServiceDiscovery extends EventEmitter {
  private services: Map<string, Map<string, ServiceRegistration>>;
  private healthChecks: Map<string, HealthCheck>;
  private healthCheckIntervals: Map<string, NodeJS.Timeout>;
  private ttlTimers: Map<string, NodeJS.Timeout>;
  private stats: ServiceDiscoveryStats;
  private eventHistory: ServiceDiscoveryEvent[];
  private maxEventHistory: number;

  constructor() {
    super();
    
    this.services = new Map();
    this.healthChecks = new Map();
    this.healthCheckIntervals = new Map();
    this.ttlTimers = new Map();
    this.eventHistory = [];
    this.maxEventHistory = 1000;
    
    this.stats = {
      totalServices: 0,
      totalInstances: 0,
      healthyInstances: 0,
      unhealthyInstances: 0,
      registrationsPerMinute: 0,
      deregistrationsPerMinute: 0
    };
    
    console.log('ServiceDiscovery initialized');
    
    // 定期更新统计信息
    setInterval(() => {
      this.updateStats();
    }, 60000); // 每分钟更新一次
  }

  /**
   * 注册服务
   */
  registerService(registration: ServiceRegistration): boolean {
    try {
      const { serviceName, instance } = registration;
      
      // 确保服务存在
      if (!this.services.has(serviceName)) {
        this.services.set(serviceName, new Map());
      }
      
      const serviceInstances = this.services.get(serviceName)!;
      
      // 检查实例是否已存在
      if (serviceInstances.has(instance.id)) {
        console.log(`Service instance ${instance.id} already registered, updating...`);
        return this.updateService(registration);
      }
      
      // 注册新实例
      serviceInstances.set(instance.id, registration);
      
      // 设置TTL定时器
      if (registration.ttl) {
        this.setTTLTimer(serviceName, instance.id, registration.ttl);
      }
      
      // 启动健康检查
      if (registration.checks) {
        for (const check of registration.checks) {
          this.startHealthCheck(serviceName, instance.id, check);
        }
      }
      
      // 记录事件
      this.recordEvent({
        type: 'service_registered',
        serviceName,
        instance,
        timestamp: Date.now()
      });
      
      console.log(`Service registered: ${serviceName}/${instance.id} (${instance.host}:${instance.port})`);
      this.emit('service:registered', { serviceName, instance });
      
      return true;
      
    } catch (error) {
      console.error('Failed to register service:', error);
      return false;
    }
  }

  /**
   * 注销服务
   */
  deregisterService(serviceName: string, instanceId: string): boolean {
    try {
      const serviceInstances = this.services.get(serviceName);
      if (!serviceInstances || !serviceInstances.has(instanceId)) {
        console.log(`Service instance not found: ${serviceName}/${instanceId}`);
        return false;
      }
      
      const registration = serviceInstances.get(instanceId)!;
      
      // 移除实例
      serviceInstances.delete(instanceId);
      
      // 如果服务没有实例了，移除服务
      if (serviceInstances.size === 0) {
        this.services.delete(serviceName);
      }
      
      // 清理TTL定时器
      this.clearTTLTimer(serviceName, instanceId);
      
      // 停止健康检查
      this.stopHealthCheck(serviceName, instanceId);
      
      // 记录事件
      this.recordEvent({
        type: 'service_deregistered',
        serviceName,
        instance: registration.instance,
        timestamp: Date.now()
      });
      
      console.log(`Service deregistered: ${serviceName}/${instanceId}`);
      this.emit('service:deregistered', { serviceName, instance: registration.instance });
      
      return true;
      
    } catch (error) {
      console.error('Failed to deregister service:', error);
      return false;
    }
  }

  /**
   * 更新服务
   */
  updateService(registration: ServiceRegistration): boolean {
    try {
      const { serviceName, instance } = registration;
      
      const serviceInstances = this.services.get(serviceName);
      if (!serviceInstances || !serviceInstances.has(instance.id)) {
        console.log(`Service instance not found for update: ${serviceName}/${instance.id}`);
        return false;
      }
      
      // 更新注册信息
      serviceInstances.set(instance.id, registration);
      
      // 更新TTL定时器
      if (registration.ttl) {
        this.clearTTLTimer(serviceName, instance.id);
        this.setTTLTimer(serviceName, instance.id, registration.ttl);
      }
      
      // 记录事件
      this.recordEvent({
        type: 'service_updated',
        serviceName,
        instance,
        timestamp: Date.now()
      });
      
      console.log(`Service updated: ${serviceName}/${instance.id}`);
      this.emit('service:updated', { serviceName, instance });
      
      return true;
      
    } catch (error) {
      console.error('Failed to update service:', error);
      return false;
    }
  }

  /**
   * 发现服务
   */
  discoverServices(query: ServiceQuery = {}): ServiceInstance[] {
    const results: ServiceInstance[] = [];
    
    try {
      // 如果指定了服务名，只查找该服务
      if (query.serviceName) {
        const serviceInstances = this.services.get(query.serviceName);
        if (serviceInstances) {
          for (const registration of serviceInstances.values()) {
            if (this.matchesQuery(registration, query)) {
              results.push(registration.instance);
            }
          }
        }
      } else {
        // 查找所有服务
        for (const serviceInstances of this.services.values()) {
          for (const registration of serviceInstances.values()) {
            if (this.matchesQuery(registration, query)) {
              results.push(registration.instance);
            }
          }
        }
      }
      
      console.log(`Service discovery query returned ${results.length} instances`);
      return results;
      
    } catch (error) {
      console.error('Service discovery failed:', error);
      return [];
    }
  }

  /**
   * 获取服务实例
   */
  getServiceInstances(serviceName: string): ServiceInstance[] {
    const serviceInstances = this.services.get(serviceName);
    if (!serviceInstances) {
      return [];
    }
    
    return Array.from(serviceInstances.values()).map(reg => reg.instance);
  }

  /**
   * 获取健康的服务实例
   */
  getHealthyServiceInstances(serviceName: string): ServiceInstance[] {
    return this.getServiceInstances(serviceName).filter(
      instance => instance.status === ServiceStatus.HEALTHY
    );
  }

  /**
   * 获取服务目录
   */
  getServiceCatalog(): ServiceCatalog {
    const catalog: ServiceCatalog = {};
    
    for (const [serviceName, serviceInstances] of this.services) {
      catalog[serviceName] = {
        instances: Array.from(serviceInstances.values()).map(reg => reg.instance),
        lastUpdated: Date.now(),
        metadata: {
          instanceCount: serviceInstances.size,
          healthyCount: Array.from(serviceInstances.values())
            .filter(reg => reg.instance.status === ServiceStatus.HEALTHY).length
        }
      };
    }
    
    return catalog;
  }

  /**
   * 监听服务变化
   */
  watchService(serviceName: string, callback: (event: ServiceDiscoveryEvent) => void): () => void {
    const listener = (event: ServiceDiscoveryEvent) => {
      if (event.serviceName === serviceName) {
        callback(event);
      }
    };
    
    this.on('service:registered', listener);
    this.on('service:deregistered', listener);
    this.on('service:updated', listener);
    this.on('service:health_changed', listener);
    
    // 返回取消监听的函数
    return () => {
      this.off('service:registered', listener);
      this.off('service:deregistered', listener);
      this.off('service:updated', listener);
      this.off('service:health_changed', listener);
    };
  }

  /**
   * 检查查询条件匹配
   */
  private matchesQuery(registration: ServiceRegistration, query: ServiceQuery): boolean {
    const { instance } = registration;
    
    // 检查状态
    if (query.status && instance.status !== query.status) {
      return false;
    }
    
    // 检查标签
    if (query.tags && query.tags.length > 0) {
      const instanceTags = registration.tags || [];
      if (!query.tags.every(tag => instanceTags.includes(tag))) {
        return false;
      }
    }
    
    // 检查区域
    if (query.region && instance.metadata?.region !== query.region) {
      return false;
    }
    
    // 检查可用区
    if (query.zone && instance.metadata?.zone !== query.zone) {
      return false;
    }
    
    // 检查版本
    if (query.version && instance.metadata?.version !== query.version) {
      return false;
    }
    
    return true;
  }

  /**
   * 设置TTL定时器
   */
  private setTTLTimer(serviceName: string, instanceId: string, ttl: number): void {
    const key = `${serviceName}:${instanceId}`;
    
    // 清除现有定时器
    this.clearTTLTimer(serviceName, instanceId);
    
    // 设置新定时器
    const timer = setTimeout(() => {
      console.log(`Service TTL expired: ${serviceName}/${instanceId}`);
      this.deregisterService(serviceName, instanceId);
    }, ttl * 1000);
    
    this.ttlTimers.set(key, timer);
  }

  /**
   * 清除TTL定时器
   */
  private clearTTLTimer(serviceName: string, instanceId: string): void {
    const key = `${serviceName}:${instanceId}`;
    const timer = this.ttlTimers.get(key);
    
    if (timer) {
      clearTimeout(timer);
      this.ttlTimers.delete(key);
    }
  }

  /**
   * 启动健康检查
   */
  private startHealthCheck(serviceName: string, instanceId: string, check: HealthCheck): void {
    const key = `${serviceName}:${instanceId}:${check.id}`;
    
    // 停止现有健康检查
    this.stopHealthCheck(serviceName, instanceId, check.id);
    
    // 存储健康检查配置
    this.healthChecks.set(key, check);
    
    // 启动定期健康检查
    const interval = setInterval(async () => {
      await this.performHealthCheck(serviceName, instanceId, check);
    }, check.interval);
    
    this.healthCheckIntervals.set(key, interval);
    
    // 立即执行一次健康检查
    this.performHealthCheck(serviceName, instanceId, check);
    
    console.log(`Health check started: ${key}`);
  }

  /**
   * 停止健康检查
   */
  private stopHealthCheck(serviceName: string, instanceId: string, checkId?: string): void {
    if (checkId) {
      const key = `${serviceName}:${instanceId}:${checkId}`;
      this.stopSingleHealthCheck(key);
    } else {
      // 停止该实例的所有健康检查
      const prefix = `${serviceName}:${instanceId}:`;
      for (const key of this.healthCheckIntervals.keys()) {
        if (key.startsWith(prefix)) {
          this.stopSingleHealthCheck(key);
        }
      }
    }
  }

  /**
   * 停止单个健康检查
   */
  private stopSingleHealthCheck(key: string): void {
    const interval = this.healthCheckIntervals.get(key);
    if (interval) {
      clearInterval(interval);
      this.healthCheckIntervals.delete(key);
    }
    
    this.healthChecks.delete(key);
  }

  /**
   * 执行健康检查
   */
  private async performHealthCheck(serviceName: string, instanceId: string, check: HealthCheck): Promise<void> {
    try {
      const serviceInstances = this.services.get(serviceName);
      if (!serviceInstances) {
        return;
      }
      
      const registration = serviceInstances.get(instanceId);
      if (!registration) {
        return;
      }
      
      const startTime = Date.now();
      const isHealthy = await this.executeHealthCheck(registration.instance, check);
      const responseTime = Date.now() - startTime;
      
      const previousStatus = registration.instance.status;
      registration.instance.status = isHealthy ? ServiceStatus.HEALTHY : ServiceStatus.UNHEALTHY;
      registration.instance.lastHealthCheck = Date.now();
      registration.instance.responseTime = responseTime;
      
      if (previousStatus !== registration.instance.status) {
        console.log(`Health check status changed: ${serviceName}/${instanceId} ${previousStatus} -> ${registration.instance.status}`);
        
        // 记录事件
        this.recordEvent({
          type: 'health_changed',
          serviceName,
          instance: registration.instance,
          timestamp: Date.now()
        });
        
        this.emit('service:health_changed', {
          serviceName,
          instance: registration.instance,
          previousStatus,
          check
        });
      }
      
    } catch (error) {
      console.error(`Health check failed for ${serviceName}/${instanceId}:`, error);
    }
  }

  /**
   * 执行具体的健康检查
   */
  private async executeHealthCheck(instance: ServiceInstance, check: HealthCheck): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(false); // 超时视为不健康
      }, check.timeout);
      
      // 模拟健康检查
      setTimeout(() => {
        clearTimeout(timeout);
        // 90% 的概率返回健康状态
        resolve(Math.random() > 0.1);
      }, Math.random() * 100 + 50); // 50-150ms 响应时间
    });
  }

  /**
   * 记录事件
   */
  private recordEvent(event: ServiceDiscoveryEvent): void {
    this.eventHistory.push(event);
    
    // 限制事件历史大小
    if (this.eventHistory.length > this.maxEventHistory) {
      this.eventHistory.shift();
    }
    
    // 触发事件
    this.emit(`service:${event.type}`, event);
  }

  /**
   * 更新统计信息
   */
  private updateStats(): void {
    let totalInstances = 0;
    let healthyInstances = 0;
    let unhealthyInstances = 0;
    
    for (const serviceInstances of this.services.values()) {
      for (const registration of serviceInstances.values()) {
        totalInstances++;
        
        if (registration.instance.status === ServiceStatus.HEALTHY) {
          healthyInstances++;
        } else {
          unhealthyInstances++;
        }
      }
    }
    
    this.stats.totalServices = this.services.size;
    this.stats.totalInstances = totalInstances;
    this.stats.healthyInstances = healthyInstances;
    this.stats.unhealthyInstances = unhealthyInstances;
    
    // 计算每分钟的注册/注销率
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    const recentEvents = this.eventHistory.filter(event => event.timestamp > oneMinuteAgo);
    this.stats.registrationsPerMinute = recentEvents.filter(e => e.type === 'service_registered').length;
    this.stats.deregistrationsPerMinute = recentEvents.filter(e => e.type === 'service_deregistered').length;
  }

  /**
   * 获取统计信息
   */
  getStats(): ServiceDiscoveryStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * 获取事件历史
   */
  getEventHistory(limit?: number): ServiceDiscoveryEvent[] {
    const events = [...this.eventHistory].reverse(); // 最新的在前
    return limit ? events.slice(0, limit) : events;
  }

  /**
   * 清理过期服务
   */
  cleanupExpiredServices(): number {
    let cleanedCount = 0;
    const now = Date.now();
    const expireThreshold = 5 * 60 * 1000; // 5分钟
    
    for (const [serviceName, serviceInstances] of this.services) {
      const expiredInstances: string[] = [];
      
      for (const [instanceId, registration] of serviceInstances) {
        const lastCheck = registration.instance.lastHealthCheck || 0;
        if (now - lastCheck > expireThreshold) {
          expiredInstances.push(instanceId);
        }
      }
      
      for (const instanceId of expiredInstances) {
        this.deregisterService(serviceName, instanceId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired service instances`);
    }
    
    return cleanedCount;
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    // 停止所有健康检查
    for (const interval of this.healthCheckIntervals.values()) {
      clearInterval(interval);
    }
    this.healthCheckIntervals.clear();
    
    // 清除所有TTL定时器
    for (const timer of this.ttlTimers.values()) {
      clearTimeout(timer);
    }
    this.ttlTimers.clear();
    
    // 清理数据
    this.services.clear();
    this.healthChecks.clear();
    this.eventHistory.length = 0;
    this.removeAllListeners();
    
    console.log('ServiceDiscovery cleaned up');
  }
}