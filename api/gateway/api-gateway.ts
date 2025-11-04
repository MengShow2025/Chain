// API Gateway implementation with load balancing and circuit breaker / API网关实现，包含负载均衡和熔断器
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { ServiceDiscovery } from './service-discovery';
import { LoadBalancer, LoadBalanceStrategy } from './load-balancer';
import { HealthChecker } from './health-checker';

// API Gateway configuration interface / API网关配置接口
export interface APIGatewayConfig {
  port: number;
  corsOrigins: string[];
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  compressionLevel: number;
  healthCheckInterval: number;
  loadBalancingStrategy: LoadBalanceStrategy;
  services: ServiceConfig[];
  // Enhanced configuration / 增强配置
  enableMetrics?: boolean;
  enableTracing?: boolean;
  enableCaching?: boolean;
  cacheConfig?: CacheConfig;
  securityConfig?: SecurityConfig;
  performanceConfig?: PerformanceConfig;
}

// Cache configuration / 缓存配置
export interface CacheConfig {
  enabled: boolean;
  ttl: number;
  maxSize: number;
  compressionEnabled: boolean;
}

// Security configuration / 安全配置
export interface SecurityConfig {
  enableAuth: boolean;
  enableRateLimit: boolean;
  enableIPWhitelist: boolean;
  allowedIPs?: string[];
  jwtSecret?: string;
}

// Performance configuration / 性能配置
export interface PerformanceConfig {
  maxConcurrentRequests: number;
  requestTimeout: number;
  keepAliveTimeout: number;
  enableGzip: boolean;
}

// Service configuration interface / 服务配置接口
export interface ServiceConfig {
  name: string;
  path: string;
  target: string;
  healthCheck?: string;
  timeout?: number;
  retries?: number;
  circuitBreaker?: CircuitBreakerConfig;
}

// Circuit breaker configuration / 熔断器配置
export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
}

// Service statistics interface / 服务统计接口
export interface ServiceStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  circuitBreakerState: CircuitState;
}

// Circuit breaker states / 熔断器状态
export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

// Main API Gateway class / 主要API网关类
export class APIGateway {
  private app: express.Application;
  private serviceDiscovery: ServiceDiscovery;
  private loadBalancer: LoadBalancer;
  private healthChecker: HealthChecker;
  private config: APIGatewayConfig;
  private serviceStats: Map<string, ServiceStats> = new Map();
  private circuitBreakers: Map<string, any> = new Map();

  constructor(config: APIGatewayConfig) {
    this.config = config;
    this.app = express();
    this.serviceDiscovery = new ServiceDiscovery();
    this.loadBalancer = new LoadBalancer({
      strategy: config.loadBalancingStrategy,
      healthCheckInterval: config.healthCheckInterval,
      maxRetries: 3,
      retryDelay: 1000,
      sessionAffinity: false,
      stickySessionTtl: 300000,
      circuitBreakerEnabled: true,
      circuitBreakerThreshold: 5,
      circuitBreakerTimeout: 60000
    });
    this.healthChecker = new HealthChecker();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.initializeServices();
  }

  // Setup middleware / 设置中间件
  private setupMiddleware(): void {
    // CORS configuration / CORS配置
    this.app.use(cors({
      origin: this.config.corsOrigins,
      credentials: true
    }));

    // Compression middleware / 压缩中间件
    this.app.use(compression({
      level: this.config.compressionLevel
    }));

    // Rate limiting / 速率限制
    this.app.use(rateLimit({
      windowMs: this.config.rateLimitWindowMs,
      max: this.config.rateLimitMaxRequests,
      message: 'Too many requests from this IP'
    }));

    // Request logging / 请求日志
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  // Setup routes / 设置路由
  private setupRoutes(): void {
    // Health check endpoint / 健康检查端点
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: this.getServiceHealthStatus(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.version
      });
    });

    // Detailed health check endpoint / 详细健康检查端点
    this.app.get('/health/detailed', (req: Request, res: Response) => {
      const healthStatus = this.getDetailedHealthStatus();
      res.json(healthStatus);
    });

    // Readiness probe endpoint / 就绪探针端点
    this.app.get('/ready', (req: Request, res: Response) => {
      const isReady = this.checkReadiness();
      res.status(isReady ? 200 : 503).json({
        ready: isReady,
        timestamp: new Date().toISOString()
      });
    });

    // Liveness probe endpoint / 存活探针端点
    this.app.get('/live', (req: Request, res: Response) => {
      res.json({
        alive: true,
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });

    // Service discovery endpoint / 服务发现端点
    this.app.get('/services', (req: Request, res: Response) => {
      res.json({
        services: this.serviceDiscovery.getAllServices(),
        totalServices: this.config.services.length,
        healthyServices: this.getHealthyServicesCount()
      });
    });

    // Statistics endpoint / 统计端点
    this.app.get('/stats', (req: Request, res: Response) => {
      res.json({
        services: Object.fromEntries(this.serviceStats),
        gateway: this.getGatewayStats(),
        system: this.getSystemStats()
      });
    });

    // Metrics endpoint (Prometheus format) / 指标端点(Prometheus格式)
    this.app.get('/metrics', (req: Request, res: Response) => {
      if (this.config.enableMetrics) {
        res.set('Content-Type', 'text/plain');
        res.send(this.generatePrometheusMetrics());
      } else {
        res.status(404).json({ error: 'Metrics not enabled' });
      }
    });

    // Configuration endpoint / 配置端点
    this.app.get('/config', (req: Request, res: Response) => {
      res.json({
        port: this.config.port,
        services: this.config.services.map(s => ({
          name: s.name,
          path: s.path,
          target: s.target,
          timeout: s.timeout,
          retries: s.retries
        })),
        loadBalancingStrategy: this.config.loadBalancingStrategy,
        healthCheckInterval: this.config.healthCheckInterval
      });
    });

    // Circuit breaker status endpoint / 熔断器状态端点
    this.app.get('/circuit-breakers', (req: Request, res: Response) => {
      const circuitBreakerStatus = Array.from(this.circuitBreakers.entries()).map(([name, cb]) => ({
        service: name,
        state: cb.state,
        failureCount: cb.failureCount,
        lastFailureTime: cb.lastFailureTime,
        nextAttempt: cb.nextAttempt
      }));
      res.json({ circuitBreakers: circuitBreakerStatus });
    });

    // Load balancer status endpoint / 负载均衡器状态端点
    this.app.get('/load-balancer', (req: Request, res: Response) => {
      res.json({
        strategy: this.config.loadBalancingStrategy,
        services: this.loadBalancer.getServiceStatus(),
        stats: this.loadBalancer.getStats()
      });
    });

    // Setup service proxies / 设置服务代理
    this.setupServiceProxies();
  }

  // Setup service proxies / 设置服务代理
  private setupServiceProxies(): void {
    this.config.services.forEach(service => {
      this.app.use(service.path, this.createServiceProxy(service));
    });
  }

  // Create service proxy middleware / 创建服务代理中间件
  private createServiceProxy(service: ServiceConfig) {
    return createProxyMiddleware({
      target: service.target,
      changeOrigin: true,
      timeout: service.timeout || 30000,
      on: {
        proxyReq: (proxyReq, req, res) => {
          // Add request tracking / 添加请求跟踪
          this.trackRequest(service.name);
        },
        proxyRes: (proxyRes, req, res) => {
          // Track response / 跟踪响应
          this.trackResponse(service.name, proxyRes.statusCode || 500);
        },
        error: (err, req, res) => {
           // Handle proxy errors / 处理代理错误
           console.error(`Proxy error for service ${service.name}:`, err);
           this.trackError(service.name);
           
           // Check circuit breaker / 检查熔断器
           if (this.shouldTripCircuitBreaker(service.name)) {
             this.tripCircuitBreaker(service.name);
           }
           
           if (res && typeof (res as any).status === 'function') {
             (res as any).status(503).json({
               error: 'Service temporarily unavailable',
               service: service.name
             });
           }
         }
      }
    });
  }

  // Initialize services / 初始化服务
  private async initializeServices(): Promise<void> {
    // Register services with service discovery / 向服务发现注册服务
    for (const service of this.config.services) {
      await this.serviceDiscovery.registerService({
        serviceName: service.name,
        instance: {
          id: `${service.name}-1`,
          host: new URL(service.target).hostname,
          port: parseInt(new URL(service.target).port) || 80,
          protocol: new URL(service.target).protocol.replace(':', ''),
          weight: 1,
          status: 'healthy' as any,
          metadata: {
            version: '1.0.0',
            region: 'default',
            zone: 'default',
            tags: [],
            capabilities: []
          }
        },
        ttl: 60,
        tags: [],
        checks: service.healthCheck ? [{
          type: 'http' as any,
          url: service.healthCheck,
          interval: this.config.healthCheckInterval,
          timeout: 5000
        }] : []
      });

      // Initialize service stats / 初始化服务统计
      this.serviceStats.set(service.name, {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        circuitBreakerState: CircuitState.CLOSED
      });
    }

    // Start health checking / 开始健康检查
    this.startHealthChecking();
  }

  // Start health checking / 开始健康检查
  private startHealthChecking(): void {
    setInterval(async () => {
      for (const service of this.config.services) {
        if (service.healthCheck) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch(service.healthCheck, {
              method: 'GET',
              signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
              this.markServiceHealthy(service.name);
            } else {
              this.markServiceUnhealthy(service.name);
            }
          } catch (error) {
            this.markServiceUnhealthy(service.name);
          }
        }
      }
    }, this.config.healthCheckInterval);
  }

  // Track request / 跟踪请求
  private trackRequest(serviceName: string): void {
    const stats = this.serviceStats.get(serviceName);
    if (stats) {
      stats.totalRequests++;
      this.serviceStats.set(serviceName, stats);
    }
  }

  // Track response / 跟踪响应
  private trackResponse(serviceName: string, statusCode: number): void {
    const stats = this.serviceStats.get(serviceName);
    if (stats) {
      if (statusCode >= 200 && statusCode < 400) {
        stats.successfulRequests++;
      } else {
        stats.failedRequests++;
      }
      this.serviceStats.set(serviceName, stats);
    }
  }

  // Track error / 跟踪错误
  private trackError(serviceName: string): void {
    const stats = this.serviceStats.get(serviceName);
    if (stats) {
      stats.failedRequests++;
      this.serviceStats.set(serviceName, stats);
    }
  }

  // Check if circuit breaker should trip / 检查熔断器是否应该触发
  private shouldTripCircuitBreaker(serviceName: string): boolean {
    const stats = this.serviceStats.get(serviceName);
    const service = this.config.services.find(s => s.name === serviceName);
    
    if (!stats || !service?.circuitBreaker) {
      return false;
    }

    const failureRate = stats.failedRequests / stats.totalRequests;
    return failureRate >= service.circuitBreaker.failureThreshold;
  }

  // Trip circuit breaker / 触发熔断器
  private tripCircuitBreaker(serviceName: string): void {
    const stats = this.serviceStats.get(serviceName);
    if (stats) {
      stats.circuitBreakerState = CircuitState.OPEN;
      this.serviceStats.set(serviceName, stats);
      
      console.log(`Circuit breaker tripped for service: ${serviceName}`);
      
      // Schedule reset attempt / 安排重置尝试
      const service = this.config.services.find(s => s.name === serviceName);
      if (service?.circuitBreaker) {
        setTimeout(() => {
          this.resetCircuitBreaker(serviceName);
        }, service.circuitBreaker.resetTimeout);
      }
    }
  }

  // Reset circuit breaker / 重置熔断器
  private resetCircuitBreaker(serviceName: string): void {
    const stats = this.serviceStats.get(serviceName);
    if (stats) {
      stats.circuitBreakerState = CircuitState.HALF_OPEN;
      this.serviceStats.set(serviceName, stats);
      console.log(`Circuit breaker reset to half-open for service: ${serviceName}`);
    }
  }

  // Mark service as healthy / 标记服务为健康
  private markServiceHealthy(serviceName: string): void {
    const stats = this.serviceStats.get(serviceName);
    if (stats && stats.circuitBreakerState === CircuitState.HALF_OPEN) {
      stats.circuitBreakerState = CircuitState.CLOSED;
      this.serviceStats.set(serviceName, stats);
      console.log(`Service ${serviceName} marked as healthy, circuit breaker closed`);
    }
  }

  // Mark service as unhealthy / 标记服务为不健康
  private markServiceUnhealthy(serviceName: string): void {
    console.log(`Service ${serviceName} marked as unhealthy`);
  }

  // Get service health status / 获取服务健康状态
  private getServiceHealthStatus(): any {
    const status: any = {};
    this.serviceStats.forEach((stats, serviceName) => {
      status[serviceName] = {
        healthy: stats.circuitBreakerState === CircuitState.CLOSED,
        circuitBreakerState: stats.circuitBreakerState,
        totalRequests: stats.totalRequests,
        successRate: stats.totalRequests > 0 ? 
          (stats.successfulRequests / stats.totalRequests * 100).toFixed(2) + '%' : '0%'
      };
    });
    return status;
  }

  // Start the gateway / 启动网关
  public start(): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(this.config.port, () => {
        console.log(`API Gateway started on port ${this.config.port}`);
        resolve();
      });
    });
  }

  // Stop the gateway / 停止网关
  public async stop(): Promise<void> {
    // Cleanup resources / 清理资源
    await this.serviceDiscovery.stop();
    console.log('API Gateway stopped');
  }

  // Get gateway statistics / 获取网关统计
  public getStats(): any {
    return {
      services: Object.fromEntries(this.serviceStats),
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
  }

  // Get detailed health status / 获取详细健康状态
  private getDetailedHealthStatus(): any {
    const services = this.config.services.map(service => {
      const stats = this.serviceStats.get(service.name);
      const circuitBreaker = this.circuitBreakers.get(service.name);
      
      return {
        name: service.name,
        target: service.target,
        healthy: stats ? stats.circuitBreakerState === CircuitState.CLOSED : false,
        stats: stats || null,
        circuitBreaker: circuitBreaker ? {
          state: circuitBreaker.state,
          failureCount: circuitBreaker.failureCount,
          lastFailureTime: circuitBreaker.lastFailureTime
        } : null
      };
    });

    return {
      status: this.checkReadiness() ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      services,
      loadBalancer: {
        strategy: this.config.loadBalancingStrategy,
        healthyServices: this.getHealthyServicesCount()
      }
    };
  }

  // Check readiness / 检查就绪状态
  private checkReadiness(): boolean {
    const healthyServices = this.getHealthyServicesCount();
    const totalServices = this.config.services.length;
    
    // Consider ready if at least 50% of services are healthy / 如果至少50%的服务健康则认为就绪
    return totalServices === 0 || (healthyServices / totalServices) >= 0.5;
  }

  // Get healthy services count / 获取健康服务数量
  private getHealthyServicesCount(): number {
    let healthyCount = 0;
    for (const [serviceName, stats] of this.serviceStats.entries()) {
      if (stats.circuitBreakerState === CircuitState.CLOSED) {
        healthyCount++;
      }
    }
    return healthyCount;
  }

  // Get gateway statistics / 获取网关统计
  private getGatewayStats(): any {
    const totalRequests = Array.from(this.serviceStats.values())
      .reduce((sum, stats) => sum + stats.totalRequests, 0);
    const totalSuccessful = Array.from(this.serviceStats.values())
      .reduce((sum, stats) => sum + stats.successfulRequests, 0);
    const totalFailed = Array.from(this.serviceStats.values())
      .reduce((sum, stats) => sum + stats.failedRequests, 0);

    return {
      totalRequests,
      totalSuccessful,
      totalFailed,
      successRate: totalRequests > 0 ? (totalSuccessful / totalRequests) * 100 : 0,
      uptime: process.uptime(),
      startTime: new Date(Date.now() - process.uptime() * 1000).toISOString()
    };
  }

  // Get system statistics / 获取系统统计
  private getSystemStats(): any {
    const memUsage = process.memoryUsage();
    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      uptime: process.uptime(),
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB',
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
        external: Math.round(memUsage.external / 1024 / 1024) + ' MB'
      },
      cpuUsage: process.cpuUsage()
    };
  }

  // Generate Prometheus metrics / 生成Prometheus指标
  private generatePrometheusMetrics(): string {
    let metrics = '';
    
    // Gateway metrics / 网关指标
    const gatewayStats = this.getGatewayStats();
    metrics += `# HELP gateway_requests_total Total number of requests\n`;
    metrics += `# TYPE gateway_requests_total counter\n`;
    metrics += `gateway_requests_total ${gatewayStats.totalRequests}\n\n`;
    
    metrics += `# HELP gateway_requests_successful_total Total number of successful requests\n`;
    metrics += `# TYPE gateway_requests_successful_total counter\n`;
    metrics += `gateway_requests_successful_total ${gatewayStats.totalSuccessful}\n\n`;
    
    metrics += `# HELP gateway_requests_failed_total Total number of failed requests\n`;
    metrics += `# TYPE gateway_requests_failed_total counter\n`;
    metrics += `gateway_requests_failed_total ${gatewayStats.totalFailed}\n\n`;
    
    metrics += `# HELP gateway_success_rate Success rate percentage\n`;
    metrics += `# TYPE gateway_success_rate gauge\n`;
    metrics += `gateway_success_rate ${gatewayStats.successRate}\n\n`;
    
    // Service metrics / 服务指标
    for (const [serviceName, stats] of this.serviceStats.entries()) {
      metrics += `# HELP service_requests_total Total requests per service\n`;
      metrics += `# TYPE service_requests_total counter\n`;
      metrics += `service_requests_total{service="${serviceName}"} ${stats.totalRequests}\n\n`;
      
      metrics += `# HELP service_response_time_avg Average response time per service\n`;
      metrics += `# TYPE service_response_time_avg gauge\n`;
      metrics += `service_response_time_avg{service="${serviceName}"} ${stats.averageResponseTime}\n\n`;
      
      metrics += `# HELP service_circuit_breaker_state Circuit breaker state (0=closed, 1=open, 2=half-open)\n`;
      metrics += `# TYPE service_circuit_breaker_state gauge\n`;
      const stateValue = stats.circuitBreakerState === CircuitState.CLOSED ? 0 : 
                        stats.circuitBreakerState === CircuitState.OPEN ? 1 : 2;
      metrics += `service_circuit_breaker_state{service="${serviceName}"} ${stateValue}\n\n`;
    }
    
    return metrics;
  }
}