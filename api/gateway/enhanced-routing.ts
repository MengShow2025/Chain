/**
 * Enhanced Routing System for TitanChain API Gateway
 * Implements intelligent routing with caching, load balancing, and metrics
 * 
 * Features / 功能特性:
 * - Smart Router with AI-based routing decisions / 基于AI的智能路由决策
 * - Route Caching for improved performance / 路由缓存提升性能
 * - Dynamic Load Balancing / 动态负载均衡
 * - Route Metrics and Monitoring / 路由指标监控
 * - Adaptive Retry Mechanism / 自适应重试机制
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';

// Types and Interfaces / 类型和接口
export interface RouteConfig {
  path: string;                    // Route path pattern / 路由路径模式
  method: string;                  // HTTP method / HTTP方法
  target: string;                  // Target service URL / 目标服务URL
  priority: number;                // Route priority (1-10) / 路由优先级(1-10)
  timeout: number;                 // Request timeout in ms / 请求超时时间(毫秒)
  retries: number;                 // Max retry attempts / 最大重试次数
  cache: boolean;                  // Enable caching / 启用缓存
  cacheTTL: number;               // Cache TTL in seconds / 缓存TTL(秒)
  rateLimit?: {                   // Rate limiting config / 限流配置
    requests: number;             // Requests per window / 窗口内请求数
    window: number;               // Time window in ms / 时间窗口(毫秒)
  };
  healthCheck?: {                 // Health check config / 健康检查配置
    enabled: boolean;             // Enable health checks / 启用健康检查
    interval: number;             // Check interval in ms / 检查间隔(毫秒)
    threshold: number;            // Failure threshold / 失败阈值
  };
}

export interface RouteMetrics {
  routeId: string;                // Route identifier / 路由标识
  requestCount: number;           // Total requests / 总请求数
  successCount: number;           // Successful requests / 成功请求数
  errorCount: number;             // Failed requests / 失败请求数
  averageResponseTime: number;    // Average response time / 平均响应时间
  lastRequestTime: number;        // Last request timestamp / 最后请求时间
  cacheHitRate: number;          // Cache hit rate / 缓存命中率
  loadScore: number;             // Current load score / 当前负载分数
}

export interface CacheEntry {
  key: string;                   // Cache key / 缓存键
  data: any;                     // Cached data / 缓存数据
  timestamp: number;             // Cache timestamp / 缓存时间戳
  ttl: number;                   // Time to live / 生存时间
  hits: number;                  // Cache hits / 缓存命中次数
}

export interface LoadBalancingStrategy {
  type: 'round_robin' | 'weighted' | 'least_connections' | 'response_time' | 'ai_optimized';
  weights?: Map<string, number>; // Service weights / 服务权重
  parameters?: any;              // Strategy-specific parameters / 策略特定参数
}

export interface RetryConfig {
  maxAttempts: number;           // Maximum retry attempts / 最大重试次数
  baseDelay: number;             // Base delay in ms / 基础延迟(毫秒)
  maxDelay: number;              // Maximum delay in ms / 最大延迟(毫秒)
  backoffMultiplier: number;     // Backoff multiplier / 退避乘数
  jitter: boolean;               // Add random jitter / 添加随机抖动
}

// Route Cache Implementation / 路由缓存实现
export class RouteCache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxSize: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(maxSize: number = 10000) {
    this.maxSize = maxSize;
    this.startCleanup();
  }

  // Set cache entry / 设置缓存条目
  set(key: string, data: any, ttl: number): void {
    // Remove oldest entries if cache is full / 如果缓存已满则移除最旧的条目
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    const entry: CacheEntry = {
      key,
      data,
      timestamp: Date.now(),
      ttl: ttl * 1000, // Convert to milliseconds / 转换为毫秒
      hits: 0
    };

    this.cache.set(key, entry);
  }

  // Get cache entry / 获取缓存条目
  get(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if entry has expired / 检查条目是否已过期
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Increment hit counter / 增加命中计数
    entry.hits++;
    return entry.data;
  }

  // Delete cache entry / 删除缓存条目
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  // Clear all cache / 清空所有缓存
  clear(): void {
    this.cache.clear();
  }

  // Get cache statistics / 获取缓存统计信息
  getStats(): any {
    const entries = Array.from(this.cache.values());
    const totalHits = entries.reduce((sum, entry) => sum + entry.hits, 0);
    const totalEntries = entries.length;

    return {
      totalEntries,
      totalHits,
      hitRate: totalEntries > 0 ? totalHits / totalEntries : 0,
      memoryUsage: this.cache.size,
      maxSize: this.maxSize
    };
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      
      for (const [key, entry] of this.cache.entries()) {
        if (now - entry.timestamp > entry.ttl) {
          this.cache.delete(key);
        }
      }
    }, 60000); // Cleanup every minute / 每分钟清理一次
  }

  // Cleanup resources / 清理资源
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }
}

// Dynamic Load Balancer / 动态负载均衡器
export class DynamicLoadBalancer {
  private services: Map<string, any> = new Map();
  private strategy: LoadBalancingStrategy;
  private metrics: Map<string, RouteMetrics> = new Map();
  private roundRobinIndex: number = 0;

  constructor(strategy: LoadBalancingStrategy) {
    this.strategy = strategy;
  }

  // Add service to load balancer / 添加服务到负载均衡器
  addService(id: string, config: any): void {
    this.services.set(id, {
      ...config,
      connections: 0,
      responseTime: 0,
      lastUsed: 0,
      healthy: true
    });

    // Initialize metrics / 初始化指标
    this.metrics.set(id, {
      routeId: id,
      requestCount: 0,
      successCount: 0,
      errorCount: 0,
      averageResponseTime: 0,
      lastRequestTime: 0,
      cacheHitRate: 0,
      loadScore: 0
    });
  }

  // Remove service from load balancer / 从负载均衡器移除服务
  removeService(id: string): void {
    this.services.delete(id);
    this.metrics.delete(id);
  }

  // Select best service based on strategy / 根据策略选择最佳服务
  selectService(): string | null {
    const healthyServices = Array.from(this.services.entries())
      .filter(([_, service]) => service.healthy);

    if (healthyServices.length === 0) {
      return null;
    }

    switch (this.strategy.type) {
      case 'round_robin':
        return this.roundRobinSelection(healthyServices);
      
      case 'weighted':
        return this.weightedSelection(healthyServices);
      
      case 'least_connections':
        return this.leastConnectionsSelection(healthyServices);
      
      case 'response_time':
        return this.responseTimeSelection(healthyServices);
      
      case 'ai_optimized':
        return this.aiOptimizedSelection(healthyServices);
      
      default:
        return this.roundRobinSelection(healthyServices);
    }
  }

  // Update service metrics / 更新服务指标
  updateMetrics(serviceId: string, responseTime: number, success: boolean): void {
    const service = this.services.get(serviceId);
    const metrics = this.metrics.get(serviceId);

    if (service && metrics) {
      // Update service stats / 更新服务统计
      service.responseTime = (service.responseTime + responseTime) / 2;
      service.lastUsed = Date.now();

      // Update metrics / 更新指标
      metrics.requestCount++;
      metrics.lastRequestTime = Date.now();
      
      if (success) {
        metrics.successCount++;
      } else {
        metrics.errorCount++;
      }

      // Calculate average response time / 计算平均响应时间
      metrics.averageResponseTime = (metrics.averageResponseTime + responseTime) / 2;
      
      // Calculate load score / 计算负载分数
      metrics.loadScore = this.calculateLoadScore(serviceId);
    }
  }

  private roundRobinSelection(services: [string, any][]): string {
    const selectedService = services[this.roundRobinIndex % services.length];
    this.roundRobinIndex++;
    return selectedService[0];
  }

  private weightedSelection(services: [string, any][]): string {
    const weights = this.strategy.weights || new Map();
    let totalWeight = 0;
    
    for (const [serviceId] of services) {
      totalWeight += weights.get(serviceId) || 1;
    }

    let random = Math.random() * totalWeight;
    
    for (const [serviceId] of services) {
      const weight = weights.get(serviceId) || 1;
      random -= weight;
      
      if (random <= 0) {
        return serviceId;
      }
    }

    return services[0][0]; // Fallback / 回退
  }

  private leastConnectionsSelection(services: [string, any][]): string {
    let minConnections = Infinity;
    let selectedService = services[0][0];

    for (const [serviceId, service] of services) {
      if (service.connections < minConnections) {
        minConnections = service.connections;
        selectedService = serviceId;
      }
    }

    return selectedService;
  }

  private responseTimeSelection(services: [string, any][]): string {
    let minResponseTime = Infinity;
    let selectedService = services[0][0];

    for (const [serviceId, service] of services) {
      if (service.responseTime < minResponseTime) {
        minResponseTime = service.responseTime;
        selectedService = serviceId;
      }
    }

    return selectedService;
  }

  private aiOptimizedSelection(services: [string, any][]): string {
    // AI-based selection using multiple factors / 基于AI的多因素选择
    let bestScore = -Infinity;
    let selectedService = services[0][0];

    for (const [serviceId, service] of services) {
      const metrics = this.metrics.get(serviceId);
      if (!metrics) continue;

      // Calculate composite score / 计算综合分数
      const responseTimeScore = 1 / (service.responseTime + 1);
      const connectionScore = 1 / (service.connections + 1);
      const successRateScore = metrics.successCount / (metrics.requestCount || 1);
      const loadScore = 1 / (metrics.loadScore + 1);

      const compositeScore = (
        responseTimeScore * 0.3 +
        connectionScore * 0.2 +
        successRateScore * 0.3 +
        loadScore * 0.2
      );

      if (compositeScore > bestScore) {
        bestScore = compositeScore;
        selectedService = serviceId;
      }
    }

    return selectedService;
  }

  private calculateLoadScore(serviceId: string): number {
    const service = this.services.get(serviceId);
    const metrics = this.metrics.get(serviceId);

    if (!service || !metrics) return 0;

    // Calculate load based on multiple factors / 基于多个因素计算负载
    const connectionLoad = service.connections / 100; // Normalize to 0-1 / 标准化到0-1
    const responseTimeLoad = service.responseTime / 1000; // Normalize to 0-1 / 标准化到0-1
    const errorRate = metrics.errorCount / (metrics.requestCount || 1);

    return connectionLoad * 0.4 + responseTimeLoad * 0.4 + errorRate * 0.2;
  }

  // Get load balancer statistics / 获取负载均衡器统计信息
  getStats(): any {
    const serviceStats = Array.from(this.services.entries()).map(([id, service]) => ({
      id,
      connections: service.connections,
      responseTime: service.responseTime,
      healthy: service.healthy,
      metrics: this.metrics.get(id)
    }));

    return {
      strategy: this.strategy.type,
      totalServices: this.services.size,
      healthyServices: serviceStats.filter(s => s.healthy).length,
      services: serviceStats
    };
  }
}

// Route Metrics Collector / 路由指标收集器
export class RouteMetrics {
  private metrics: Map<string, RouteMetrics> = new Map();
  private eventEmitter: EventEmitter;

  constructor() {
    this.eventEmitter = new EventEmitter();
  }

  // Record request metrics / 记录请求指标
  recordRequest(routeId: string, responseTime: number, success: boolean, cached: boolean = false): void {
    let metrics = this.metrics.get(routeId);
    
    if (!metrics) {
      metrics = {
        routeId,
        requestCount: 0,
        successCount: 0,
        errorCount: 0,
        averageResponseTime: 0,
        lastRequestTime: 0,
        cacheHitRate: 0,
        loadScore: 0
      };
      this.metrics.set(routeId, metrics);
    }

    // Update metrics / 更新指标
    metrics.requestCount++;
    metrics.lastRequestTime = Date.now();

    if (success) {
      metrics.successCount++;
    } else {
      metrics.errorCount++;
    }

    // Update average response time / 更新平均响应时间
    metrics.averageResponseTime = (
      (metrics.averageResponseTime * (metrics.requestCount - 1) + responseTime) / 
      metrics.requestCount
    );

    // Update cache hit rate / 更新缓存命中率
    if (cached) {
      const cacheHits = metrics.cacheHitRate * (metrics.requestCount - 1) + 1;
      metrics.cacheHitRate = cacheHits / metrics.requestCount;
    } else {
      metrics.cacheHitRate = (metrics.cacheHitRate * (metrics.requestCount - 1)) / metrics.requestCount;
    }

    // Calculate load score / 计算负载分数
    metrics.loadScore = this.calculateLoadScore(metrics);

    // Emit metrics event / 发出指标事件
    this.eventEmitter.emit('metrics_updated', { routeId, metrics });
  }

  // Get metrics for route / 获取路由指标
  getMetrics(routeId: string): RouteMetrics | null {
    return this.metrics.get(routeId) || null;
  }

  // Get all metrics / 获取所有指标
  getAllMetrics(): Map<string, RouteMetrics> {
    return new Map(this.metrics);
  }

  // Get aggregated statistics / 获取聚合统计信息
  getAggregatedStats(): any {
    const allMetrics = Array.from(this.metrics.values());
    
    if (allMetrics.length === 0) {
      return {
        totalRequests: 0,
        totalSuccess: 0,
        totalErrors: 0,
        averageResponseTime: 0,
        overallCacheHitRate: 0,
        averageLoadScore: 0
      };
    }

    const totalRequests = allMetrics.reduce((sum, m) => sum + m.requestCount, 0);
    const totalSuccess = allMetrics.reduce((sum, m) => sum + m.successCount, 0);
    const totalErrors = allMetrics.reduce((sum, m) => sum + m.errorCount, 0);
    
    const weightedResponseTime = allMetrics.reduce((sum, m) => 
      sum + (m.averageResponseTime * m.requestCount), 0
    );
    
    const weightedCacheHitRate = allMetrics.reduce((sum, m) => 
      sum + (m.cacheHitRate * m.requestCount), 0
    );

    return {
      totalRequests,
      totalSuccess,
      totalErrors,
      successRate: totalRequests > 0 ? totalSuccess / totalRequests : 0,
      averageResponseTime: totalRequests > 0 ? weightedResponseTime / totalRequests : 0,
      overallCacheHitRate: totalRequests > 0 ? weightedCacheHitRate / totalRequests : 0,
      averageLoadScore: allMetrics.reduce((sum, m) => sum + m.loadScore, 0) / allMetrics.length
    };
  }

  private calculateLoadScore(metrics: RouteMetrics): number {
    const errorRate = metrics.errorCount / (metrics.requestCount || 1);
    const responseTimeScore = Math.min(metrics.averageResponseTime / 1000, 1); // Normalize to 0-1 / 标准化到0-1
    
    return errorRate * 0.6 + responseTimeScore * 0.4;
  }

  // Subscribe to metrics events / 订阅指标事件
  on(event: string, callback: (data: any) => void): void {
    this.eventEmitter.on(event, callback);
  }
}

// Adaptive Retry Mechanism / 自适应重试机制
export class AdaptiveRetry {
  private retryConfigs: Map<string, RetryConfig> = new Map();
  private retryHistory: Map<string, number[]> = new Map();

  constructor() {
    // Default retry configuration / 默认重试配置
    this.setDefaultConfig({
      maxAttempts: 3,
      baseDelay: 100,
      maxDelay: 5000,
      backoffMultiplier: 2,
      jitter: true
    });
  }

  // Set default retry configuration / 设置默认重试配置
  setDefaultConfig(config: RetryConfig): void {
    this.retryConfigs.set('default', config);
  }

  // Set retry configuration for specific route / 为特定路由设置重试配置
  setRouteConfig(routeId: string, config: RetryConfig): void {
    this.retryConfigs.set(routeId, config);
  }

  // Calculate retry delay / 计算重试延迟
  calculateDelay(routeId: string, attempt: number): number {
    const config = this.retryConfigs.get(routeId) || this.retryConfigs.get('default')!;
    
    // Exponential backoff / 指数退避
    let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    
    // Apply maximum delay limit / 应用最大延迟限制
    delay = Math.min(delay, config.maxDelay);
    
    // Add jitter to prevent thundering herd / 添加抖动防止惊群效应
    if (config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }

    return Math.floor(delay);
  }

  // Check if retry should be attempted / 检查是否应该重试
  shouldRetry(routeId: string, attempt: number, error: any): boolean {
    const config = this.retryConfigs.get(routeId) || this.retryConfigs.get('default')!;
    
    // Check attempt limit / 检查尝试次数限制
    if (attempt >= config.maxAttempts) {
      return false;
    }

    // Check if error is retryable / 检查错误是否可重试
    if (this.isRetryableError(error)) {
      return true;
    }

    return false;
  }

  // Record retry attempt / 记录重试尝试
  recordRetry(routeId: string, success: boolean): void {
    let history = this.retryHistory.get(routeId) || [];
    
    // Add result to history (1 for success, 0 for failure) / 将结果添加到历史记录
    history.push(success ? 1 : 0);
    
    // Keep only last 100 attempts / 只保留最近100次尝试
    if (history.length > 100) {
      history = history.slice(-100);
    }
    
    this.retryHistory.set(routeId, history);
    
    // Adapt retry configuration based on success rate / 根据成功率调整重试配置
    this.adaptConfiguration(routeId, history);
  }

  private isRetryableError(error: any): boolean {
    // Define retryable error conditions / 定义可重试的错误条件
    const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
    const retryableErrorTypes = ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT'];

    if (error.status && retryableStatusCodes.includes(error.status)) {
      return true;
    }

    if (error.code && retryableErrorTypes.includes(error.code)) {
      return true;
    }

    return false;
  }

  private adaptConfiguration(routeId: string, history: number[]): void {
    if (history.length < 10) return; // Need sufficient data / 需要足够的数据

    const successRate = history.reduce((sum, result) => sum + result, 0) / history.length;
    const config = this.retryConfigs.get(routeId) || { ...this.retryConfigs.get('default')! };

    // Adapt based on success rate / 根据成功率进行调整
    if (successRate > 0.8) {
      // High success rate - reduce retry attempts / 高成功率 - 减少重试次数
      config.maxAttempts = Math.max(1, config.maxAttempts - 1);
      config.baseDelay = Math.max(50, config.baseDelay * 0.9);
    } else if (successRate < 0.5) {
      // Low success rate - increase retry attempts / 低成功率 - 增加重试次数
      config.maxAttempts = Math.min(5, config.maxAttempts + 1);
      config.baseDelay = Math.min(1000, config.baseDelay * 1.1);
    }

    this.retryConfigs.set(routeId, config);
  }

  // Get retry statistics / 获取重试统计信息
  getStats(): any {
    const stats: any = {};
    
    for (const [routeId, history] of this.retryHistory.entries()) {
      const successRate = history.reduce((sum, result) => sum + result, 0) / history.length;
      const config = this.retryConfigs.get(routeId);
      
      stats[routeId] = {
        totalAttempts: history.length,
        successRate,
        currentConfig: config
      };
    }

    return stats;
  }
}

// Smart Router Implementation / 智能路由器实现
export class SmartRouter {
  private routes: Map<string, RouteConfig> = new Map();
  private cache: RouteCache;
  private loadBalancer: DynamicLoadBalancer;
  private metrics: RouteMetrics;
  private retry: AdaptiveRetry;
  private eventEmitter: EventEmitter;

  constructor() {
    this.cache = new RouteCache();
    this.loadBalancer = new DynamicLoadBalancer({ type: 'ai_optimized' });
    this.metrics = new RouteMetrics();
    this.retry = new AdaptiveRetry();
    this.eventEmitter = new EventEmitter();

    this.setupEventHandlers();
  }

  // Add route configuration / 添加路由配置
  addRoute(id: string, config: RouteConfig): void {
    this.routes.set(id, config);
    this.loadBalancer.addService(id, config);
    
    console.log(`Smart Router: Added route ${id} -> ${config.target}`);
  }

  // Remove route configuration / 移除路由配置
  removeRoute(id: string): void {
    this.routes.delete(id);
    this.loadBalancer.removeService(id);
    
    console.log(`Smart Router: Removed route ${id}`);
  }

  // Route request intelligently / 智能路由请求
  async routeRequest(path: string, method: string, data?: any): Promise<any> {
    const startTime = Date.now();
    const routeId = this.findMatchingRoute(path, method);
    
    if (!routeId) {
      throw new Error(`No route found for ${method} ${path}`);
    }

    const route = this.routes.get(routeId)!;
    
    // Check cache first / 首先检查缓存
    if (route.cache && method === 'GET') {
      const cacheKey = this.generateCacheKey(path, method, data);
      const cachedResult = this.cache.get(cacheKey);
      
      if (cachedResult) {
        const responseTime = Date.now() - startTime;
        this.metrics.recordRequest(routeId, responseTime, true, true);
        return cachedResult;
      }
    }

    // Select best service / 选择最佳服务
    const selectedService = this.loadBalancer.selectService();
    if (!selectedService) {
      throw new Error('No healthy services available');
    }

    // Execute request with retry logic / 使用重试逻辑执行请求
    const result = await this.executeWithRetry(routeId, route, data);
    
    // Cache successful results / 缓存成功结果
    if (route.cache && method === 'GET' && result) {
      const cacheKey = this.generateCacheKey(path, method, data);
      this.cache.set(cacheKey, result, route.cacheTTL);
    }

    const responseTime = Date.now() - startTime;
    this.metrics.recordRequest(routeId, responseTime, true, false);
    this.loadBalancer.updateMetrics(selectedService, responseTime, true);

    return result;
  }

  private async executeWithRetry(routeId: string, route: RouteConfig, data?: any): Promise<any> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= route.retries + 1; attempt++) {
      try {
        // Simulate request execution / 模拟请求执行
        const result = await this.executeRequest(route, data);
        
        // Record successful retry / 记录成功重试
        if (attempt > 1) {
          this.retry.recordRetry(routeId, true);
        }
        
        return result;
      } catch (error) {
        lastError = error;
        
        // Check if we should retry / 检查是否应该重试
        if (attempt <= route.retries && this.retry.shouldRetry(routeId, attempt, error)) {
          const delay = this.retry.calculateDelay(routeId, attempt);
          console.log(`Smart Router: Retrying ${routeId} in ${delay}ms (attempt ${attempt})`);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // Record failed retry / 记录失败重试
        this.retry.recordRetry(routeId, false);
        break;
      }
    }

    throw lastError;
  }

  private async executeRequest(route: RouteConfig, data?: any): Promise<any> {
    // This is a mock implementation / 这是一个模拟实现
    // In real implementation, this would make HTTP requests / 在实际实现中，这里会发起HTTP请求
    
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Simulate random success/failure / 模拟随机成功/失败
        if (Math.random() > 0.1) { // 90% success rate / 90%成功率
          resolve({ 
            status: 'success', 
            data: { message: 'Request processed successfully', timestamp: Date.now() },
            route: route.target
          });
        } else {
          reject(new Error('Simulated request failure'));
        }
      }, Math.random() * 100 + 50); // Random delay 50-150ms / 随机延迟50-150毫秒
    });
  }

  private findMatchingRoute(path: string, method: string): string | null {
    for (const [routeId, route] of this.routes.entries()) {
      if (this.matchesRoute(path, method, route)) {
        return routeId;
      }
    }
    return null;
  }

  private matchesRoute(path: string, method: string, route: RouteConfig): boolean {
    // Simple pattern matching / 简单模式匹配
    const methodMatch = route.method === '*' || route.method.toUpperCase() === method.toUpperCase();
    const pathMatch = this.matchPath(path, route.path);
    
    return methodMatch && pathMatch;
  }

  private matchPath(requestPath: string, routePath: string): boolean {
    // Convert route pattern to regex / 将路由模式转换为正则表达式
    const pattern = routePath
      .replace(/\*/g, '.*')
      .replace(/:\w+/g, '[^/]+');
    
    const regex = new RegExp(`^${pattern}$`);
    return regex.test(requestPath);
  }

  private generateCacheKey(path: string, method: string, data?: any): string {
    const dataHash = data ? crypto.createHash('md5').update(JSON.stringify(data)).digest('hex') : '';
    return `${method}:${path}:${dataHash}`;
  }

  private setupEventHandlers(): void {
    // Handle metrics events / 处理指标事件
    this.metrics.on('metrics_updated', (data) => {
      this.eventEmitter.emit('route_metrics', data);
    });
  }

  // Get router statistics / 获取路由器统计信息
  getStats(): any {
    return {
      routes: this.routes.size,
      cache: this.cache.getStats(),
      loadBalancer: this.loadBalancer.getStats(),
      metrics: this.metrics.getAggregatedStats(),
      retry: this.retry.getStats()
    };
  }

  // Subscribe to router events / 订阅路由器事件
  on(event: string, callback: (data: any) => void): void {
    this.eventEmitter.on(event, callback);
  }

  // Cleanup resources / 清理资源
  destroy(): void {
    this.cache.destroy();
    console.log('Smart Router: Cleanup completed');
  }
}

// Factory function to create smart router / 创建智能路由器的工厂函数
export function createSmartRouter(): SmartRouter {
  return new SmartRouter();
}

// Export all components / 导出所有组件
export {
  RouteCache,
  DynamicLoadBalancer,
  RouteMetrics,
  AdaptiveRetry
};

export default SmartRouter;