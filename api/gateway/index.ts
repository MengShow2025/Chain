import { GatewayManager, createDefaultGatewayConfig, createProductionGatewayConfig } from './gateway-manager';
import { LoadBalanceStrategy } from './load-balancer';

// Gateway Bootstrap Class / 网关启动器类
// Provides easy setup and configuration for development and production / 为开发和生产提供简单的设置和配置
class GatewayBootstrap {
  private gatewayManager?: GatewayManager;

  // Start gateway / 启动网关
  async start(): Promise<void> {
    try {
      console.log('🌟 TitanChain API Gateway 启动中...');

      // Get configuration / 获取配置
      const config = this.getConfig();
      
      // Create gateway manager / 创建网关管理器
      this.gatewayManager = new GatewayManager(config);
      
      // Start gateway / 启动网关
      await this.gatewayManager.start();
      
      // Setup graceful shutdown / 设置优雅关闭
      this.setupGracefulShutdown();
      
      console.log('🎉 TitanChain API Gateway 启动成功!');
      console.log(`📡 网关端口: ${config.gateway.port}`);
      console.log(`⚖️ 负载均衡策略: ${config.gateway.loadBalancingStrategy}`);
      console.log(`🔍 服务发现: 已启用`);
      console.log(`🏥 健康检查: 已启用`);
      
    } catch (error) {
      console.error('❌ 网关启动失败:', error);
      process.exit(1);
    }
  }

  // Get configuration / 获取配置
  private getConfig() {
    const isProduction = process.env.NODE_ENV === 'production';
    const port = parseInt(process.env.GATEWAY_PORT || '8080');
    
    if (isProduction) {
      console.log('🏭 使用生产环境配置');
      return createProductionGatewayConfig(port);
    } else {
      console.log('🔧 使用开发环境配置');
      const config = createDefaultGatewayConfig(port);
      
      // Development environment special configuration / 开发环境特殊配置
      if (process.env.LOAD_BALANCE_STRATEGY) {
        config.gateway.loadBalancingStrategy = process.env.LOAD_BALANCE_STRATEGY as LoadBalanceStrategy;
      }
      
      return config;
    }
  }

  // Setup graceful shutdown / 设置优雅关闭
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      console.log(`\n🛑 收到${signal}信号，正在关闭网关...`);
      
      if (this.gatewayManager) {
        try {
          await this.gatewayManager.stop();
          console.log('✅ 网关已安全关闭');
          process.exit(0);
        } catch (error) {
          console.error('❌ 关闭网关时出错:', error);
          process.exit(1);
        }
      } else {
        console.log('⚠️ 网关管理器未初始化');
        process.exit(0);
      }
    };

    // Handle process signals / 处理进程信号
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2')); // For nodemon / 用于nodemon
    
    // Handle uncaught exceptions / 处理未捕获的异常
    process.on('uncaughtException', (error) => {
      console.error('❌ 未捕获的异常:', error);
      shutdown('uncaughtException');
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ 未处理的Promise拒绝:', reason);
      shutdown('unhandledRejection');
    });
  }

  // Stop gateway / 停止网关
  async stop(): Promise<void> {
    if (this.gatewayManager) {
      await this.gatewayManager.stop();
      this.gatewayManager = undefined;
    }
  }

  // Get gateway manager / 获取网关管理器
  getGatewayManager(): GatewayManager | undefined {
    return this.gatewayManager;
  }
}

// Export gateway bootstrap instance / 导出网关启动器实例
export const gatewayBootstrap = new GatewayBootstrap();

// Auto-start if this file is run directly / 如果直接运行此文件则自动启动
// Note: ESM modules don't have require.main, use import.meta.url instead
// if (import.meta.url === `file://${process.argv[1]}`) {
//   gatewayBootstrap.start().catch(console.error);
// }

// Re-export all gateway components / 重新导出所有网关组件
export { APIGateway } from './api-gateway';
export { LoadBalancer, LoadBalanceStrategy } from './load-balancer';
export { ServiceDiscovery } from './service-discovery';
export { HealthChecker, HealthCheckType } from './health-checker';
export { GatewayManager, createDefaultGatewayConfig, createProductionGatewayConfig } from './gateway-manager';