#!/usr/bin/env node

// Simple Gateway Launcher for TitanChain API Gateway / TitanChain API网关的简单启动器
// Provides easy setup and configuration for development and production / 为开发和生产提供简单的设置和配置
import { GatewayManager, createDefaultGatewayConfig } from './gateway-manager';
import { ServiceStatus, HealthCheckType } from './service-discovery';

// Simple gateway launcher / 简单的网关启动器
async function startSimpleGateway() {
  console.log('🚀 启动TitanChain API网关...');
  
  try {
    // Get configuration from environment variables / 从环境变量获取配置
    const port = parseInt(process.env.GATEWAY_PORT || '8080');
    
    // Create configuration / 创建配置
    const config = createDefaultGatewayConfig(port);
    
    // Override with environment variables / 使用环境变量覆盖配置
    if (process.env.CORS_ORIGIN) {
      config.gateway.corsOrigins = [process.env.CORS_ORIGIN];
    }
    if (process.env.RATE_LIMIT_WINDOW) {
      config.gateway.rateLimitWindowMs = parseInt(process.env.RATE_LIMIT_WINDOW);
    }
    if (process.env.RATE_LIMIT_MAX) {
      config.gateway.rateLimitMaxRequests = parseInt(process.env.RATE_LIMIT_MAX);
    }
    
    // Create and start gateway manager / 创建并启动网关管理器
    const gatewayManager = new GatewayManager(config);
    
    // Register example services / 注册示例服务
    await registerExampleServices(gatewayManager);
    
    // Start the gateway / 启动网关
    await gatewayManager.start();
    
    console.log(`✅ TitanChain API网关已启动在端口 ${port}`);
    console.log(`📊 健康检查端点: http://localhost:${port}/health`);
    console.log(`🔍 服务发现端点: http://localhost:${port}/services`);
    console.log(`📈 统计信息端点: http://localhost:${port}/stats`);
    
    // Graceful shutdown / 优雅关闭
    process.on('SIGINT', async () => {
      console.log('\n🛑 正在关闭网关...');
      try {
        await gatewayManager.stop();
        console.log('✅ 网关已安全关闭');
        process.exit(0);
      } catch (error) {
        console.error('❌ 关闭网关时出错:', error);
        process.exit(1);
      }
    });
    
    process.on('SIGTERM', async () => {
      console.log('\n🛑 收到终止信号，正在关闭网关...');
      try {
        await gatewayManager.stop();
        console.log('✅ 网关已安全关闭');
        process.exit(0);
      } catch (error) {
        console.error('❌ 关闭网关时出错:', error);
        process.exit(1);
      }
    });
    
  } catch (error) {
    console.error('❌ 启动网关失败:', error);
    process.exit(1);
  }
}

// Register example services for demonstration / 注册示例服务用于演示
async function registerExampleServices(gatewayManager: GatewayManager) {
  const serviceDiscovery = gatewayManager.getServiceDiscovery();
  
  // Register blockchain node service / 注册区块链节点服务
  await serviceDiscovery.registerService({
    serviceName: 'blockchain-node',
    instance: {
      id: 'node-1',
      host: 'localhost',
      port: 3001,
      protocol: 'http',
      status: ServiceStatus.HEALTHY,
      weight: 100,
      metadata: {
        version: '1.0.0',
        region: 'local',
        zone: 'zone-a',
        tags: ['blockchain', 'node', 'primary'],
        capabilities: ['consensus', 'storage']
      }
    },
    ttl: 30,
    tags: ['blockchain', 'node', 'primary'],
    checks: [{
      type: HealthCheckType.HTTP,
      url: 'http://localhost:3001/health',
      interval: 30000,
      timeout: 5000
    }]
  });
  
  // Register matching engine service / 注册撮合引擎服务
  await serviceDiscovery.registerService({
    serviceName: 'matching-engine',
    instance: {
      id: 'engine-1',
      host: 'localhost',
      port: 3002,
      protocol: 'http',
      status: ServiceStatus.HEALTHY,
      weight: 100,
      metadata: {
        version: '1.0.0',
        region: 'local',
        zone: 'zone-a',
        tags: ['trading', 'engine', 'primary'],
        capabilities: ['matching', 'orderbook']
      }
    },
    ttl: 30,
    tags: ['trading', 'engine', 'primary'],
    checks: [{
      type: HealthCheckType.HTTP,
      url: 'http://localhost:3002/health',
      interval: 30000,
      timeout: 5000
    }]
  });
  
  console.log('📋 已注册示例服务: blockchain-node, matching-engine');
}

// Start the gateway if this file is run directly / 如果直接运行此文件则启动网关
if (require.main === module) {
  startSimpleGateway().catch(console.error);
}

export { startSimpleGateway };