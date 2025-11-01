import { ApiGateway, ApiGatewayConfig, RouteConfig } from './api-gateway.js';
import { LoadBalancer, LoadBalanceStrategy } from './load-balancer.js';
import { ServiceDiscovery, ServiceRegistration, ServiceRegistrationClient } from './service-discovery.js';
import { HealthChecker, HealthCheckFactory } from './health-checker.js';

/**
 * 网关管理器配置
 */
export interface GatewayManagerConfig {
  gateway: ApiGatewayConfig;
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
 * 网关管理器类
 * 统一管理API网关、负载均衡、服务发现和健康检查
 */
export class GatewayManager {
  private apiGateway: ApiGateway;
  private serviceDiscovery: ServiceDiscovery;
  private healthChecker: HealthChecker;
  private registrationClients: ServiceRegistrationClient[] = [];
  private isStarted = false;

  constructor(private config: GatewayManagerConfig) {
    // 初始化服务发现
    this.serviceDiscovery = new ServiceDiscovery(config.serviceDiscovery);
    
    // 初始化健康检查器
    this.healthChecker = new HealthChecker();
    
    // 初始化API网关
    this.apiGateway = new ApiGateway(config.gateway);
    
    this.setupEventHandlers();
    this.setupHealthChecks();
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    // 监听服务发现事件
    this.serviceDiscovery.on('serviceRegistered', (instance) => {
      console.log(`📡 服务已注册: ${instance.serviceName}/${instance.id}`);
    });

    this.serviceDiscovery.on('serviceDeregistered', (instance) => {
      console.log(`📡 服务已注销: ${instance.serviceName}/${instance.id}`);
    });

    this.serviceDiscovery.on('serviceHealthChanged', (instance) => {
      console.log(`📡 服务健康状态变化: ${instance.serviceName}/${instance.id}`);
    });

    // 监听健康检查事件
    this.healthChecker.on('checkFailed', (result) => {
      console.warn(`🏥 健康检查失败: ${result.name} - ${result.error}`);
    });
  }

  /**
   * 设置健康检查
   */
  private setupHealthChecks(): void {
    // 添加网关自身的健康检查
    this.healthChecker.addCheck({
      name: 'api-gateway',
      timeout: 1000,
      interval: 30000,
      retries: 0,
      retryDelay: 0,
      customCheck: async () => {
        const metrics = this.apiGateway.getApp();
        return {
          name: 'api-gateway',
          status: 'healthy',
          responseTime: 0,
          timestamp: Date.now(),
          metadata: {
            uptime: process.uptime(),
            isStarted: this.isStarted
          }
        };
      }
    });

    // 添加服务发现健康检查
    this.healthChecker.addCheck({
      name: 'service-discovery',
      timeout: 1000,
      interval: 30000,
      retries: 0,
      retryDelay: 0,
      customCheck: async () => {
        const stats = this.serviceDiscovery.getAllServicesStats();
        const totalServices = stats.reduce((sum, s) => sum + s.totalInstances, 0);
        const healthyServices = stats.reduce((sum, s) => sum + s.healthyInstances, 0);
        
        let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
        if (totalServices > 0) {
          const healthyRatio = healthyServices / totalServices;
          if (healthyRatio < 0.5) {
            status = 'unhealthy';
          } else if (healthyRatio < 0.8) {
            status = 'degraded';
          }
        }

        return {
          name: 'service-discovery',
          status,
          responseTime: 0,
          timestamp: Date.now(),
          metadata: {
            totalServices,
            healthyServices,
            serviceNames: this.serviceDiscovery.getServiceNames()
          }
        };
      }
    });
  }

  /**
   * 启动网关管理器
   */
  async start(): Promise<void> {
    try {
      console.log('🚀 启动网关管理器...');

      // 自动注册服务
      if (this.config.autoRegisterServices) {
        for (const registration of this.config.autoRegisterServices) {
          const client = new ServiceRegistrationClient(this.serviceDiscovery, registration);
          client.register();
          this.registrationClients.push(client);
        }
      }

      // 启动API网关
      await this.apiGateway.start();

      // 添加健康检查端点到网关
      const app = this.apiGateway.getApp();
      app.get('/gateway/health', this.healthChecker.createExpressEndpoint());
      app.get('/gateway/services', (req, res) => {
        res.json(this.serviceDiscovery.getAllServicesStats());
      });

      this.isStarted = true;
      console.log('✅ 网关管理器启动成功');

    } catch (error) {
      console.error('❌ 网关管理器启动失败:', error);
      throw error;
    }
  }

  /**
   * 停止网关管理器
   */
  async stop(): Promise<void> {
    try {
      console.log('🛑 停止网关管理器...');

      // 注销所有服务
      for (const client of this.registrationClients) {
        client.deregister();
      }
      this.registrationClients = [];

      // 停止各个组件
      await this.apiGateway.stop();
      this.serviceDiscovery.stop();
      this.healthChecker.stop();

      this.isStarted = false;
      console.log('✅ 网关管理器已停止');

    } catch (error) {
      console.error('❌ 网关管理器停止失败:', error);
      throw error;
    }
  }

  /**
   * 添加路由
   */
  addRoute(route: RouteConfig): void {
    this.apiGateway.addRoute(route);
  }

  /**
   * 注册服务
   */
  registerService(registration: ServiceRegistration): void {
    this.serviceDiscovery.registerService(registration);
  }

  /**
   * 注销服务
   */
  deregisterService(serviceName: string, instanceId: string): boolean {
    return this.serviceDiscovery.deregisterService(serviceName, instanceId);
  }

  /**
   * 添加健康检查
   */
  addHealthCheck(name: string, url: string): void {
    const check = HealthCheckFactory.httpService(name, url);
    this.healthChecker.addCheck(check);
  }

  /**
   * 获取网关统计信息
   */
  getStats() {
    const health = this.healthChecker.getOverallHealth();
    const services = this.serviceDiscovery.getAllServicesStats();
    
    return {
      gateway: {
        isStarted: this.isStarted,
        uptime: process.uptime(),
        health: health.status
      },
      services: {
        total: services.length,
        instances: services.reduce((sum, s) => sum + s.totalInstances, 0),
        healthy: services.reduce((sum, s) => sum + s.healthyInstances, 0)
      },
      health: {
        overall: health.status,
        checks: health.summary
      }
    };
  }

  /**
   * 获取服务发现实例
   */
  getServiceDiscovery(): ServiceDiscovery {
    return this.serviceDiscovery;
  }

  /**
   * 获取健康检查器实例
   */
  getHealthChecker(): HealthChecker {
    return this.healthChecker;
  }

  /**
   * 获取API网关实例
   */
  getApiGateway(): ApiGateway {
    return this.apiGateway;
  }
}

/**
 * 创建默认网关配置
 */
export function createDefaultGatewayConfig(port: number = 8080): GatewayManagerConfig {
  return {
    gateway: {
      port,
      routes: [
        {
          path: '/api/blockchain',
          serviceName: 'blockchain-service',
          methods: ['GET', 'POST'],
          timeout: 30000,
          retries: 2,
          circuitBreaker: {
            threshold: 5,
            timeout: 30000,
            resetTimeout: 60000
          }
        },
        {
          path: '/api/wallet',
          serviceName: 'wallet-service',
          methods: ['GET', 'POST'],
          auth: true,
          timeout: 15000,
          rateLimit: {
            windowMs: 60000,
            max: 100
          }
        },
        {
          path: '/api/explorer',
          serviceName: 'explorer-service',
          methods: ['GET'],
          timeout: 10000,
          rateLimit: {
            windowMs: 60000,
            max: 200
          }
        }
      ],
      loadBalancer: {
        strategy: LoadBalanceStrategy.WEIGHTED_ROUND_ROBIN,
        healthCheckInterval: 15000,
        healthCheckTimeout: 5000
      },
      security: {
        enableHelmet: true,
        enableCors: true,
        corsOptions: {
          origin: ['http://localhost:3000', 'http://localhost:5173'],
          credentials: true
        }
      },
      rateLimit: {
        windowMs: 60000,
        max: 1000,
        message: 'Too many requests from this IP'
      },
      logging: {
        enabled: true,
        level: 'info'
      }
    },
    serviceDiscovery: {
      heartbeatInterval: 30000,
      defaultTtl: 60000,
      cleanupInterval: 10000,
      enableHealthCheck: true,
      healthCheckInterval: 15000,
      healthCheckTimeout: 5000
    },
    autoRegisterServices: [
      {
        serviceName: 'blockchain-service',
        id: 'blockchain-1',
        host: 'localhost',
        port: 3001,
        version: '1.0.0',
        tags: ['blockchain', 'core'],
        ttl: 60000
      },
      {
        serviceName: 'explorer-service',
        id: 'explorer-1',
        host: 'localhost',
        port: 3002,
        version: '1.0.0',
        tags: ['explorer', 'readonly'],
        ttl: 60000
      }
    ]
  };
}

/**
 * 创建生产环境网关配置
 */
export function createProductionGatewayConfig(port: number = 80): GatewayManagerConfig {
  const config = createDefaultGatewayConfig(port);
  
  // 生产环境优化
  config.gateway.rateLimit.max = 5000;
  config.gateway.loadBalancer.strategy = LoadBalanceStrategy.LEAST_CONNECTIONS;
  config.gateway.security.corsOptions = {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://titanchain.io'],
    credentials: true
  };
  
  // 更严格的健康检查
  config.serviceDiscovery!.healthCheckInterval = 10000;
  config.serviceDiscovery!.defaultTtl = 30000;
  
  return config;
}