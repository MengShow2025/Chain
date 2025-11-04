/**
 * Enhanced Health Check Configuration for TitanChain API Gateway
 * 增强的TitanChain API网关健康检查配置
 */

import { HealthCheckConfig, HealthCheckType } from './health-checker';

/**
 * Enhanced health check configurations / 增强的健康检查配置
 */
export const ENHANCED_HEALTH_CHECKS: HealthCheckConfig[] = [
  // Core API Server Health Check / 核心API服务器健康检查
  {
    id: 'api-server-basic',
    name: 'API Server Basic Health',
    type: HealthCheckType.HTTP,
    target: 'http://localhost:3001/api/health',
    interval: 5000, // 5 seconds / 5秒
    timeout: 3000,
    retries: 2,
    enabled: true
  },
  
  // Detailed API Server Health Check / 详细API服务器健康检查
  {
    id: 'api-server-detailed',
    name: 'API Server Detailed Health',
    type: HealthCheckType.HTTP,
    target: 'http://localhost:3001/api/health/detailed',
    interval: 15000, // 15 seconds / 15秒
    timeout: 5000,
    retries: 1,
    enabled: true
  },
  
  // Blockchain API Health Check / 区块链API健康检查
  {
    id: 'blockchain-api',
    name: 'Blockchain API Health',
    type: HealthCheckType.HTTP,
    target: 'http://localhost:3001/api/blockchain/status',
    interval: 10000, // 10 seconds / 10秒
    timeout: 8000,
    retries: 2,
    enabled: true
  },
  
  // TitanCore Engine Health Check / TitanCore引擎健康检查
  {
    id: 'titan-core-engine',
    name: 'TitanCore Engine Health',
    type: HealthCheckType.HTTP,
    target: 'http://localhost:3001/api/titan/health',
    interval: 8000, // 8 seconds / 8秒
    timeout: 6000,
    retries: 3,
    enabled: true
  },
  
  // P2P Network Health Check / P2P网络健康检查
  {
    id: 'p2p-network',
    name: 'P2P Network Health',
    type: HealthCheckType.HTTP,
    target: 'http://localhost:3001/api/p2p/status',
    interval: 12000, // 12 seconds / 12秒
    timeout: 10000,
    retries: 2,
    enabled: true
  },
  
  // Smart Sharding Health Check / 智能分片健康检查
  {
    id: 'smart-sharding',
    name: 'Smart Sharding Health',
    type: HealthCheckType.HTTP,
    target: 'http://localhost:3001/api/sharding/status',
    interval: 20000, // 20 seconds / 20秒
    timeout: 15000,
    retries: 1,
    enabled: true
  },
  
  // MPC System Health Check / MPC系统健康检查
  {
    id: 'mpc-system',
    name: 'MPC System Health',
    type: HealthCheckType.HTTP,
    target: 'http://localhost:3001/api/mpc/status',
    interval: 30000, // 30 seconds / 30秒
    timeout: 20000,
    retries: 1,
    enabled: true
  },
  
  // Database Connection Health Check / 数据库连接健康检查
  {
    id: 'database-connection',
    name: 'Database Connection Health',
    type: HealthCheckType.TCP,
    target: 'localhost:5432', // PostgreSQL default port / PostgreSQL默认端口
    interval: 15000, // 15 seconds / 15秒
    timeout: 5000,
    retries: 2,
    enabled: false // Disabled by default / 默认禁用
  },
  
  // Redis Cache Health Check / Redis缓存健康检查
  {
    id: 'redis-cache',
    name: 'Redis Cache Health',
    type: HealthCheckType.TCP,
    target: 'localhost:6379', // Redis default port / Redis默认端口
    interval: 20000, // 20 seconds / 20秒
    timeout: 3000,
    retries: 1,
    enabled: false // Disabled by default / 默认禁用
  },
  
  // System Resource Health Check / 系统资源健康检查
  {
    id: 'system-resources',
    name: 'System Resources Health',
    type: HealthCheckType.HTTP,
    target: 'http://localhost:3001/api/system/resources',
    interval: 30000, // 30 seconds / 30秒
    timeout: 10000,
    retries: 1,
    enabled: true
  }
];

/**
 * Critical health checks that must pass / 必须通过的关键健康检查
 */
export const CRITICAL_HEALTH_CHECKS = [
  'api-server-basic',
  'blockchain-api',
  'titan-core-engine'
];

/**
 * Optional health checks / 可选健康检查
 */
export const OPTIONAL_HEALTH_CHECKS = [
  'database-connection',
  'redis-cache',
  'mpc-system',
  'smart-sharding'
];

/**
 * Health check configuration by environment / 按环境的健康检查配置
 */
export const HEALTH_CHECK_ENVIRONMENTS = {
  development: {
    enableAll: true,
    criticalOnly: false,
    intervals: {
      fast: 5000,    // 5 seconds / 5秒
      normal: 15000, // 15 seconds / 15秒
      slow: 30000    // 30 seconds / 30秒
    }
  },
  
  production: {
    enableAll: false,
    criticalOnly: true,
    intervals: {
      fast: 10000,   // 10 seconds / 10秒
      normal: 30000, // 30 seconds / 30秒
      slow: 60000    // 60 seconds / 60秒
    }
  },
  
  testing: {
    enableAll: false,
    criticalOnly: true,
    intervals: {
      fast: 2000,    // 2 seconds / 2秒
      normal: 5000,  // 5 seconds / 5秒
      slow: 10000    // 10 seconds / 10秒
    }
  }
};

/**
 * Get health checks for specific environment / 获取特定环境的健康检查
 */
export function getHealthChecksForEnvironment(env: string = 'development'): HealthCheckConfig[] {
  const envConfig = HEALTH_CHECK_ENVIRONMENTS[env as keyof typeof HEALTH_CHECK_ENVIRONMENTS] || 
                   HEALTH_CHECK_ENVIRONMENTS.development;
  
  if (envConfig.criticalOnly) {
    return ENHANCED_HEALTH_CHECKS.filter(check => 
      CRITICAL_HEALTH_CHECKS.includes(check.id)
    );
  }
  
  return ENHANCED_HEALTH_CHECKS.filter(check => check.enabled);
}

/**
 * Update health check intervals for environment / 更新环境的健康检查间隔
 */
export function updateHealthCheckIntervals(
  checks: HealthCheckConfig[], 
  env: string = 'development'
): HealthCheckConfig[] {
  const envConfig = HEALTH_CHECK_ENVIRONMENTS[env as keyof typeof HEALTH_CHECK_ENVIRONMENTS] || 
                   HEALTH_CHECK_ENVIRONMENTS.development;
  
  return checks.map(check => {
    let interval = check.interval;
    
    // Adjust intervals based on check type / 根据检查类型调整间隔
    if (CRITICAL_HEALTH_CHECKS.includes(check.id)) {
      interval = envConfig.intervals.fast;
    } else if (OPTIONAL_HEALTH_CHECKS.includes(check.id)) {
      interval = envConfig.intervals.slow;
    } else {
      interval = envConfig.intervals.normal;
    }
    
    return {
      ...check,
      interval
    };
  });
}

export default {
  ENHANCED_HEALTH_CHECKS,
  CRITICAL_HEALTH_CHECKS,
  OPTIONAL_HEALTH_CHECKS,
  HEALTH_CHECK_ENVIRONMENTS,
  getHealthChecksForEnvironment,
  updateHealthCheckIntervals
};