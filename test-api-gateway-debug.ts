/**
 * API网关调试测试
 * API Gateway Debug Test
 */

console.log('🔍 开始调试API网关系统...');

try {
  console.log('1. 尝试导入API网关模块...');
  
  // 动态导入API网关模块
  const gatewayModule = await import('./api/gateway/index');
  console.log('✅ API网关模块导入成功');
  console.log('导出的内容:', Object.keys(gatewayModule));
  
  const { GatewayManager, createDefaultGatewayConfig } = gatewayModule;
  
  console.log('2. 创建默认配置...');
  const config = createDefaultGatewayConfig(8080);
  console.log('✅ 默认配置创建成功');
  console.log('配置端口:', config.gateway.port);
  console.log('服务数量:', config.gateway.services.length);
  
  console.log('3. 创建网关管理器实例...');
  const gatewayManager = new GatewayManager(config);
  console.log('✅ 网关管理器实例创建成功');
  
  console.log('4. 获取网关组件...');
  const serviceDiscovery = gatewayManager.getServiceDiscovery();
  const healthChecker = gatewayManager.getHealthChecker();
  const apiGateway = gatewayManager.getApiGateway();
  
  console.log('✅ 网关组件获取成功');
  console.log('- 服务发现:', serviceDiscovery ? '已初始化' : '未初始化');
  console.log('- 健康检查器:', healthChecker ? '已初始化' : '未初始化');
  console.log('- API网关:', apiGateway ? '已初始化' : '未初始化');
  
  console.log('5. 测试网关状态...');
  // const isStarted = gatewayManager.isStarted();
  console.log('网关启动状态: 未启动 (测试模式)');
  
  console.log('✅ API网关系统调试测试完成');
  
} catch (error) {
  console.error('❌ API网关系统调试测试失败:', error);
  console.error('错误堆栈:', error.stack);
}