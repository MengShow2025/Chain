/**
 * Authentication and Authorization Middleware / 认证和授权中间件
 * Handles JWT token validation, API key authentication, and role-based access control / 处理JWT令牌验证、API密钥认证和基于角色的访问控制
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticationError, AuthorizationError, ValidationError } from './error-handler';
import { HTTP_STATUS, ERROR_CODES } from '../../shared/types/api';

// User roles / 用户角色
export enum UserRole {
  ADMIN = 'admin',
  VALIDATOR = 'validator',
  USER = 'user',
  READONLY = 'readonly'
}

// Permission types / 权限类型
export enum Permission {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  ADMIN = 'admin'
}

// JWT Payload interface / JWT载荷接口
export interface JWTPayload {
  userId: string;
  role: UserRole;
  permissions: Permission[];
  sessionId?: string;
  iat: number;
  exp: number;
}

// Extended Request interface / 扩展请求接口
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
      userId?: string;
      apiKey?: string;
    }
  }
}

// JWT Secret (should be in environment variables) / JWT密钥（应该在环境变量中）
const JWT_SECRET = process.env.JWT_SECRET || 'titanchain-default-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// API Key validation / API密钥验证
const VALID_API_KEYS = new Set([
  process.env.ADMIN_API_KEY,
  process.env.VALIDATOR_API_KEY,
  process.env.USER_API_KEY
].filter(Boolean));

/**
 * JWT Token Authentication Middleware / JWT令牌认证中间件
 */
export function authenticateJWT(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    throw new AuthenticationError('Authorization header required');
  }

  const token = authHeader.startsWith('Bearer ') 
    ? authHeader.substring(7) 
    : authHeader;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    req.user = decoded;
    req.userId = decoded.userId;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthenticationError('Token expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new AuthenticationError('Invalid token');
    } else {
      throw new AuthenticationError('Token verification failed');
    }
  }
}

/**
 * API Key Authentication Middleware / API密钥认证中间件
 */
export function authenticateAPIKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    throw new AuthenticationError('API key required');
  }

  if (!VALID_API_KEYS.has(apiKey)) {
    throw new AuthenticationError('Invalid API key');
  }

  req.apiKey = apiKey;
  next();
}

/**
 * Optional Authentication Middleware / 可选认证中间件
 * Allows both authenticated and unauthenticated requests / 允许已认证和未认证的请求
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'] as string;

  try {
    if (authHeader) {
      const token = authHeader.startsWith('Bearer ') 
        ? authHeader.substring(7) 
        : authHeader;
      
      const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
      req.user = decoded;
      req.userId = decoded.userId;
    } else if (apiKey && VALID_API_KEYS.has(apiKey)) {
      req.apiKey = apiKey;
    }
    // Continue regardless of authentication status / 无论认证状态如何都继续
    next();
  } catch (error) {
    // Log error but don't block request / 记录错误但不阻止请求
    console.warn('Optional auth failed:', error.message);
    next();
  }
}

/**
 * Role-based Authorization Middleware / 基于角色的授权中间件
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    if (!roles.includes(req.user.role)) {
      throw new AuthorizationError(`Access denied. Required roles: ${roles.join(', ')}`);
    }

    next();
  };
}

/**
 * Permission-based Authorization Middleware / 基于权限的授权中间件
 */
export function requirePermission(...permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    const hasPermission = permissions.some(permission => 
      req.user!.permissions.includes(permission)
    );

    if (!hasPermission) {
      throw new AuthorizationError(`Access denied. Required permissions: ${permissions.join(', ')}`);
    }

    next();
  };
}

/**
 * Admin Only Middleware / 仅管理员中间件
 */
export function adminOnly(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    throw new AuthenticationError('Authentication required');
  }

  if (req.user.role !== UserRole.ADMIN) {
    throw new AuthorizationError('Admin access required');
  }

  next();
}

/**
 * User ID Validation Middleware / 用户ID验证中间件
 */
export function validateUserId(req: Request, res: Response, next: NextFunction): void {
  const userId = req.headers['x-user-id'] as string || req.user?.userId;
  
  if (!userId) {
    throw new ValidationError('User ID required');
  }

  req.userId = userId;
  next();
}

/**
 * Rate Limiting by User / 按用户限流
 */
const userRequestCounts = new Map<string, { count: number; resetTime: number }>();

export function rateLimitByUser(maxRequests: number = 100, windowMs: number = 60000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userId = req.userId || req.user?.userId || req.ip;
    const now = Date.now();
    
    const userLimit = userRequestCounts.get(userId);
    
    if (!userLimit || now > userLimit.resetTime) {
      // Reset or initialize counter / 重置或初始化计数器
      userRequestCounts.set(userId, {
        count: 1,
        resetTime: now + windowMs
      });
      next();
      return;
    }

    if (userLimit.count >= maxRequests) {
      const resetIn = Math.ceil((userLimit.resetTime - now) / 1000);
      res.set({
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': userLimit.resetTime.toString(),
        'Retry-After': resetIn.toString()
      });
      
      throw new AuthenticationError('Rate limit exceeded');
    }

    userLimit.count++;
    res.set({
      'X-RateLimit-Limit': maxRequests.toString(),
      'X-RateLimit-Remaining': (maxRequests - userLimit.count).toString(),
      'X-RateLimit-Reset': userLimit.resetTime.toString()
    });
    
    next();
  };
}

/**
 * Generate JWT Token / 生成JWT令牌
 */
export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify JWT Token / 验证JWT令牌
 */
export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}

/**
 * Refresh Token Middleware / 刷新令牌中间件
 */
export function refreshToken(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    throw new AuthenticationError('Authentication required');
  }

  // Check if token is close to expiry (within 1 hour) / 检查令牌是否接近过期（1小时内）
  const now = Math.floor(Date.now() / 1000);
  const timeUntilExpiry = req.user.exp - now;
  
  if (timeUntilExpiry < 3600) { // 1 hour / 1小时
    const newToken = generateToken({
      userId: req.user.userId,
      role: req.user.role,
      permissions: req.user.permissions,
      sessionId: req.user.sessionId
    });
    
    res.set('X-New-Token', newToken);
  }

  next();
}

/**
 * CORS Security Headers / CORS安全头
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  });
  
  next();
}

/**
 * IP Whitelist Middleware / IP白名单中间件
 */
export function ipWhitelist(allowedIPs: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    if (!allowedIPs.includes(clientIP)) {
      throw new AuthorizationError(`IP ${clientIP} not allowed`);
    }
    
    next();
  };
}