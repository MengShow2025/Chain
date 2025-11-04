/**
 * Unified Error Handler Middleware / 统一错误处理中间件
 * Provides consistent error responses across all API endpoints / 为所有API端点提供一致的错误响应
 */

import { Request, Response, NextFunction } from 'express';
import { ApiResponse, ErrorResponse, HTTP_STATUS, ERROR_CODES } from '../../shared/types/api';

// Custom Error Classes / 自定义错误类
export class APIError extends Error {
  public statusCode: number;
  public errorCode: string;
  public details?: any;

  constructor(
    message: string,
    statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    errorCode: string = ERROR_CODES.INTERNAL_ERROR,
    details?: any
  ) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    
    // Maintain proper stack trace / 维护正确的堆栈跟踪
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, APIError);
    }
  }
}

export class ValidationError extends APIError {
  constructor(message: string, details?: any) {
    super(message, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.INVALID_INPUT, details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends APIError {
  constructor(message: string = 'Authentication required') {
    super(message, HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED_ACCESS);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends APIError {
  constructor(message: string = 'Access denied') {
    super(message, HTTP_STATUS.FORBIDDEN, ERROR_CODES.ACCESS_DENIED);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends APIError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, HTTP_STATUS.NOT_FOUND, ERROR_CODES.RESOURCE_NOT_FOUND);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends APIError {
  constructor(message: string = 'Resource already exists') {
    super(message, HTTP_STATUS.CONFLICT, ERROR_CODES.RESOURCE_ALREADY_EXISTS);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends APIError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, HTTP_STATUS.TOO_MANY_REQUESTS, ERROR_CODES.RATE_LIMIT_EXCEEDED);
    this.name = 'RateLimitError';
  }
}

export class ServiceUnavailableError extends APIError {
  constructor(message: string = 'Service temporarily unavailable') {
    super(message, HTTP_STATUS.SERVICE_UNAVAILABLE, ERROR_CODES.SERVICE_UNAVAILABLE);
    this.name = 'ServiceUnavailableError';
  }
}

// Error Handler Middleware / 错误处理中间件
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Generate request ID for tracking / 生成请求ID用于跟踪
  const requestId = req.headers['x-request-id'] as string || generateRequestId();
  
  // Log error with context / 记录错误及上下文
  console.error('API Error / API错误:', {
    requestId,
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    }
  });

  let statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR;
  let errorCode = ERROR_CODES.INTERNAL_ERROR;
  let message = 'Internal server error';
  let details: any = undefined;

  // Handle different error types / 处理不同类型的错误
  if (error instanceof APIError) {
    statusCode = error.statusCode;
    errorCode = error.errorCode;
    message = error.message;
    details = error.details;
  } else if (error.name === 'ValidationError') {
    statusCode = HTTP_STATUS.BAD_REQUEST;
    errorCode = ERROR_CODES.INVALID_INPUT;
    message = error.message;
  } else if (error.name === 'CastError') {
    statusCode = HTTP_STATUS.BAD_REQUEST;
    errorCode = ERROR_CODES.INVALID_FORMAT;
    message = 'Invalid ID format';
  } else if (error.name === 'MongoError' && (error as any).code === 11000) {
    statusCode = HTTP_STATUS.CONFLICT;
    errorCode = ERROR_CODES.RESOURCE_ALREADY_EXISTS;
    message = 'Resource already exists';
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = HTTP_STATUS.UNAUTHORIZED;
    errorCode = ERROR_CODES.INVALID_TOKEN;
    message = 'Invalid token';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = HTTP_STATUS.UNAUTHORIZED;
    errorCode = ERROR_CODES.TOKEN_EXPIRED;
    message = 'Token expired';
  }

  // Create error response / 创建错误响应
  const errorResponse: ErrorResponse = {
    success: false,
    error: message,
    errorCode,
    timestamp: Date.now(),
    requestId
  };

  // Add details in development mode / 在开发模式下添加详细信息
  if (process.env.NODE_ENV === 'development') {
    errorResponse.details = details;
    errorResponse.stack = error.stack;
  }

  // Send error response / 发送错误响应
  res.status(statusCode).json(errorResponse);
}

// 404 Handler / 404处理器
export function notFoundHandler(req: Request, res: Response): void {
  const requestId = req.headers['x-request-id'] as string || generateRequestId();
  
  const errorResponse: ErrorResponse = {
    success: false,
    error: `Endpoint not found: ${req.method} ${req.path}`,
    errorCode: ERROR_CODES.RESOURCE_NOT_FOUND,
    timestamp: Date.now(),
    requestId
  };

  res.status(HTTP_STATUS.NOT_FOUND).json(errorResponse);
}

// Success Response Helper / 成功响应助手
export function successResponse<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = HTTP_STATUS.OK
): void {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message,
    timestamp: Date.now()
  };

  res.status(statusCode).json(response);
}

// Async Handler Wrapper / 异步处理器包装器
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Request ID Generator / 请求ID生成器
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Request Logger Middleware / 请求日志中间件
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = generateRequestId();
  req.headers['x-request-id'] = requestId;
  
  const startTime = Date.now();
  
  // Log request / 记录请求
  console.log(`📥 ${req.method} ${req.url} - ${requestId} - ${req.ip}`);
  
  // Log response / 记录响应
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusColor = res.statusCode >= 400 ? '🔴' : '🟢';
    console.log(`📤 ${statusColor} ${res.statusCode} - ${duration}ms - ${requestId}`);
  });
  
  next();
}

// Validation Helper / 验证助手
export function validateRequired(fields: Record<string, any>): void {
  const missing: string[] = [];
  
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === '') {
      missing.push(key);
    }
  }
  
  if (missing.length > 0) {
    throw new ValidationError(
      `Missing required fields: ${missing.join(', ')}`,
      { missingFields: missing }
    );
  }
}

// Pagination Helper / 分页助手
export function validatePagination(page?: string, limit?: string): { page: number; limit: number; offset: number } {
  const pageNum = parseInt(page || '1', 10);
  const limitNum = parseInt(limit || '20', 10);
  
  if (pageNum < 1) {
    throw new ValidationError('Page must be greater than 0');
  }
  
  if (limitNum < 1 || limitNum > 100) {
    throw new ValidationError('Limit must be between 1 and 100');
  }
  
  return {
    page: pageNum,
    limit: limitNum,
    offset: (pageNum - 1) * limitNum
  };
}