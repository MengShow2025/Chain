#!/usr/bin/env node

import { APIGateway, defaultGatewayConfig } from './api-gateway';
import { ServiceDiscovery } from './service-discovery';
import { LoadBalancer } from './load-balancer';
import { HealthMonitor } from './health-monitor';

/**
 * 简单的网关启动器
 */
async function startSimpleGateway() {
  console.log('🚀 启动TitanChain API网关...');
  
  try {
    // 从环境变量获取配置
    const port = parseInt(process.env.GATEWAY_PORT || '8080');
    const host = process.env.GATEWAY_HOST || '0.0.0.0';
    
    // 创建配置
    const config = {
      ...defaultGatewayConfig,
      port,
      host,
      cors: {
        ...defaultGatewayConfig.cors,
        origin: process.env.CORS_ORIGIN || '*'
      },
      rateLimit: {
        ...defaultGatewayConfig.rateLimit,
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '60000'),
        max: parseInt(process.env.RATE_LIMIT_MAX || '1000')
      }
    };
    
    // 创建网关实例
    const gateway = new APIGateway(config);
    
    // 注册一些示例服务
    await registerExampleServices(gateway);
    
    // 启动网关
    await gateway.start();
    
    console.log(`✅ API网关已启动在 http://${host}:${port}`);
    console.log(`📊 健康检查: http://${host}:${port}/health`);
    console.log(`📈 统计信息: http://${host}:${port}/stats`);
    console.log(`🔍 服务列表: http://${host}:${port}/services`);
    
    // 优雅关闭处理
    const shutdown = async (signal: string) => {
      console.log(`\n🛑 收到${signal}信号，正在关闭网关...`);
      try {
        await gateway.stop();
        console.log('✅ 网关已安全关闭');
        process.exit(0);
      } catch (error) {
        console.error('❌ 关闭网关时出错:', error);
        process.exit(1);
      }
    };
    
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    return gateway;
    
  } catch (error) {
    console.error('❌ 启动网关失败:', error);
    process.exit(1);
  }
}

/**
 * 注册示例服务
 */
async function registerExampleServices(gateway: APIGateway) {
  console.log('📝 注册示例服务...');
  
  // 注册区块链节点服务
  gateway.serviceDiscovery.registerService({
    serviceName: 'blockchain-node',
    instance: {
      id: 'node-1',
      host: 'localhost',
      port: 3001,
      status: 'healthy' as const,
      weight: 100,
      metadata: {
        version: '1.0.0',
        region: 'local',
        zone: 'zone-a'
      }
    },
    ttl: 30,
    tags: ['blockchain', 'node', 'primary']
  });
  
  // 注册撮合引擎服务
  gateway.serviceDiscovery.registerService({
    serviceName: 'matching-engine',
    instance: {
      id: 'engine-1',
      host: 'localhost',
      port: 3002,
      status: 'healthy' as const,
      weight: 100,
      metadata: {
        version: '1.0.0',
        region: 'local',
        zone: 'zone-a'
      }
    },
    ttl: 30,
    tags: ['trading', 'engine', 'primary']
  });
  
  // 添加健康检查
  gateway.healthMonitor.addHealthCheck({
    id: 'blockchain-node-health',
    target: 'http://localhost:3001/health',
    type: 'http' as const,
    interval: 30000,
    timeout: 5000,
    retries: 3
  });
  
  gateway.healthMonitor.addHealthCheck({
    id: 'matching-engine-health',
    target: 'http://localhost:3002/health',
    type: 'http' as const,
    interval: 30000,
    timeout: 5000,
    retries: 3
  });
  
  console.log('✅ 示例服务注册完成');
}

// 启动网关
startSimpleGateway().catch(console.error);

export { startSimpleGateway };