#!/usr/bin/env node
// API Gateway Startup Script / API网关启动脚本
import { APIGateway, APIGatewayConfig } from './api/gateway/api-gateway.js';
import { LoadBalanceStrategy } from './api/gateway/load-balancer.js';
import { optimizedRoutingConfig } from './api/gateway/optimized-routing-config.js';

// Generate optimized configuration using the routing config manager / 使用路由配置管理器生成优化配置
const environment = process.env.NODE_ENV || 'development';
const config: APIGatewayConfig = optimizedRoutingConfig.generateGatewayConfig(environment);

async function startGateway() {
  console.log('🚀 Starting TitanChain API Gateway...');
  
  // Display optimized configuration summary / 显示优化配置摘要
  const configSummary = optimizedRoutingConfig.getConfigurationSummary();
  console.log('📊 Optimized Configuration Summary:');
  console.log(`  Environment: ${environment}`);
  console.log(`  Port: ${config.port}`);
  console.log(`  Route Groups: ${configSummary.routeGroups}`);
  console.log(`  Total Services: ${configSummary.totalServices}`);
  console.log(`  Critical Services: ${configSummary.servicesByPriority.critical}`);
  console.log(`  High Priority Services: ${configSummary.servicesByPriority.high}`);
  console.log(`  Load Balancing: ${config.loadBalancingStrategy}`);
  console.log(`  Rate Limit: ${config.rateLimitMaxRequests} requests per ${config.rateLimitWindowMs / 1000}s`);
  console.log(`  Health Check Interval: ${config.healthCheckInterval / 1000}s`);
  console.log(`  Caching: ${config.enableCaching ? 'Enabled' : 'Disabled'}`);
  console.log(`  Metrics: ${config.enableMetrics ? 'Enabled' : 'Disabled'}`);

  try {
    const gateway = new APIGateway(config);
    await gateway.start();
    
    console.log('✅ TitanChain API Gateway started successfully!');
    console.log(`🌐 Gateway is running on http://localhost:${config.port}`);
    console.log('📋 Available endpoints:');
    config.services.forEach(service => {
      console.log(`  - ${service.path} -> ${service.target}`);
    });
    
    // Display route groups / 显示路由组
    const routeGroups = optimizedRoutingConfig.getAllRouteGroups();
    console.log('\n🔗 Route Groups:');
    routeGroups.forEach(group => {
      console.log(`  - ${group.name}: ${group.basePath} (${group.services.length} services)`);
    });
    
    // Graceful shutdown / 优雅关闭
    process.on('SIGTERM', async () => {
      console.log('🛑 Shutting down API Gateway / 关闭API网关...');
      await gateway.stop();
      process.exit(0);
    });
    
    process.on('SIGINT', async () => {
      console.log('🛑 Shutting down API Gateway / 关闭API网关...');
      await gateway.stop();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Failed to start API Gateway:', error);
    process.exit(1);
  }
}

// Start the gateway / 启动网关
startGateway();