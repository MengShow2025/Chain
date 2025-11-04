// Service Discovery implementation for microservices / 微服务的服务发现实现
import { EventEmitter } from 'events';

// Service instance interface / 服务实例接口
export interface ServiceInstance {
  id: string;
  host: string;
  port: number;
  protocol: string;
  weight: number;
  status: ServiceStatus;
  metadata: ServiceMetadata;
}

// Service metadata interface / 服务元数据接口
export interface ServiceMetadata {
  version: string;
  region: string;
  zone: string;
  tags: string[];
  capabilities: string[];
}

// Service registration interface / 服务注册接口
export interface ServiceRegistration {
  serviceName: string;
  instance: ServiceInstance;
  ttl: number;
  tags: string[];
  checks: HealthCheck[];
}

// Health check interface / 健康检查接口
export interface HealthCheck {
  type: HealthCheckType;
  url?: string;
  interval: number;
  timeout: number;
  script?: string;
}

// Health check types / 健康检查类型
export enum HealthCheckType {
  HTTP = 'http',
  TCP = 'tcp',
  SCRIPT = 'script'
}

// Service query interface / 服务查询接口
export interface ServiceQuery {
  serviceName?: string;
  tags?: string[];
  healthy?: boolean;
  region?: string;
  zone?: string;
}

// Service discovery event interface / 服务发现事件接口
export interface ServiceDiscoveryEvent {
  type: 'register' | 'deregister' | 'health_change';
  serviceName: string;
  instance: ServiceInstance;
  timestamp: number;
}

// Service catalog interface / 服务目录接口
export interface ServiceCatalog {
  services: Map<string, ServiceInstance[]>;
  lastUpdated: number;
}

// Service discovery statistics / 服务发现统计
export interface ServiceDiscoveryStats {
  totalServices: number;
  healthyServices: number;
  unhealthyServices: number;
  totalInstances: number;
  registrations: number;
  deregistrations: number;
  healthChecks: number;
}

// Service status enum / 服务状态枚举
export enum ServiceStatus {
  HEALTHY = 'healthy',
  UNHEALTHY = 'unhealthy',
  DRAINING = 'draining',
  UNKNOWN = 'unknown'
}

// Main Service Discovery class / 主要服务发现类
export class ServiceDiscovery extends EventEmitter {
  private services: Map<string, ServiceInstance[]> = new Map();
  private healthChecks: Map<string, NodeJS.Timeout> = new Map();
  private stats: ServiceDiscoveryStats;
  private isRunning = false;

  constructor() {
    super();
    this.stats = {
      totalServices: 0,
      healthyServices: 0,
      unhealthyServices: 0,
      totalInstances: 0,
      registrations: 0,
      deregistrations: 0,
      healthChecks: 0
    };
  }

  // Register a service instance / 注册服务实例
  async registerService(registration: ServiceRegistration): Promise<void> {
    const { serviceName, instance, ttl, tags, checks } = registration;
    
    // Get or create service instances array / 获取或创建服务实例数组
    let instances = this.services.get(serviceName) || [];
    
    // Check if instance already exists / 检查实例是否已存在
    const existingIndex = instances.findIndex(inst => inst.id === instance.id);
    
    if (existingIndex >= 0) {
      // Update existing instance / 更新现有实例
      instances[existingIndex] = { ...instance };
    } else {
      // Add new instance / 添加新实例
      instances.push({ ...instance });
      this.stats.registrations++;
      this.stats.totalInstances++;
    }
    
    this.services.set(serviceName, instances);
    this.updateServiceStats();
    
    // Setup health checks / 设置健康检查
    this.setupHealthChecks(serviceName, instance, checks);
    
    // Emit registration event / 发出注册事件
    this.emit('service_registered', {
      type: 'register',
      serviceName,
      instance,
      timestamp: Date.now()
    } as ServiceDiscoveryEvent);
    
    console.log(`Service registered: ${serviceName} (${instance.id})`);
  }

  // Deregister a service instance / 注销服务实例
  async deregisterService(serviceName: string, instanceId: string): Promise<void> {
    const instances = this.services.get(serviceName);
    
    if (!instances) {
      return;
    }
    
    const instanceIndex = instances.findIndex(inst => inst.id === instanceId);
    
    if (instanceIndex >= 0) {
      const instance = instances[instanceIndex];
      instances.splice(instanceIndex, 1);
      
      if (instances.length === 0) {
        this.services.delete(serviceName);
      } else {
        this.services.set(serviceName, instances);
      }
      
      // Cleanup health checks / 清理健康检查
      const healthCheckKey = `${serviceName}:${instanceId}`;
      const healthCheckTimer = this.healthChecks.get(healthCheckKey);
      if (healthCheckTimer) {
        clearInterval(healthCheckTimer);
        this.healthChecks.delete(healthCheckKey);
      }
      
      this.stats.deregistrations++;
      this.stats.totalInstances--;
      this.updateServiceStats();
      
      // Emit deregistration event / 发出注销事件
      this.emit('service_deregistered', {
        type: 'deregister',
        serviceName,
        instance,
        timestamp: Date.now()
      } as ServiceDiscoveryEvent);
      
      console.log(`Service deregistered: ${serviceName} (${instanceId})`);
    }
  }

  // Get service instances / 获取服务实例
  getService(serviceName: string): ServiceInstance[] {
    return this.services.get(serviceName) || [];
  }

  // Get all services / 获取所有服务
  getAllServices(): ServiceCatalog {
    return {
      services: new Map(this.services),
      lastUpdated: Date.now()
    };
  }

  // Query services with filters / 使用过滤器查询服务
  queryServices(query: ServiceQuery): ServiceInstance[] {
    let results: ServiceInstance[] = [];
    
    // Get services by name or all services / 按名称获取服务或所有服务
    if (query.serviceName) {
      results = this.getService(query.serviceName);
    } else {
      for (const instances of Array.from(this.services.values())) {
        results.push(...instances);
      }
    }
    
    // Apply filters / 应用过滤器
    if (query.healthy !== undefined) {
      results = results.filter(instance => 
        query.healthy ? instance.status === ServiceStatus.HEALTHY : instance.status !== ServiceStatus.HEALTHY
      );
    }
    
    if (query.tags && query.tags.length > 0) {
      results = results.filter(instance =>
        query.tags!.some(tag => instance.metadata.tags.includes(tag))
      );
    }
    
    if (query.region) {
      results = results.filter(instance => instance.metadata.region === query.region);
    }
    
    if (query.zone) {
      results = results.filter(instance => instance.metadata.zone === query.zone);
    }
    
    return results;
  }

  // Setup health checks for service instance / 为服务实例设置健康检查
  private setupHealthChecks(serviceName: string, instance: ServiceInstance, checks: HealthCheck[]): void {
    const healthCheckKey = `${serviceName}:${instance.id}`;
    
    // Clear existing health check / 清除现有健康检查
    const existingTimer = this.healthChecks.get(healthCheckKey);
    if (existingTimer) {
      clearInterval(existingTimer);
    }
    
    if (checks.length === 0) {
      return;
    }
    
    // Setup new health check / 设置新的健康检查
    const timer = setInterval(async () => {
      await this.performHealthCheck(serviceName, instance, checks);
    }, checks[0].interval);
    
    this.healthChecks.set(healthCheckKey, timer);
  }

  // Perform health check / 执行健康检查
  private async performHealthCheck(serviceName: string, instance: ServiceInstance, checks: HealthCheck[]): Promise<void> {
    this.stats.healthChecks++;
    
    for (const check of checks) {
      try {
        let isHealthy = false;
        
        switch (check.type) {
          case HealthCheckType.HTTP:
            if (check.url) {
              isHealthy = await this.performHttpHealthCheck(check.url, check.timeout);
            }
            break;
          case HealthCheckType.TCP:
            isHealthy = await this.performTcpHealthCheck(instance.host, instance.port, check.timeout);
            break;
          case HealthCheckType.SCRIPT:
            if (check.script) {
              isHealthy = await this.performScriptHealthCheck(check.script, check.timeout);
            }
            break;
        }
        
        // Update instance status / 更新实例状态
        const previousStatus = instance.status;
        instance.status = isHealthy ? ServiceStatus.HEALTHY : ServiceStatus.UNHEALTHY;
        
        // Emit health change event if status changed / 如果状态改变则发出健康变化事件
        if (previousStatus !== instance.status) {
          this.emit('health_changed', {
            type: 'health_change',
            serviceName,
            instance,
            timestamp: Date.now()
          } as ServiceDiscoveryEvent);
          
          console.log(`Health status changed for ${serviceName} (${instance.id}): ${previousStatus} -> ${instance.status}`);
        }
        
      } catch (error) {
        console.error(`Health check failed for ${serviceName} (${instance.id}):`, error);
        instance.status = ServiceStatus.UNHEALTHY;
      }
    }
    
    this.updateServiceStats();
  }

  // Perform HTTP health check / 执行HTTP健康检查
  private async performHttpHealthCheck(url: string, timeout: number): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // Perform TCP health check / 执行TCP健康检查
  private async performTcpHealthCheck(host: string, port: number, timeout: number): Promise<boolean> {
    return new Promise((resolve) => {
      const net = require('net');
      const socket = new net.Socket();
      
      const timer = setTimeout(() => {
        socket.destroy();
        resolve(false);
      }, timeout);
      
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

  // Perform script health check / 执行脚本健康检查
  private async performScriptHealthCheck(script: string, timeout: number): Promise<boolean> {
    return new Promise((resolve) => {
      const { exec } = require('child_process');
      
      const process = exec(script, { timeout }, (error: any, stdout: string, stderr: string) => {
        if (error) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
      
      process.on('timeout', () => {
        resolve(false);
      });
    });
  }

  // Update service statistics / 更新服务统计
  private updateServiceStats(): void {
    this.stats.totalServices = this.services.size;
    this.stats.healthyServices = 0;
    this.stats.unhealthyServices = 0;
    this.stats.totalInstances = 0;
    
    for (const instances of Array.from(this.services.values())) {
      this.stats.totalInstances += instances.length;
      
      const hasHealthyInstance = instances.some(inst => inst.status === ServiceStatus.HEALTHY);
      const hasUnhealthyInstance = instances.some(inst => inst.status === ServiceStatus.UNHEALTHY);
      
      if (hasHealthyInstance) {
        this.stats.healthyServices++;
      }
      if (hasUnhealthyInstance) {
        this.stats.unhealthyServices++;
      }
    }
  }

  // Get service discovery statistics / 获取服务发现统计
  getStats(): ServiceDiscoveryStats {
    return { ...this.stats };
  }

  // Start service discovery / 启动服务发现
  start(): void {
    if (this.isRunning) {
      return;
    }
    
    this.isRunning = true;
    console.log('Service Discovery started');
  }

  // Stop service discovery / 停止服务发现
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }
    
    this.isRunning = false;
    
    // Clear all health check timers / 清除所有健康检查定时器
    for (const timer of Array.from(this.healthChecks.values())) {
      clearInterval(timer);
    }
    this.healthChecks.clear();
    
    // Clear all services / 清除所有服务
    this.services.clear();
    
    console.log('Service Discovery stopped');
  }

  // Check if service discovery is running / 检查服务发现是否正在运行
  isActive(): boolean {
    return this.isRunning;
  }
}