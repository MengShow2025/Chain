/**
 * Enhanced Error Handler for TitanChain API Gateway
 * 增强的TitanChain API网关错误处理器
 */

import { Request, Response, NextFunction } from 'express';
import { EventEmitter } from 'events';

// Error types / 错误类型
export enum ErrorType {
  NETWORK_ERROR = 'network_error',
  TIMEOUT_ERROR = 'timeout_error',
  SERVICE_UNAVAILABLE = 'service_unavailable',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  AUTHENTICATION_ERROR = 'authentication_error',
  AUTHORIZATION_ERROR = 'authorization_error',
  VALIDATION_ERROR = 'validation_error',
  INTERNAL_ERROR = 'internal_error',
  CIRCUIT_BREAKER_OPEN = 'circuit_breaker_open',
  UPSTREAM_ERROR = 'upstream_error'
}

// Error severity levels / 错误严重级别
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Enhanced error interface / 增强的错误接口
export interface EnhancedError extends Error {
  type: ErrorType;
  severity: ErrorSeverity;
  statusCode: number;
  service?: string;
  timestamp: number;
  requestId?: string;
  userId?: string;
  retryable: boolean;
  context?: any;
}

// Retry configuration / 重试配置
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitterEnabled: boolean;
  retryableErrors: ErrorType[];
}

// Error handler configuration / 错误处理器配置
export interface ErrorHandlerConfig {
  enableLogging: boolean;
  enableMetrics: boolean;
  enableAlerts: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  retryConfig: RetryConfig;
  circuitBreakerConfig: {
    enabled: boolean;
    failureThreshold: number;
    resetTimeout: number;
  };
}

// Default configurations / 默认配置
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second / 1秒
  maxDelay: 30000, // 30 seconds / 30秒
  backoffMultiplier: 2,
  jitterEnabled: true,
  retryableErrors: [
    ErrorType.NETWORK_ERROR,
    ErrorType.TIMEOUT_ERROR,
    ErrorType.SERVICE_UNAVAILABLE,
    ErrorType.UPSTREAM_ERROR
  ]
};

export const DEFAULT_ERROR_HANDLER_CONFIG: ErrorHandlerConfig = {
  enableLogging: true,
  enableMetrics: true,
  enableAlerts: true,
  logLevel: 'error',
  retryConfig: DEFAULT_RETRY_CONFIG,
  circuitBreakerConfig: {
    enabled: true,
    failureThreshold: 5,
    resetTimeout: 60000 // 1 minute / 1分钟
  }
};

/**
 * Enhanced Error Handler class / 增强的错误处理器类
 */
export class EnhancedErrorHandler extends EventEmitter {
  private config: ErrorHandlerConfig;
  private errorStats: Map<string, any> = new Map();
  private retryAttempts: Map<string, number> = new Map();

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_ERROR_HANDLER_CONFIG, ...config };
  }

  /**
   * Create enhanced error / 创建增强错误
   */
  createError(
    message: string,
    type: ErrorType,
    severity: ErrorSeverity,
    statusCode: number,
    options: Partial<EnhancedError> = {}
  ): EnhancedError {
    const error = new Error(message) as EnhancedError;
    error.type = type;
    error.severity = severity;
    error.statusCode = statusCode;
    error.timestamp = Date.now();
    error.retryable = this.isRetryableError(type);
    
    // Add optional properties / 添加可选属性
    Object.assign(error, options);
    
    return error;
  }

  /**
   * Handle error with retry logic / 使用重试逻辑处理错误
   */
  async handleErrorWithRetry<T>(
    operation: () => Promise<T>,
    context: any = {},
    customRetryConfig?: Partial<RetryConfig>
  ): Promise<T> {
    const retryConfig = { ...this.config.retryConfig, ...customRetryConfig };
    const operationId = this.generateOperationId(context);
    
    let lastError: EnhancedError;
    
    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        const result = await operation();
        
        // Reset retry count on success / 成功时重置重试计数
        this.retryAttempts.delete(operationId);
        
        return result;
      } catch (error) {
        lastError = this.enhanceError(error as Error, context);
        
        // Log error / 记录错误
        this.logError(lastError, attempt);
        
        // Check if error is retryable / 检查错误是否可重试
        if (!this.shouldRetry(lastError, attempt, retryConfig)) {
          break;
        }
        
        // Calculate delay / 计算延迟
        const delay = this.calculateDelay(attempt, retryConfig);
        
        // Wait before retry / 重试前等待
        await this.sleep(delay);
        
        // Update retry attempts / 更新重试次数
        this.retryAttempts.set(operationId, attempt + 1);
      }
    }
    
    // All retries exhausted / 所有重试都用尽
    this.handleFinalError(lastError!, context);
    throw lastError!;
  }

  /**
   * Express middleware for error handling / Express错误处理中间件
   */
  middleware() {
    return (error: Error, req: Request, res: Response, next: NextFunction) => {
      const enhancedError = this.enhanceError(error, {
        requestId: req.headers['x-request-id'] as string,
        userId: req.headers['x-user-id'] as string,
        path: req.path,
        method: req.method
      });

      // Log error / 记录错误
      this.logError(enhancedError);

      // Update metrics / 更新指标
      this.updateErrorMetrics(enhancedError);

      // Send error response / 发送错误响应
      this.sendErrorResponse(res, enhancedError);
    };
  }

  /**
   * Enhance existing error / 增强现有错误
   */
  private enhanceError(error: Error, context: any = {}): EnhancedError {
    if (this.isEnhancedError(error)) {
      return error as EnhancedError;
    }

    const enhancedError = error as EnhancedError;
    enhancedError.type = this.determineErrorType(error);
    enhancedError.severity = this.determineSeverity(enhancedError.type);
    enhancedError.statusCode = this.determineStatusCode(enhancedError.type);
    enhancedError.timestamp = Date.now();
    enhancedError.retryable = this.isRetryableError(enhancedError.type);
    enhancedError.context = context;

    return enhancedError;
  }

  /**
   * Determine error type from error message / 从错误消息确定错误类型
   */
  private determineErrorType(error: Error): ErrorType {
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout')) return ErrorType.TIMEOUT_ERROR;
    if (message.includes('network') || message.includes('econnrefused')) return ErrorType.NETWORK_ERROR;
    if (message.includes('rate limit')) return ErrorType.RATE_LIMIT_EXCEEDED;
    if (message.includes('unauthorized')) return ErrorType.AUTHENTICATION_ERROR;
    if (message.includes('forbidden')) return ErrorType.AUTHORIZATION_ERROR;
    if (message.includes('validation')) return ErrorType.VALIDATION_ERROR;
    if (message.includes('service unavailable')) return ErrorType.SERVICE_UNAVAILABLE;
    if (message.includes('circuit breaker')) return ErrorType.CIRCUIT_BREAKER_OPEN;
    
    return ErrorType.INTERNAL_ERROR;
  }

  /**
   * Determine error severity / 确定错误严重性
   */
  private determineSeverity(type: ErrorType): ErrorSeverity {
    switch (type) {
      case ErrorType.VALIDATION_ERROR:
      case ErrorType.AUTHENTICATION_ERROR:
      case ErrorType.AUTHORIZATION_ERROR:
        return ErrorSeverity.LOW;
      
      case ErrorType.RATE_LIMIT_EXCEEDED:
      case ErrorType.TIMEOUT_ERROR:
        return ErrorSeverity.MEDIUM;
      
      case ErrorType.SERVICE_UNAVAILABLE:
      case ErrorType.CIRCUIT_BREAKER_OPEN:
      case ErrorType.NETWORK_ERROR:
        return ErrorSeverity.HIGH;
      
      case ErrorType.INTERNAL_ERROR:
      case ErrorType.UPSTREAM_ERROR:
        return ErrorSeverity.CRITICAL;
      
      default:
        return ErrorSeverity.MEDIUM;
    }
  }

  /**
   * Determine HTTP status code / 确定HTTP状态码
   */
  private determineStatusCode(type: ErrorType): number {
    switch (type) {
      case ErrorType.VALIDATION_ERROR:
        return 400;
      case ErrorType.AUTHENTICATION_ERROR:
        return 401;
      case ErrorType.AUTHORIZATION_ERROR:
        return 403;
      case ErrorType.TIMEOUT_ERROR:
        return 408;
      case ErrorType.RATE_LIMIT_EXCEEDED:
        return 429;
      case ErrorType.INTERNAL_ERROR:
        return 500;
      case ErrorType.SERVICE_UNAVAILABLE:
      case ErrorType.CIRCUIT_BREAKER_OPEN:
        return 503;
      case ErrorType.NETWORK_ERROR:
      case ErrorType.UPSTREAM_ERROR:
        return 502;
      default:
        return 500;
    }
  }

  /**
   * Check if error is retryable / 检查错误是否可重试
   */
  private isRetryableError(type: ErrorType): boolean {
    return this.config.retryConfig.retryableErrors.includes(type);
  }

  /**
   * Check if should retry / 检查是否应该重试
   */
  private shouldRetry(error: EnhancedError, attempt: number, config: RetryConfig): boolean {
    if (attempt >= config.maxRetries) return false;
    if (!error.retryable) return false;
    if (!config.retryableErrors.includes(error.type)) return false;
    
    return true;
  }

  /**
   * Calculate retry delay with exponential backoff / 使用指数退避计算重试延迟
   */
  private calculateDelay(attempt: number, config: RetryConfig): number {
    let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt);
    delay = Math.min(delay, config.maxDelay);
    
    // Add jitter to prevent thundering herd / 添加抖动以防止惊群效应
    if (config.jitterEnabled) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }
    
    return Math.floor(delay);
  }

  /**
   * Sleep for specified duration / 休眠指定时间
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate operation ID / 生成操作ID
   */
  private generateOperationId(context: any): string {
    return `${context.requestId || 'unknown'}_${Date.now()}_${Math.random()}`;
  }

  /**
   * Check if error is already enhanced / 检查错误是否已增强
   */
  private isEnhancedError(error: Error): boolean {
    return 'type' in error && 'severity' in error && 'statusCode' in error;
  }

  /**
   * Log error / 记录错误
   */
  private logError(error: EnhancedError, attempt?: number): void {
    if (!this.config.enableLogging) return;

    const logData = {
      message: error.message,
      type: error.type,
      severity: error.severity,
      statusCode: error.statusCode,
      timestamp: error.timestamp,
      attempt: attempt !== undefined ? attempt + 1 : undefined,
      context: error.context,
      stack: error.stack
    };

    console.error(`[${error.severity.toUpperCase()}] ${error.type}:`, logData);
  }

  /**
   * Update error metrics / 更新错误指标
   */
  private updateErrorMetrics(error: EnhancedError): void {
    if (!this.config.enableMetrics) return;

    const key = `${error.type}_${error.severity}`;
    const stats = this.errorStats.get(key) || { count: 0, lastOccurrence: 0 };
    
    stats.count++;
    stats.lastOccurrence = error.timestamp;
    
    this.errorStats.set(key, stats);
    
    // Emit metrics event / 发出指标事件
    this.emit('error_metric', { error, stats });
  }

  /**
   * Handle final error after all retries / 处理所有重试后的最终错误
   */
  private handleFinalError(error: EnhancedError, context: any): void {
    // Emit alert for critical errors / 为关键错误发出警报
    if (error.severity === ErrorSeverity.CRITICAL && this.config.enableAlerts) {
      this.emit('critical_error', { error, context });
    }
    
    // Update final error stats / 更新最终错误统计
    this.updateErrorMetrics(error);
  }

  /**
   * Send error response / 发送错误响应
   */
  private sendErrorResponse(res: Response, error: EnhancedError): void {
    const response = {
      error: {
        type: error.type,
        message: error.message,
        statusCode: error.statusCode,
        timestamp: error.timestamp,
        requestId: error.context?.requestId
      }
    };

    // Don't expose internal details in production / 生产环境不暴露内部详情
    if (process.env.NODE_ENV !== 'production') {
      response.error = { ...response.error, ...{ stack: error.stack, context: error.context } };
    }

    res.status(error.statusCode).json(response);
  }

  /**
   * Get error statistics / 获取错误统计
   */
  getErrorStats(): Map<string, any> {
    return new Map(this.errorStats);
  }

  /**
   * Reset error statistics / 重置错误统计
   */
  resetErrorStats(): void {
    this.errorStats.clear();
    this.retryAttempts.clear();
  }

  /**
   * Update configuration / 更新配置
   */
  updateConfig(newConfig: Partial<ErrorHandlerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

export default EnhancedErrorHandler;