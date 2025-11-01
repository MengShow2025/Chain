import { GatewayManager, createDefaultGatewayConfig, createProductionGatewayConfig } from './gateway-manager.js';
import { LoadBalanceStrategy } from './load-balancer.js';

/**
 * 网关启动器
 */
class GatewayBootstrap {
  private gatewayManager?: GatewayManager;

  /**
   * 启动网关
   */
  async start(): Promise<void> {
    try {
      console.log('🌟 TitanChain API Gateway 启动中...');

      // 获取配置
      const config = this.getConfig();
      
      // 创建网关管理器
      this.gatewayManager = new GatewayManager(config);
      
      // 启动网关
      await this.gatewayManager.start();
      
      // 设置优雅关闭
      this.setupGracefulShutdown();
      
      console.log('🎉 TitanChain API Gateway 启动成功!');
      console.log(`📡 网关端口: ${config.gateway.port}`);
      console.log(`⚖️ 负载均衡策略: ${config.gateway.loadBalancer.strategy}`);
      console.log(`🔍 服务发现: 已启用`);
      console.log(`🏥 健康检查: 已启用`);
      
    } catch (error) {
      console.error('❌ 网关启动失败:', error);
      process.exit(1);
    }
  }

  /**
   * 获取配置
   */
  private getConfig() {
    const isProduction = process.env.NODE_ENV === 'production';
    const port = parseInt(process.env.GATEWAY_PORT || '8080');
    
    if (isProduction) {
      console.log('🏭 使用生产环境配置');
      return createProductionGatewayConfig(port);
    } else {
      console.log('🔧 使用开发环境配置');
      const config = createDefaultGatewayConfig(port);
      
      // 开发环境特殊配置
      if (process.env.LOAD_BALANCE_STRATEGY) {
        config.gateway.loadBalancer.strategy = process.env.LOAD_BALANCE_STRATEGY as LoadBalanceStrategy;
      }
      
      return config;
    }
  }

  /**
   * 设置优雅关闭
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      console.log(`\n📡 收到 ${signal} 信号，开始优雅关闭...`);
      
      if (this.gatewayManager) {
        try {
          await this.gatewayManager.stop();
          console.log('✅ 网关已优雅关闭');
          process.exit(0);
        } catch (error) {
          console.error('❌ 网关关闭失败:', error);
          process.exit(1);
        }
      } else {
        process.exit(0);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    
    // 处理未捕获的异常
    process.on('uncaughtException', (error) => {
      console.error('💥 未捕获的异常:', error);
      shutdown('uncaughtException');
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('💥 未处理的Promise拒绝:', reason);
      shutdown('unhandledRejection');
    });
  }

  /**
   * 获取网关管理器实例
   */
  getGatewayManager(): GatewayManager | undefined {
    return this.gatewayManager;
  }
}

// 导出实例
export const gatewayBootstrap = new GatewayBootstrap();

// 如果直接运行此文件，启动网关
if (import.meta.url === `file://${process.argv[1]}`) {
  gatewayBootstrap.start();
}

// 导出所有模块
export * from './api-gateway.js';
export * from './load-balancer.js';
export * from './service-discovery.js';
export * from './health-checker.js';
export * from './gateway-manager.js';