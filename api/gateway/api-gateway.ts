import express, { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { LoadBalancer, LoadBalancingStrategy } from './load-balancer';
import { ServiceDiscovery } from './service-discovery';
import { HealthMonitor } from './health-monitor';

// API网关配置接口
interface APIGatewayConfig {
  port: number;
  corsOrigins: string[];
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  compressionLevel: number;
  healthCheckInterval: number;
  loadBalancingStrategy: LoadBalancingStrategy;
  services: ServiceConfig[];
}

// 服务配置接口
interface ServiceConfig {
  name: string;
  path: string;
  target: string;
  healthCheckPath?: string;
  timeout?: number;
  retries?: number;
  circuitBreaker?: CircuitBreakerConfig;
}

// 熔断器配置接口
interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
}

// 请求上下文接口
interface RequestContext {
  requestId: string;
  userId?: string;
  clientIp: string;
  userAgent: string;
  timestamp: number;
  service?: string;
  route?: string;
}

// 响应统计接口
interface ResponseStats {
  statusCode: number;
  responseTime: number;
  contentLength: number;
  cached: boolean;
}

// API网关统计信息接口
interface APIGatewayStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  requestsPerSecond: number;
  activeConnections: number;
  serviceStats: Map<string, ServiceStats>;
  errorStats: Map<string, number>;
}

// 服务统计信息接口
interface ServiceStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastRequestTime: number;
}

// 熔断器状态枚举
enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

// 熔断器类
class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private successCount = 0;

  constructor(
    private config: CircuitBreakerConfig
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.config.recoveryTimeout) {
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= 3) {
        this.state = CircuitState.CLOSED;
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime
    };
  }
}

// API网关主类
export class APIGateway {
  private app: express.Application;
  private loadBalancer: LoadBalancer;
  private serviceDiscovery: ServiceDiscovery;
  private healthMonitor: HealthMonitor;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private stats: APIGatewayStats;
  private startTime: number;

  constructor(private config: APIGatewayConfig) {
    this.app = express();
    this.loadBalancer = new LoadBalancer({
      strategy: config.loadBalancingStrategy,
      healthCheckInterval: config.healthCheckInterval,
      maxRetries: 3,
      timeout: 5000
    });
    this.serviceDiscovery = new ServiceDiscovery();
    this.healthMonitor = new HealthMonitor();
    this.startTime = Date.now();
    
    this.initializeStats();
    this.setupMiddleware();
    this.setupRoutes();
    this.registerServices();
  }

  private initializeStats(): void {
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      requestsPerSecond: 0,
      activeConnections: 0,
      serviceStats: new Map(),
      errorStats: new Map()
    };
  }

  private setupMiddleware(): void {
    // 安全中间件
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"]
        }
      }
    }));

    // CORS中间件
    this.app.use(cors({
      origin: this.config.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    // 压缩中间件
    this.app.use(compression({
      level: this.config.compressionLevel,
      threshold: 1024
    }));

    // 请求解析中间件
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // 限流中间件
    const limiter = rateLimit({
      windowMs: this.config.rateLimitWindowMs,
      max: this.config.rateLimitMaxRequests,
      message: {
        error: 'Too many requests',
        retryAfter: this.config.rateLimitWindowMs / 1000
      },
      standardHeaders: true,
      legacyHeaders: false
    });
    this.app.use('/api/', limiter);

    // 请求上下文中间件
    this.app.use(this.createRequestContext.bind(this));

    // 统计中间件
    this.app.use(this.collectStats.bind(this));
  }

  private createRequestContext(req: Request, res: Response, next: NextFunction): void {
    const context: RequestContext = {
      requestId: this.generateRequestId(),
      clientIp: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      timestamp: Date.now(),
      service: this.extractServiceFromPath(req.path),
      route: req.path
    };

    // 从Authorization头提取用户ID
    const authHeader = req.get('Authorization');
    if (authHeader) {
      context.userId = this.extractUserIdFromToken(authHeader);
    }

    (req as any).context = context;
    res.setHeader('X-Request-ID', context.requestId);
    
    next();
  }

  private collectStats(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    this.stats.totalRequests++;
    this.stats.activeConnections++;

    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      this.stats.activeConnections--;

      if (res.statusCode >= 200 && res.statusCode < 400) {
        this.stats.successfulRequests++;
      } else {
        this.stats.failedRequests++;
        const errorKey = `${res.statusCode}`;
        this.stats.errorStats.set(errorKey, (this.stats.errorStats.get(errorKey) || 0) + 1);
      }

      // 更新平均响应时间
      this.updateAverageResponseTime(responseTime);

      // 更新服务统计
      const context = (req as any).context as RequestContext;
      if (context.service) {
        this.updateServiceStats(context.service, responseTime, res.statusCode);
      }
    });

    next();
  }

  private setupRoutes(): void {
    // 健康检查端点
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: Date.now() - this.startTime,
        version: process.env.npm_package_version || '1.0.0'
      });
    });

    // 统计信息端点
    this.app.get('/stats', (req: Request, res: Response) => {
      res.json(this.getStats());
    });

    // 服务发现端点
    this.app.get('/services', (req: Request, res: Response) => {
      res.json(this.serviceDiscovery.getServiceCatalog());
    });

    // 负载均衡器状态端点
    this.app.get('/loadbalancer/status', (req: Request, res: Response) => {
      res.json(this.loadBalancer.getStats());
    });

    // 熔断器状态端点
    this.app.get('/circuit-breakers', (req: Request, res: Response) => {
      const breakerStats: any = {};
      for (const [service, breaker] of this.circuitBreakers) {
        breakerStats[service] = breaker.getStats();
      }
      res.json(breakerStats);
    });

    // 设置服务代理路由
    this.setupServiceProxies();
  }

  private setupServiceProxies(): void {
    for (const service of this.config.services) {
      const proxyOptions: Options = {
        target: service.target,
        changeOrigin: true,
        pathRewrite: {
          [`^${service.path}`]: ''
        },
        timeout: service.timeout || 30000,
        onProxyReq: (proxyReq, req, res) => {
          const context = (req as any).context as RequestContext;
          proxyReq.setHeader('X-Request-ID', context.requestId);
          proxyReq.setHeader('X-Forwarded-For', context.clientIp);
          proxyReq.setHeader('X-Gateway-Timestamp', context.timestamp.toString());
        },
        onProxyRes: (proxyRes, req, res) => {
          proxyRes.headers['X-Powered-By'] = 'TitanChain-Gateway';
        },
        onError: (err, req, res) => {
          console.error(`Proxy error for service ${service.name}:`, err);
          (res as Response).status(502).json({
            error: 'Bad Gateway',
            message: 'Service temporarily unavailable',
            service: service.name
          });
        }
      };

      // 创建熔断器
      if (service.circuitBreaker) {
        this.circuitBreakers.set(service.name, new CircuitBreaker(service.circuitBreaker));
      }

      // 创建代理中间件
      const proxy = createProxyMiddleware(proxyOptions);
      
      // 包装代理以支持熔断器
      this.app.use(service.path, async (req: Request, res: Response, next: NextFunction) => {
        const breaker = this.circuitBreakers.get(service.name);
        
        if (breaker) {
          try {
            await breaker.execute(async () => {
              return new Promise<void>((resolve, reject) => {
                proxy(req, res, (err) => {
                  if (err) reject(err);
                  else resolve();
                });
              });
            });
          } catch (error) {
            res.status(503).json({
              error: 'Service Unavailable',
              message: 'Circuit breaker is open',
              service: service.name
            });
          }
        } else {
          proxy(req, res, next);
        }
      });
    }

    // 404处理
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not Found',
        message: 'The requested resource was not found',
        path: req.path
      });
    });

    // 错误处理中间件
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      console.error('Gateway error:', err);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
        requestId: (req as any).context?.requestId
      });
    });
  }

  private registerServices(): void {
    for (const service of this.config.services) {
      // 注册服务到服务发现
      this.serviceDiscovery.registerService({
        id: service.name,
        name: service.name,
        address: this.extractHostFromTarget(service.target),
        port: this.extractPortFromTarget(service.target),
        tags: ['api', 'gateway'],
        metadata: {
          path: service.path,
          target: service.target,
          healthCheckPath: service.healthCheckPath
        }
      });

      // 注册服务到负载均衡器
      this.loadBalancer.registerInstance({
        id: service.name,
        host: this.extractHostFromTarget(service.target),
        port: this.extractPortFromTarget(service.target),
        weight: 100,
        status: 'healthy',
        metadata: {
          service: service.name,
          path: service.path
        }
      });

      // 添加健康检查
      if (service.healthCheckPath) {
        this.healthMonitor.addHealthCheck({
          id: `${service.name}-health`,
          name: `${service.name} Health Check`,
          type: 'http',
          target: `${service.target}${service.healthCheckPath}`,
          interval: this.config.healthCheckInterval,
          timeout: 5000,
          retries: 3
        });
      }
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private extractServiceFromPath(path: string): string | undefined {
    const match = path.match(/^\/api\/v\d+\/([^\/]+)/);
    return match ? match[1] : undefined;
  }

  private extractUserIdFromToken(authHeader: string): string | undefined {
    try {
      const token = authHeader.replace('Bearer ', '');
      // 这里应该实现实际的JWT解析逻辑
      // 暂时返回模拟的用户ID
      return `user_${token.substr(0, 8)}`;
    } catch (error) {
      return undefined;
    }
  }

  private extractHostFromTarget(target: string): string {
    try {
      const url = new URL(target);
      return url.hostname;
    } catch (error) {
      return 'localhost';
    }
  }

  private extractPortFromTarget(target: string): number {
    try {
      const url = new URL(target);
      return parseInt(url.port) || (url.protocol === 'https:' ? 443 : 80);
    } catch (error) {
      return 3000;
    }
  }

  private updateAverageResponseTime(responseTime: number): void {
    const totalRequests = this.stats.totalRequests;
    this.stats.averageResponseTime = 
      ((this.stats.averageResponseTime * (totalRequests - 1)) + responseTime) / totalRequests;
  }

  private updateServiceStats(serviceName: string, responseTime: number, statusCode: number): void {
    let serviceStats = this.stats.serviceStats.get(serviceName);
    
    if (!serviceStats) {
      serviceStats = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        lastRequestTime: 0
      };
      this.stats.serviceStats.set(serviceName, serviceStats);
    }

    serviceStats.totalRequests++;
    serviceStats.lastRequestTime = Date.now();

    if (statusCode >= 200 && statusCode < 400) {
      serviceStats.successfulRequests++;
    } else {
      serviceStats.failedRequests++;
    }

    // 更新服务平均响应时间
    serviceStats.averageResponseTime = 
      ((serviceStats.averageResponseTime * (serviceStats.totalRequests - 1)) + responseTime) / serviceStats.totalRequests;
  }

  public getStats(): APIGatewayStats {
    const uptime = Date.now() - this.startTime;
    this.stats.requestsPerSecond = this.stats.totalRequests / (uptime / 1000);
    return { ...this.stats };
  }

  public async start(): Promise<void> {
    return new Promise((resolve) => {
      // 启动健康监控
      this.healthMonitor.start();

      // 服务发现已在构造时启动

      // 启动API网关服务器
      this.app.listen(this.config.port, () => {
        console.log(`🚀 API Gateway started on port ${this.config.port}`);
        console.log(`📊 Health check endpoint: http://localhost:${this.config.port}/health`);
        console.log(`📈 Stats endpoint: http://localhost:${this.config.port}/stats`);
        console.log(`🔍 Services endpoint: http://localhost:${this.config.port}/services`);
        resolve();
      });
    });
  }

  public async stop(): Promise<void> {
    console.log('🛑 Stopping API Gateway...');
    
    // 停止健康监控
      this.healthMonitor.stop();
    
    // 服务发现无需显式停止
    
    console.log('✅ API Gateway stopped');
  }
}

// 默认配置
export const defaultGatewayConfig: APIGatewayConfig = {
  port: 8080,
  corsOrigins: ['http://localhost:3000', 'http://localhost:5173'],
  rateLimitWindowMs: 15 * 60 * 1000, // 15分钟
  rateLimitMaxRequests: 1000, // 每个窗口最多1000个请求
  compressionLevel: 6,
  healthCheckInterval: 30000, // 30秒
  loadBalancingStrategy: LoadBalancingStrategy.ROUND_ROBIN,
  services: [
    {
      name: 'blockchain',
      path: '/api/v1/blockchain',
      target: 'http://localhost:3001',
      healthCheckPath: '/health',
      timeout: 30000,
      retries: 3,
      circuitBreaker: {
        failureThreshold: 5,
        recoveryTimeout: 60000,
        monitoringPeriod: 10000
      }
    },
    {
      name: 'matching',
      path: '/api/v1/matching',
      target: 'http://localhost:3002',
      healthCheckPath: '/health',
      timeout: 10000,
      retries: 2,
      circuitBreaker: {
        failureThreshold: 3,
        recoveryTimeout: 30000,
        monitoringPeriod: 5000
      }
    },
    {
      name: 'validator',
      path: '/api/v1/validators',
      target: 'http://localhost:3003',
      healthCheckPath: '/health',
      timeout: 15000,
      retries: 3
    }
  ]
};

// 示例使用
export async function startGateway(config: APIGatewayConfig = defaultGatewayConfig) {
  const gateway = new APIGateway(config);
  
  // 优雅关闭处理
  process.on('SIGTERM', async () => {
    await gateway.stop();
    process.exit(0);
  });
  
  process.on('SIGINT', async () => {
    await gateway.stop();
    process.exit(0);
  });
  
  // 启动网关
  await gateway.start();
  return gateway;
}