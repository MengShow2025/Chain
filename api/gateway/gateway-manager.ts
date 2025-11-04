import { APIGateway, APIGatewayConfig } from './api-gateway';
import { LoadBalancer, LoadBalanceStrategy, ServiceStatus } from './load-balancer';
import { ServiceDiscovery, ServiceRegistration } from './service-discovery';
import { HealthChecker, HealthCheckConfig, HealthCheckType } from './health-checker';

/**
 * Gateway Manager Configuration / 网关管理器配置
 */
export interface GatewayManagerConfig {
  gateway: APIGatewayConfig;
  serviceDiscovery?: {
    heartbeatInterval?: number;
    defaultTtl?: number;
    cleanupInterval?: number;
    enableHealthCheck?: boolean;
    healthCheckInterval?: number;
    healthCheckTimeout?: number;
  };
  autoRegisterServices?: ServiceRegistration[];
}

/**
 * Gateway Manager class for managing API Gateway, Service Discovery, and Health Checking
 * 网关管理器类，用于管理API网关、服务发现和健康检查
 */
export class GatewayManager {
  private apiGateway: APIGateway;
  private serviceDiscovery: ServiceDiscovery;
  private healthChecker: HealthChecker;
  private isStarted = false;

  constructor(private config: GatewayManagerConfig) {
    // Initialize components / 初始化组件
    this.apiGateway = new APIGateway(config.gateway);
    this.serviceDiscovery = new ServiceDiscovery();
    this.healthChecker = new HealthChecker();

    // Setup event handlers / 设置事件处理程序
    this.setupEventHandlers();
    
    // Setup health checks / 设置健康检查
    this.setupHealthChecks();
  }

  /**
   * Setup event handlers for service discovery / 为服务发现设置事件处理程序
   */
  private setupEventHandlers(): void {
    // Listen for service registration events / 监听服务注册事件
    this.serviceDiscovery.on('service_registered', (event) => {
      console.log(`Service registered: ${event.serviceName}`);
    });

    // Listen for service deregistration events / 监听服务注销事件
    this.serviceDiscovery.on('service_deregistered', (event) => {
      console.log(`Service deregistered: ${event.serviceName}`);
    });

    // Listen for health change events / 监听健康状态变化事件
    this.serviceDiscovery.on('health_changed', (event) => {
      console.log(`Service health changed: ${event.serviceName} -> ${event.instance.status}`);
    });
  }

  /**
   * Setup health checks / 设置健康检查
   */
  private setupHealthChecks(): void {
    // Add gateway self health check / 添加网关自身的健康检查
    this.healthChecker.addCheck({
      id: 'api-gateway-health',
      name: 'api-gateway',
      type: HealthCheckType.HTTP,
      target: 'localhost',
      timeout: 1000,
      interval: 30000,
      retries: 0,
      enabled: true
    });

    // Add service discovery health check / 添加服务发现健康检查
    this.healthChecker.addCheck({
      id: 'service-discovery-health',
      name: 'service-discovery',
      type: HealthCheckType.HTTP,
      target: 'localhost',
      timeout: 1000,
      interval: 30000,
      retries: 0,
      enabled: true
    });
  }

  /**
   * Start the gateway manager / 启动网关管理器
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      return;
    }

    try {
      // Start service discovery / 启动服务发现
      this.serviceDiscovery.start();

      // Start health checker / 启动健康检查器
      this.healthChecker.start();

      // Start API gateway / 启动API网关
      await this.apiGateway.start();

      // Auto-register services if configured / 如果配置了自动注册服务
      if (this.config.autoRegisterServices) {
        for (const registration of this.config.autoRegisterServices) {
          await this.serviceDiscovery.registerService(registration);
        }
      }

      this.isStarted = true;
      console.log('Gateway Manager started successfully');

    } catch (error) {
      console.error('Failed to start Gateway Manager:', error);
      throw error;
    }
  }

  /**
   * Stop the gateway manager / 停止网关管理器
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      return;
    }

    try {
      // Stop health checker / 停止健康检查器
      this.healthChecker.stop();

      // Stop service discovery / 停止服务发现
      await this.serviceDiscovery.stop();

      // Stop API gateway / 停止API网关
      await this.apiGateway.stop();

      this.isStarted = false;
      console.log('Gateway Manager stopped successfully');

    } catch (error) {
      console.error('Failed to stop Gateway Manager:', error);
      throw error;
    }
  }

  /**
   * Register a service / 注册服务
   */
  registerService(registration: ServiceRegistration): void {
    this.serviceDiscovery.registerService(registration);
  }

  /**
   * Deregister a service / 注销服务
   */
  deregisterService(serviceName: string, instanceId: string): boolean {
    this.serviceDiscovery.deregisterService(serviceName, instanceId);
    return true;
  }

  /**
   * Add health check / 添加健康检查
   */
  addHealthCheck(name: string, url: string): void {
    const check: HealthCheckConfig = {
      id: `custom-${name}`,
      name: name,
      type: HealthCheckType.HTTP,
      target: url,
      timeout: 5000,
      interval: 30000,
      retries: 3,
      enabled: true
    };
    this.healthChecker.addCheck(check);
  }

  /**
   * Get gateway statistics / 获取网关统计信息
   */
  getStats() {
    const health = this.healthChecker.getOverallStatus();
    const serviceStats = this.serviceDiscovery.getStats();
    
    // Calculate healthy instances from service stats / 从服务统计中计算健康实例数
    const healthyInstances = serviceStats.healthyServices;
    
    return {
      gateway: {
        isStarted: this.isStarted,
        uptime: process.uptime(),
        health: health
      },
      services: {
        total: serviceStats.totalServices,
        instances: serviceStats.totalInstances,
        healthy: healthyInstances
      },
      health: {
        overall: health,
        checks: this.healthChecker.getSummary()
      }
    };
  }

  /**
   * Get service discovery instance / 获取服务发现实例
   */
  getServiceDiscovery(): ServiceDiscovery {
    return this.serviceDiscovery;
  }

  /**
   * Get health checker instance / 获取健康检查器实例
   */
  getHealthChecker(): HealthChecker {
    return this.healthChecker;
  }

  /**
   * Get API gateway instance / 获取API网关实例
   */
  getApiGateway(): APIGateway {
    return this.apiGateway;
  }
}

/**
 * Create default gateway configuration / 创建默认网关配置
 */
export function createDefaultGatewayConfig(port: number = 8080): GatewayManagerConfig {
  return {
    gateway: {
      port,
      corsOrigins: ['*'],
      rateLimitWindowMs: 15 * 60 * 1000, // 15 minutes / 15分钟
      rateLimitMaxRequests: 100, // limit each IP to 100 requests per windowMs / 限制每个IP在窗口时间内最多100个请求
      compressionLevel: 6,
      healthCheckInterval: 30000,
      loadBalancingStrategy: LoadBalanceStrategy.ROUND_ROBIN,
      services: []
    },
    serviceDiscovery: {
      heartbeatInterval: 30000,
      defaultTtl: 60000,
      cleanupInterval: 60000,
      enableHealthCheck: true,
      healthCheckInterval: 30000,
      healthCheckTimeout: 5000
    },
    autoRegisterServices: []
  };
}

/**
 * Create production gateway configuration / 创建生产环境网关配置
 */
export function createProductionGatewayConfig(port: number = 80): GatewayManagerConfig {
  const config = createDefaultGatewayConfig(port);
  
  // Production-specific settings / 生产环境特定设置
  config.gateway.rateLimitMaxRequests = 1000;
  config.gateway.healthCheckInterval = 10000;
  config.serviceDiscovery!.heartbeatInterval = 15000;
  config.serviceDiscovery!.healthCheckInterval = 15000;
  
  return config;
}