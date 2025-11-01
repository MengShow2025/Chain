import { EventEmitter } from 'events';

/**
 * 健康检查结果
 */
export interface HealthCheckResult {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime: number;
  timestamp: number;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * 健康检查配置
 */
export interface HealthCheckConfig {
  name: string;
  url?: string;
  method?: 'GET' | 'POST' | 'HEAD';
  timeout: number;
  interval: number;
  retries: number;
  retryDelay: number;
  expectedStatus?: number[];
  expectedBody?: string | RegExp;
  headers?: Record<string, string>;
  customCheck?: () => Promise<HealthCheckResult>;
}

/**
 * 系统健康检查项
 */
export interface SystemHealthCheck {
  name: string;
  check: () => Promise<HealthCheckResult>;
}

/**
 * 健康检查器类
 */
export class HealthChecker extends EventEmitter {
  private checks = new Map<string, HealthCheckConfig>();
  private results = new Map<string, HealthCheckResult>();
  private timers = new Map<string, NodeJS.Timeout>();
  private systemChecks = new Map<string, SystemHealthCheck>();

  constructor() {
    super();
    this.setupSystemChecks();
  }

  /**
   * 添加健康检查
   */
  addCheck(config: HealthCheckConfig): void {
    this.checks.set(config.name, config);
    this.startCheck(config.name);
    console.log(`✅ 健康检查已添加: ${config.name}`);
  }

  /**
   * 移除健康检查
   */
  removeCheck(name: string): void {
    this.stopCheck(name);
    this.checks.delete(name);
    this.results.delete(name);
    console.log(`❌ 健康检查已移除: ${name}`);
  }

  /**
   * 获取健康检查结果
   */
  getResult(name: string): HealthCheckResult | null {
    return this.results.get(name) || null;
  }

  /**
   * 获取所有健康检查结果
   */
  getAllResults(): HealthCheckResult[] {
    return Array.from(this.results.values());
  }

  /**
   * 获取整体健康状态
   */
  getOverallHealth(): {
    status: 'healthy' | 'unhealthy' | 'degraded';
    checks: HealthCheckResult[];
    summary: {
      total: number;
      healthy: number;
      unhealthy: number;
      degraded: number;
    };
  } {
    const results = this.getAllResults();
    const summary = {
      total: results.length,
      healthy: results.filter(r => r.status === 'healthy').length,
      unhealthy: results.filter(r => r.status === 'unhealthy').length,
      degraded: results.filter(r => r.status === 'degraded').length
    };

    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    
    if (summary.unhealthy > 0) {
      overallStatus = 'unhealthy';
    } else if (summary.degraded > 0) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      checks: results,
      summary
    };
  }

  /**
   * 执行单次健康检查
   */
  async performCheck(name: string): Promise<HealthCheckResult> {
    const config = this.checks.get(name);
    if (!config) {
      throw new Error(`健康检查不存在: ${name}`);
    }

    const startTime = Date.now();
    let result: HealthCheckResult;

    try {
      if (config.customCheck) {
        result = await config.customCheck();
      } else if (config.url) {
        result = await this.performHttpCheck(config);
      } else {
        throw new Error('未配置检查方法');
      }
    } catch (error) {
      result = {
        name: config.name,
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error)
      };
    }

    // 更新结果
    this.results.set(name, result);
    
    // 发出事件
    this.emit('checkCompleted', result);
    
    if (result.status !== 'healthy') {
      this.emit('checkFailed', result);
    }

    return result;
  }

  /**
   * 执行HTTP健康检查
   */
  private async performHttpCheck(config: HealthCheckConfig): Promise<HealthCheckResult> {
    const startTime = Date.now();
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= config.retries) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeout);

        const response = await fetch(config.url!, {
          method: config.method || 'GET',
          headers: config.headers,
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        const responseTime = Date.now() - startTime;

        // 检查状态码
        const expectedStatus = config.expectedStatus || [200];
        if (!expectedStatus.includes(response.status)) {
          throw new Error(`意外的状态码: ${response.status}`);
        }

        // 检查响应体
        if (config.expectedBody) {
          const body = await response.text();
          if (typeof config.expectedBody === 'string') {
            if (!body.includes(config.expectedBody)) {
              throw new Error('响应体不匹配');
            }
          } else if (config.expectedBody instanceof RegExp) {
            if (!config.expectedBody.test(body)) {
              throw new Error('响应体不匹配正则表达式');
            }
          }
        }

        return {
          name: config.name,
          status: 'healthy',
          responseTime,
          timestamp: Date.now(),
          metadata: {
            statusCode: response.status,
            attempt: attempt + 1
          }
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempt++;
        
        if (attempt <= config.retries) {
          await new Promise(resolve => setTimeout(resolve, config.retryDelay));
        }
      }
    }

    return {
      name: config.name,
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      timestamp: Date.now(),
      error: lastError?.message || '未知错误',
      metadata: {
        attempts: attempt
      }
    };
  }

  /**
   * 开始健康检查
   */
  private startCheck(name: string): void {
    const config = this.checks.get(name);
    if (!config) return;

    // 立即执行一次检查
    this.performCheck(name);

    // 设置定时检查
    const timer = setInterval(() => {
      this.performCheck(name);
    }, config.interval);

    this.timers.set(name, timer);
  }

  /**
   * 停止健康检查
   */
  private stopCheck(name: string): void {
    const timer = this.timers.get(name);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(name);
    }
  }

  /**
   * 设置系统健康检查
   */
  private setupSystemChecks(): void {
    // 内存使用检查
    this.systemChecks.set('memory', {
      name: 'memory',
      check: async () => {
        const memUsage = process.memoryUsage();
        const totalMem = memUsage.heapTotal;
        const usedMem = memUsage.heapUsed;
        const memoryUsagePercent = (usedMem / totalMem) * 100;

        let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
        if (memoryUsagePercent > 90) {
          status = 'unhealthy';
        } else if (memoryUsagePercent > 75) {
          status = 'degraded';
        }

        return {
          name: 'memory',
          status,
          responseTime: 0,
          timestamp: Date.now(),
          metadata: {
            heapUsed: usedMem,
            heapTotal: totalMem,
            usagePercent: memoryUsagePercent.toFixed(2),
            external: memUsage.external,
            arrayBuffers: memUsage.arrayBuffers
          }
        };
      }
    });

    // CPU使用检查
    this.systemChecks.set('cpu', {
      name: 'cpu',
      check: async () => {
        const startUsage = process.cpuUsage();
        await new Promise(resolve => setTimeout(resolve, 100));
        const endUsage = process.cpuUsage(startUsage);
        
        const totalUsage = (endUsage.user + endUsage.system) / 1000; // 转换为毫秒
        const cpuPercent = (totalUsage / 100) * 100; // 简化计算

        let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
        if (cpuPercent > 90) {
          status = 'unhealthy';
        } else if (cpuPercent > 75) {
          status = 'degraded';
        }

        return {
          name: 'cpu',
          status,
          responseTime: 100,
          timestamp: Date.now(),
          metadata: {
            user: endUsage.user,
            system: endUsage.system,
            total: totalUsage,
            percent: cpuPercent.toFixed(2)
          }
        };
      }
    });

    // 事件循环延迟检查
    this.systemChecks.set('eventLoop', {
      name: 'eventLoop',
      check: async () => {
        const start = Date.now();
        await new Promise(resolve => setImmediate(resolve));
        const delay = Date.now() - start;

        let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
        if (delay > 100) {
          status = 'unhealthy';
        } else if (delay > 50) {
          status = 'degraded';
        }

        return {
          name: 'eventLoop',
          status,
          responseTime: delay,
          timestamp: Date.now(),
          metadata: {
            delay,
            uptime: process.uptime()
          }
        };
      }
    });

    // 添加系统检查
    for (const [name, systemCheck] of this.systemChecks.entries()) {
      this.addCheck({
        name,
        timeout: 5000,
        interval: 30000,
        retries: 0,
        retryDelay: 0,
        customCheck: systemCheck.check
      });
    }
  }

  /**
   * 获取系统指标
   */
  getSystemMetrics() {
    const memUsage = process.memoryUsage();
    
    return {
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        arrayBuffers: memUsage.arrayBuffers,
        rss: memUsage.rss
      },
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        version: process.version,
        platform: process.platform,
        arch: process.arch
      },
      timestamp: Date.now()
    };
  }

  /**
   * 创建Express健康检查端点
   */
  createExpressEndpoint() {
    return async (req: any, res: any) => {
      try {
        const health = this.getOverallHealth();
        const systemMetrics = this.getSystemMetrics();
        
        const statusCode = health.status === 'healthy' ? 200 : 
                          health.status === 'degraded' ? 200 : 503;
        
        res.status(statusCode).json({
          status: health.status,
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          checks: health.checks,
          summary: health.summary,
          system: systemMetrics
        });
      } catch (error) {
        res.status(500).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : String(error)
        });
      }
    };
  }

  /**
   * 停止所有健康检查
   */
  stop(): void {
    for (const name of this.checks.keys()) {
      this.stopCheck(name);
    }
    this.checks.clear();
    this.results.clear();
    this.timers.clear();
    this.emit('stopped');
    console.log('🛑 健康检查器已停止');
  }
}

/**
 * 创建常用的健康检查配置
 */
export class HealthCheckFactory {
  /**
   * 创建数据库健康检查
   */
  static database(name: string, connectionString: string): HealthCheckConfig {
    return {
      name,
      timeout: 5000,
      interval: 30000,
      retries: 2,
      retryDelay: 1000,
      customCheck: async () => {
        // 这里应该实现实际的数据库连接检查
        // 简化实现
        const startTime = Date.now();
        try {
          // 模拟数据库查询
          await new Promise(resolve => setTimeout(resolve, 10));
          
          return {
            name,
            status: 'healthy' as const,
            responseTime: Date.now() - startTime,
            timestamp: Date.now(),
            metadata: {
              connectionString: connectionString.replace(/\/\/.*@/, '//***@')
            }
          };
        } catch (error) {
          return {
            name,
            status: 'unhealthy' as const,
            responseTime: Date.now() - startTime,
            timestamp: Date.now(),
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }
    };
  }

  /**
   * 创建Redis健康检查
   */
  static redis(name: string, host: string, port: number): HealthCheckConfig {
    return {
      name,
      timeout: 3000,
      interval: 15000,
      retries: 1,
      retryDelay: 500,
      customCheck: async () => {
        const startTime = Date.now();
        try {
          // 这里应该实现实际的Redis连接检查
          // 简化实现
          await new Promise(resolve => setTimeout(resolve, 5));
          
          return {
            name,
            status: 'healthy' as const,
            responseTime: Date.now() - startTime,
            timestamp: Date.now(),
            metadata: { host, port }
          };
        } catch (error) {
          return {
            name,
            status: 'unhealthy' as const,
            responseTime: Date.now() - startTime,
            timestamp: Date.now(),
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }
    };
  }

  /**
   * 创建HTTP服务健康检查
   */
  static httpService(name: string, url: string): HealthCheckConfig {
    return {
      name,
      url,
      method: 'GET',
      timeout: 5000,
      interval: 30000,
      retries: 2,
      retryDelay: 1000,
      expectedStatus: [200, 204]
    };
  }

  /**
   * 创建磁盘空间健康检查
   */
  static diskSpace(name: string, path: string, threshold: number = 90): HealthCheckConfig {
    return {
      name,
      timeout: 1000,
      interval: 60000,
      retries: 0,
      retryDelay: 0,
      customCheck: async () => {
        const startTime = Date.now();
        try {
          // 这里应该实现实际的磁盘空间检查
          // 简化实现，返回模拟数据
          const usagePercent = Math.random() * 100;
          
          let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
          if (usagePercent > threshold) {
            status = 'unhealthy';
          } else if (usagePercent > threshold * 0.8) {
            status = 'degraded';
          }
          
          return {
            name,
            status,
            responseTime: Date.now() - startTime,
            timestamp: Date.now(),
            metadata: {
              path,
              usagePercent: usagePercent.toFixed(2),
              threshold
            }
          };
        } catch (error) {
          return {
            name,
            status: 'unhealthy' as const,
            responseTime: Date.now() - startTime,
            timestamp: Date.now(),
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }
    };
  }
}