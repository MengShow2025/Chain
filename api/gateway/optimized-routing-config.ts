/**
 * Optimized Routing Configuration for TitanChain API Gateway
 * 优化的TitanChain API网关路由配置
 */

import { ServiceConfig, APIGatewayConfig } from './api-gateway';
import { LoadBalanceStrategy } from './load-balancer';
import { ENHANCED_HEALTH_CHECKS, getHealthChecksForEnvironment } from './enhanced-health-config';

/**
 * Route priority levels / 路由优先级
 */
export enum RoutePriority {
  CRITICAL = 'critical',    // Core blockchain operations / 核心区块链操作
  HIGH = 'high',           // Trading and transactions / 交易和事务
  MEDIUM = 'medium',       // API queries / API查询
  LOW = 'low'              // Monitoring and stats / 监控和统计
}

/**
 * Enhanced service configuration / 增强的服务配置
 */
export interface OptimizedServiceConfig extends ServiceConfig {
  priority: RoutePriority;
  weight: number;
  tags: string[];
  region?: string;
  version: string;
  maxConcurrentRequests?: number;
  rateLimitOverride?: {
    windowMs: number;
    maxRequests: number;
  };
}

/**
 * Route group configuration / 路由组配置
 */
export interface RouteGroup {
  name: string;
  basePath: string;
  services: OptimizedServiceConfig[];
  loadBalanceStrategy: LoadBalanceStrategy;
  healthCheckEnabled: boolean;
  cachingEnabled: boolean;
  compressionEnabled: boolean;
}

/**
 * Optimized routing configuration / 优化的路由配置
 */
export class OptimizedRoutingConfig {
  private routeGroups: Map<string, RouteGroup> = new Map();
  private serviceRegistry: Map<string, OptimizedServiceConfig> = new Map();

  constructor() {
    this.initializeDefaultRoutes();
  }

  /**
   * Initialize default route groups / 初始化默认路由组
   */
  private initializeDefaultRoutes(): void {
    // Core Blockchain Routes / 核心区块链路由
    this.addRouteGroup({
      name: 'blockchain-core',
      basePath: '/api/blockchain',
      loadBalanceStrategy: LoadBalanceStrategy.LEAST_RESPONSE_TIME,
      healthCheckEnabled: true,
      cachingEnabled: false, // Real-time data / 实时数据
      compressionEnabled: true,
      services: [
        {
          name: 'blockchain-api-primary',
          path: '/api/blockchain',
          target: 'http://localhost:3001/api/blockchain',
          healthCheck: '/api/blockchain/status',
          timeout: 15000,
          retries: 2,
          priority: RoutePriority.CRITICAL,
          weight: 100,
          tags: ['blockchain', 'primary'],
          version: '1.0.0',
          maxConcurrentRequests: 1000,
          circuitBreaker: {
            failureThreshold: 2,
            resetTimeout: 30000,
            monitoringPeriod: 5000
          }
        }
      ]
    });

    // TitanCore Trading Engine Routes / TitanCore交易引擎路由
    this.addRouteGroup({
      name: 'titan-core',
      basePath: '/api/titan',
      loadBalanceStrategy: LoadBalanceStrategy.WEIGHTED_LEAST_CONNECTIONS,
      healthCheckEnabled: true,
      cachingEnabled: false, // Trading data must be real-time / 交易数据必须实时
      compressionEnabled: true,
      services: [
        {
          name: 'titan-core-primary',
          path: '/api/titan',
          target: 'http://localhost:3001/api/titan',
          healthCheck: '/api/titan/health',
          timeout: 8000,
          retries: 3,
          priority: RoutePriority.CRITICAL,
          weight: 100,
          tags: ['titan-core', 'trading', 'primary'],
          version: '1.0.0',
          maxConcurrentRequests: 5000,
          rateLimitOverride: {
            windowMs: 1000, // 1 second / 1秒
            maxRequests: 10000 // High throughput for trading / 交易高吞吐量
          },
          circuitBreaker: {
            failureThreshold: 3,
            resetTimeout: 20000,
            monitoringPeriod: 3000
          }
        }
      ]
    });

    // P2P Network Routes / P2P网络路由
    this.addRouteGroup({
      name: 'p2p-network',
      basePath: '/api/p2p',
      loadBalanceStrategy: LoadBalanceStrategy.ROUND_ROBIN,
      healthCheckEnabled: true,
      cachingEnabled: true, // Network status can be cached briefly / 网络状态可以短暂缓存
      compressionEnabled: true,
      services: [
        {
          name: 'p2p-network-api',
          path: '/api/p2p',
          target: 'http://localhost:3001/api/p2p',
          healthCheck: '/api/p2p/status',
          timeout: 12000,
          retries: 2,
          priority: RoutePriority.HIGH,
          weight: 80,
          tags: ['p2p', 'network'],
          version: '1.0.0',
          maxConcurrentRequests: 500,
          circuitBreaker: {
            failureThreshold: 4,
            resetTimeout: 45000,
            monitoringPeriod: 8000
          }
        }
      ]
    });

    // Smart Sharding Routes / 智能分片路由
    this.addRouteGroup({
      name: 'smart-sharding',
      basePath: '/api/sharding',
      loadBalanceStrategy: LoadBalanceStrategy.HEALTH_BASED,
      healthCheckEnabled: true,
      cachingEnabled: true,
      compressionEnabled: true,
      services: [
        {
          name: 'smart-sharding-api',
          path: '/api/sharding',
          target: 'http://localhost:3001/api/sharding',
          healthCheck: '/api/sharding/status',
          timeout: 20000,
          retries: 1,
          priority: RoutePriority.HIGH,
          weight: 70,
          tags: ['sharding', 'scaling'],
          version: '1.0.0',
          maxConcurrentRequests: 200,
          circuitBreaker: {
            failureThreshold: 3,
            resetTimeout: 60000,
            monitoringPeriod: 15000
          }
        }
      ]
    });

    // MPC System Routes / MPC系统路由
    this.addRouteGroup({
      name: 'mpc-system',
      basePath: '/api/mpc',
      loadBalanceStrategy: LoadBalanceStrategy.LEAST_CONNECTIONS,
      healthCheckEnabled: true,
      cachingEnabled: false, // Security-sensitive operations / 安全敏感操作
      compressionEnabled: false, // Avoid compression for security / 安全考虑避免压缩
      services: [
        {
          name: 'mpc-system-api',
          path: '/api/mpc',
          target: 'http://localhost:3001/api/mpc',
          healthCheck: '/api/mpc/status',
          timeout: 30000, // Longer timeout for cryptographic operations / 加密操作更长超时
          retries: 1,
          priority: RoutePriority.MEDIUM,
          weight: 60,
          tags: ['mpc', 'security', 'crypto'],
          version: '1.0.0',
          maxConcurrentRequests: 50,
          circuitBreaker: {
            failureThreshold: 2,
            resetTimeout: 120000, // Longer reset for security / 安全考虑更长重置时间
            monitoringPeriod: 30000
          }
        }
      ]
    });

    // General API Routes / 通用API路由
    this.addRouteGroup({
      name: 'general-api',
      basePath: '/api',
      loadBalanceStrategy: LoadBalanceStrategy.ROUND_ROBIN,
      healthCheckEnabled: true,
      cachingEnabled: true,
      compressionEnabled: true,
      services: [
        {
          name: 'general-api-server',
          path: '/api',
          target: 'http://localhost:3001',
          healthCheck: '/api/health',
          timeout: 10000,
          retries: 3,
          priority: RoutePriority.MEDIUM,
          weight: 90,
          tags: ['api', 'general'],
          version: '1.0.0',
          maxConcurrentRequests: 2000,
          circuitBreaker: {
            failureThreshold: 5,
            resetTimeout: 30000,
            monitoringPeriod: 10000
          }
        }
      ]
    });

    // Monitoring and Stats Routes / 监控和统计路由
    this.addRouteGroup({
      name: 'monitoring',
      basePath: '/api/monitoring',
      loadBalanceStrategy: LoadBalanceStrategy.RANDOM,
      healthCheckEnabled: false, // Self-monitoring / 自监控
      cachingEnabled: true,
      compressionEnabled: true,
      services: [
        {
          name: 'monitoring-api',
          path: '/api/monitoring',
          target: 'http://localhost:3001/api/monitoring',
          healthCheck: '/api/monitoring/health',
          timeout: 5000,
          retries: 1,
          priority: RoutePriority.LOW,
          weight: 50,
          tags: ['monitoring', 'stats'],
          version: '1.0.0',
          maxConcurrentRequests: 100,
          circuitBreaker: {
            failureThreshold: 10,
            resetTimeout: 60000,
            monitoringPeriod: 20000
          }
        }
      ]
    });
  }

  /**
   * Add route group / 添加路由组
   */
  addRouteGroup(group: RouteGroup): void {
    this.routeGroups.set(group.name, group);
    
    // Register services / 注册服务
    group.services.forEach(service => {
      this.serviceRegistry.set(service.name, service);
    });
  }

  /**
   * Get route group / 获取路由组
   */
  getRouteGroup(name: string): RouteGroup | undefined {
    return this.routeGroups.get(name);
  }

  /**
   * Get all route groups / 获取所有路由组
   */
  getAllRouteGroups(): RouteGroup[] {
    return Array.from(this.routeGroups.values());
  }

  /**
   * Get services by priority / 按优先级获取服务
   */
  getServicesByPriority(priority: RoutePriority): OptimizedServiceConfig[] {
    return Array.from(this.serviceRegistry.values())
      .filter(service => service.priority === priority);
  }

  /**
   * Get services by tags / 按标签获取服务
   */
  getServicesByTags(tags: string[]): OptimizedServiceConfig[] {
    return Array.from(this.serviceRegistry.values())
      .filter(service => tags.some(tag => service.tags.includes(tag)));
  }

  /**
   * Generate optimized gateway configuration / 生成优化的网关配置
   */
  generateGatewayConfig(environment: string = 'development'): APIGatewayConfig {
    const allServices = this.flattenServices();
    
    return {
      port: 8889,
      corsOrigins: ['*'],
      rateLimitWindowMs: 15 * 60 * 1000, // 15 minutes / 15分钟
      rateLimitMaxRequests: this.calculateOptimalRateLimit(environment),
      compressionLevel: 6,
      healthCheckInterval: this.getHealthCheckInterval(environment),
      loadBalancingStrategy: LoadBalanceStrategy.LEAST_RESPONSE_TIME,
      
      // Enhanced configuration / 增强配置
      enableMetrics: true,
      enableTracing: environment !== 'production',
      enableCaching: true,
      
      // Cache configuration / 缓存配置
      cacheConfig: {
        enabled: true,
        ttl: this.getCacheTTL(environment),
        maxSize: 1000,
        compressionEnabled: true
      },
      
      // Security configuration / 安全配置
      securityConfig: {
        enableAuth: environment === 'production',
        enableRateLimit: true,
        enableIPWhitelist: environment === 'production',
        allowedIPs: environment === 'production' ? [] : ['127.0.0.1', '::1']
      },
      
      // Performance configuration / 性能配置
      performanceConfig: {
        maxConcurrentRequests: this.calculateMaxConcurrentRequests(),
        requestTimeout: 30000,
        keepAliveTimeout: 65000,
        enableGzip: true
      },
      
      services: allServices
    };
  }

  /**
   * Flatten all services from route groups / 从路由组扁平化所有服务
   */
  private flattenServices(): ServiceConfig[] {
    const services: ServiceConfig[] = [];
    
    this.routeGroups.forEach(group => {
      group.services.forEach(service => {
        // Convert OptimizedServiceConfig to ServiceConfig / 转换为ServiceConfig
        const { priority, weight, tags, region, version, maxConcurrentRequests, rateLimitOverride, ...baseService } = service;
        services.push(baseService);
      });
    });
    
    return services;
  }

  /**
   * Calculate optimal rate limit based on environment / 根据环境计算最优速率限制
   */
  private calculateOptimalRateLimit(environment: string): number {
    switch (environment) {
      case 'production':
        return 10000; // High throughput for production / 生产环境高吞吐量
      case 'staging':
        return 5000;
      case 'development':
        return 1000;
      case 'testing':
        return 100;
      default:
        return 1000;
    }
  }

  /**
   * Get health check interval based on environment / 根据环境获取健康检查间隔
   */
  private getHealthCheckInterval(environment: string): number {
    switch (environment) {
      case 'production':
        return 30000; // 30 seconds / 30秒
      case 'staging':
        return 20000; // 20 seconds / 20秒
      case 'development':
        return 10000; // 10 seconds / 10秒
      case 'testing':
        return 5000;  // 5 seconds / 5秒
      default:
        return 15000; // 15 seconds / 15秒
    }
  }

  /**
   * Get cache TTL based on environment / 根据环境获取缓存TTL
   */
  private getCacheTTL(environment: string): number {
    switch (environment) {
      case 'production':
        return 600000; // 10 minutes / 10分钟
      case 'staging':
        return 300000; // 5 minutes / 5分钟
      case 'development':
        return 60000;  // 1 minute / 1分钟
      case 'testing':
        return 10000;  // 10 seconds / 10秒
      default:
        return 300000; // 5 minutes / 5分钟
    }
  }

  /**
   * Calculate maximum concurrent requests / 计算最大并发请求数
   */
  private calculateMaxConcurrentRequests(): number {
    return Array.from(this.serviceRegistry.values())
      .reduce((total, service) => total + (service.maxConcurrentRequests || 1000), 0);
  }

  /**
   * Get configuration summary / 获取配置摘要
   */
  getConfigurationSummary(): any {
    return {
      totalRouteGroups: this.routeGroups.size,
      totalServices: this.serviceRegistry.size,
      servicesByPriority: {
        critical: this.getServicesByPriority(RoutePriority.CRITICAL).length,
        high: this.getServicesByPriority(RoutePriority.HIGH).length,
        medium: this.getServicesByPriority(RoutePriority.MEDIUM).length,
        low: this.getServicesByPriority(RoutePriority.LOW).length
      },
      routeGroups: Array.from(this.routeGroups.keys()),
      maxConcurrentRequests: this.calculateMaxConcurrentRequests()
    };
  }
}

// Export singleton instance / 导出单例实例
export const optimizedRoutingConfig = new OptimizedRoutingConfig();

export default OptimizedRoutingConfig;