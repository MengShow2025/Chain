/**
 * TitanChain API Types and Response Formats / TitanChain API类型和响应格式
 * Unified API response structure and error handling / 统一的API响应结构和错误处理
 */

// Standard API Response Format / 标准API响应格式
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: number;
  requestId?: string;
}

// Paginated Response Format / 分页响应格式
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Error Response Format / 错误响应格式
export interface ErrorResponse extends ApiResponse<null> {
  success: false;
  error: string;
  errorCode?: string;
  details?: any;
  stack?: string; // Only in development / 仅在开发环境
}

// HTTP Status Codes / HTTP状态码
export const HTTP_STATUS = {
  // Success / 成功
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  
  // Client Errors / 客户端错误
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  
  // Server Errors / 服务器错误
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
} as const;

// Error Codes / 错误代码
export const ERROR_CODES = {
  // Authentication / 认证
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS',
  
  // Validation / 验证
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',
  
  // Business Logic / 业务逻辑
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS: 'RESOURCE_ALREADY_EXISTS',
  
  // System / 系统
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  TIMEOUT: 'TIMEOUT',
  
  // Blockchain / 区块链
  INVALID_TRANSACTION: 'INVALID_TRANSACTION',
  BLOCK_NOT_FOUND: 'BLOCK_NOT_FOUND',
  VALIDATOR_NOT_FOUND: 'VALIDATOR_NOT_FOUND',
  NETWORK_CONGESTION: 'NETWORK_CONGESTION',
  
  // Security / 安全
  SECURITY_VIOLATION: 'SECURITY_VIOLATION',
  THREAT_DETECTED: 'THREAT_DETECTED',
  ACCESS_DENIED: 'ACCESS_DENIED',
  
  // MPC / 多方计算
  MPC_SESSION_NOT_FOUND: 'MPC_SESSION_NOT_FOUND',
  MPC_PARTICIPANT_OFFLINE: 'MPC_PARTICIPANT_OFFLINE',
  MPC_PROTOCOL_FAILED: 'MPC_PROTOCOL_FAILED',
  
  // Sharding / 分片
  SHARD_NOT_FOUND: 'SHARD_NOT_FOUND',
  CROSS_SHARD_ERROR: 'CROSS_SHARD_ERROR',
  REBALANCING_IN_PROGRESS: 'REBALANCING_IN_PROGRESS'
} as const;

// Request Validation Types / 请求验证类型
export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

export interface PaginationParams {
  page: number;
  limit: number;
  offset?: number;
}

// API Endpoint Categories / API端点分类
export const API_CATEGORIES = {
  AUTH: '/api/auth',
  BLOCKCHAIN: '/api/blockchain',
  TRANSACTIONS: '/api/transactions',
  BLOCKS: '/api/blocks',
  VALIDATORS: '/api/validators',
  WALLET: '/api/wallet',
  SECURITY: '/api/security',
  EXPLORER: '/api/explorer',
  MARGIN: '/api/margin',
  MATCHING: '/api/matching',
  GATEWAY: '/api/gateway'
} as const;

// Rate Limiting Types / 限流类型
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

// Health Check Types / 健康检查类型
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  uptime: number;
  version: string;
  services: Record<string, ServiceHealth>;
}

export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  lastCheck: number;
  error?: string;
}

// WebSocket Message Types / WebSocket消息类型
export interface WSMessage<T = any> {
  type: string;
  data: T;
  timestamp: number;
  id?: string;
}

export interface WSErrorMessage extends WSMessage {
  type: 'error';
  data: {
    error: string;
    code?: string;
    details?: any;
  };
}

// Metrics and Analytics / 指标和分析
export interface APIMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
  uptime: number;
}

export interface EndpointMetrics {
  endpoint: string;
  method: string;
  totalRequests: number;
  averageResponseTime: number;
  errorRate: number;
  lastAccessed: number;
}